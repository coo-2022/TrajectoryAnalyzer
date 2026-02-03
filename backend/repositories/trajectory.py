"""
Trajectory数据访问层
"""
import json
import hashlib
from typing import List, Dict, Any, Optional, Callable
import lancedb
import pandas as pd
from lancedb.pydantic import LanceModel, Vector
from pydantic import BaseModel

from backend.models.trajectory import Trajectory, Task, Step
from backend.models.analysis import AnalysisResult
from backend.config import settings


class DbTask(BaseModel):
    """数据库任务模型"""
    question: str
    ground_truth: str


class DbTrajectory(LanceModel):
    """数据库轨迹模型"""
    trajectory_id: str
    data_id: str
    question_vector: Vector(settings.vector_dimension)
    task: DbTask
    steps_json: str
    chat_completions_json: str

    reward: float
    toolcall_reward: float
    res_reward: float
    exec_time: float

    epoch_id: int
    iteration_id: int
    sample_id: int
    training_id: str
    agent_name: str
    termination_reason: str

    step_count: int = 0
    is_analyzed: bool = False

    # 新增元数据字段
    tags_json: str = "[]"
    notes: str = ""
    is_bookmarked: bool = False
    source: str = "api"
    created_at: float = 0.0
    updated_at: float = 0.0

    class Config:
        protected_namespaces = ()

    @classmethod
    def from_domain(cls, traj: Trajectory, vector_func: Callable) -> "DbTrajectory":
        """从领域模型转换为数据库模型"""
        # 序列化steps
        steps_data = []
        for s in traj.steps:
            step_dict = {
                "step_id": s.step_id,
                "thought": s.thought,
                "model_response": s.model_response,
                "chat_completions": s.chat_completions,
                "info": s.info,
                "reward": s.reward,
                "done": s.done,
                "mc_return": s.mc_return,
                "action": s.action,
                "observation": s.observation
            }
            steps_data.append(step_dict)
        steps_json_str = json.dumps(steps_data, ensure_ascii=False, default=str)

        # 序列化chat_completions
        traj_chats = traj.chat_completions if traj.chat_completions else []
        chat_json_str = json.dumps(traj_chats, ensure_ascii=False, default=str)

        # 提取问题文本
        q_text = traj.get_question()
        gt_text = traj.get_ground_truth()

        # 生成向量
        vec = vector_func(q_text)

        # 序列化标签
        tags_json = json.dumps(traj.tags or [], ensure_ascii=False)

        return cls(
            trajectory_id=str(traj.trajectory_id),
            data_id=str(traj.data_id or "unknown"),
            question_vector=vec,
            task=DbTask(question=q_text, ground_truth=gt_text),
            steps_json=steps_json_str,
            chat_completions_json=chat_json_str,
            reward=float(traj.reward),
            toolcall_reward=float(traj.toolcall_reward),
            res_reward=float(traj.res_reward),
            exec_time=float(traj.exec_time),
            epoch_id=int(traj.epoch_id),
            iteration_id=int(traj.iteration_id),
            sample_id=int(traj.sample_id),
            training_id=str(traj.training_id or ""),
            agent_name=str(traj.agent_name),
            termination_reason=str(traj.termination_reason),
            step_count=len(traj.steps),
            is_analyzed=False,
            tags_json=tags_json,
            notes=traj.notes or "",
            is_bookmarked=traj.is_bookmarked,
            source=traj.source,
            created_at=traj.created_at,
            updated_at=traj.updated_at
        )

    def to_domain(self) -> Trajectory:
        """从数据库模型转换为领域模型"""
        # 反序列化steps
        raw_steps = json.loads(self.steps_json)
        domain_steps = []

        for s_dict in raw_steps:
            step = Step(
                step_id=s_dict.get('step_id', 0),
                chat_completions=s_dict.get('chat_completions', []),
                thought=s_dict.get('thought', ""),
                model_response=s_dict.get('model_response', ""),
                action=s_dict.get('action'),
                observation=s_dict.get('observation'),
                info=s_dict.get('info', {}),
                reward=s_dict.get('reward', 0.0),
                done=s_dict.get('done', False),
                mc_return=s_dict.get('mc_return', 0.0)
            )
            domain_steps.append(step)

        # 反序列化chat_completions
        domain_chats = json.loads(self.chat_completions_json)

        # 反序列化标签
        tags = json.loads(self.tags_json) if self.tags_json else []

        return Trajectory(
            trajectory_id=self.trajectory_id,
            data_id=self.data_id,
            task={"question": self.task.question, "ground_truth": self.task.ground_truth},
            steps=domain_steps,
            chat_completions=domain_chats,
            reward=self.reward,
            toolcall_reward=self.toolcall_reward,
            res_reward=self.res_reward,
            exec_time=self.exec_time,
            epoch_id=self.epoch_id,
            iteration_id=self.iteration_id,
            sample_id=self.sample_id,
            training_id=self.training_id,
            agent_name=self.agent_name,
            termination_reason=self.termination_reason,
            tags=tags,
            notes=self.notes,
            is_bookmarked=self.is_bookmarked,
            source=self.source,
            created_at=self.created_at,
            updated_at=self.updated_at
        )


class DbAnalysisResult(LanceModel):
    """数据库分析结果模型"""
    trajectory_id: str
    is_success: bool
    category: str
    root_cause: str
    suggestion: str
    analyzed_at: float

    @classmethod
    def from_domain(cls, res: AnalysisResult) -> "DbAnalysisResult":
        return cls(
            trajectory_id=res.trajectory_id,
            is_success=res.is_success,
            category=res.category,
            root_cause=res.root_cause,
            suggestion=res.suggestion,
            analyzed_at=res.analyzed_at
        )

    def to_domain(self) -> AnalysisResult:
        return AnalysisResult(
            trajectory_id=self.trajectory_id,
            is_success=self.is_success,
            category=self.category,
            root_cause=self.root_cause,
            suggestion=self.suggestion,
            analyzed_at=self.analyzed_at
        )


class TrajectoryRepository:
    """轨迹数据访问层"""

    def __init__(
        self,
        db_uri: str,
        vector_func: Callable,
        table_name: str = "trajectories",
        analysis_table_name: str = "analysis_results"
    ):
        self.db = lancedb.connect(db_uri)
        self.vector_func = vector_func
        self.table_name = table_name
        self.analysis_table_name = analysis_table_name

        # 初始化轨迹表
        if table_name not in self.db.table_names():
            self.tbl = self.db.create_table(table_name, schema=DbTrajectory)
        else:
            self.tbl = self.db.open_table(table_name)

        # 初始化分析结果表
        if analysis_table_name not in self.db.table_names():
            self.analysis_tbl = self.db.create_table(analysis_table_name, schema=DbAnalysisResult)
        else:
            self.analysis_tbl = self.db.open_table(analysis_table_name)

    def add(self, trajectory: Trajectory) -> None:
        """添加单个轨迹"""
        db_obj = DbTrajectory.from_domain(trajectory, self.vector_func)
        self.tbl.add([db_obj])

    def add_batch(self, trajectories: List[Trajectory]) -> None:
        """批量添加轨迹"""
        db_objs = [DbTrajectory.from_domain(t, self.vector_func) for t in trajectories]
        self.tbl.add(db_objs)

    def get(self, trajectory_id: str) -> Optional[Trajectory]:
        """根据ID获取轨迹"""
        results = self.tbl.search().where(f"trajectory_id = '{trajectory_id}'").limit(1).to_pydantic(DbTrajectory)
        if results:
            return results[0].to_domain()
        return None

    def get_all(self, limit: int = 10000, sort_params: Dict[str, str] = None) -> List[Trajectory]:
        """获取所有轨迹

        Args:
            limit: 返回数量限制
            sort_params: 排序参数 {"field": "field_name", "order": "asc"/"desc"}
        """
        query = self.tbl.search()
        df = query.limit(limit).to_pandas()

        # 在pandas中进行排序
        if sort_params and sort_params.get("field"):
            field = sort_params["field"]
            order = sort_params.get("order", "desc")
            ascending = order == "asc"

            if field in df.columns:
                df = df.sort_values(by=field, ascending=ascending)
            else:
                print(f"Warning: Sort field '{field}' not found in DataFrame")

        results = []
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            db_traj = DbTrajectory(**row_dict)
            results.append(db_traj.to_domain())

        return results

    def get_lightweight_df(self, limit: int = 100000) -> pd.DataFrame:
        """获取轻量级DataFrame（不含大字段）"""
        cols = [
            "trajectory_id", "data_id", "task", "reward",
            "step_count", "exec_time", "agent_name", "is_analyzed",
            "tags_json", "is_bookmarked", "notes", "source"
        ]
        df = self.tbl.search().select(cols).limit(limit).to_pandas()
        return df

    def get_analysis_df(self, limit: int = 100000) -> pd.DataFrame:
        """获取分析结果DataFrame"""
        return self.analysis_tbl.search().limit(limit).to_pandas()

    def get_analysis_by_ids(self, trajectory_ids: List[str]) -> pd.DataFrame:
        """根据ID列表批量获取分析结果

        Args:
            trajectory_ids: 轨迹ID列表

        Returns:
            包含分析结果的DataFrame
        """
        if not trajectory_ids:
            return pd.DataFrame()

        # 构建IN查询
        ids_str = ", ".join([f"'{tid}'" for tid in trajectory_ids])
        where_clause = f"trajectory_id IN ({ids_str})"

        df = self.analysis_tbl.search().where(where_clause).to_pandas()
        return df

    def fetch_unanalyzed(self, limit: int = 100) -> List[Trajectory]:
        """获取未分析的轨迹"""
        results = self.tbl.search().where("is_analyzed IS NULL OR is_analyzed = false").limit(limit).to_pydantic(DbTrajectory)
        return [r.to_domain() for r in results]

    def mark_analyzed(self, trajectory_ids: List[str]) -> None:
        """标记轨迹为已分析"""
        if not trajectory_ids:
            return
        ids_str = ", ".join([f"'{tid}'" for tid in trajectory_ids])
        where_clause = f"trajectory_id IN ({ids_str})"
        self.tbl.update(where=where_clause, values={"is_analyzed": True})

    def save_analysis(self, result: AnalysisResult) -> None:
        """保存分析结果"""
        self.analysis_tbl.delete(f"trajectory_id = '{result.trajectory_id}'")
        db_obj = DbAnalysisResult.from_domain(result)
        self.analysis_tbl.add([db_obj])

    def get_analysis(self, trajectory_id: str) -> Optional[AnalysisResult]:
        """获取分析结果"""
        results = self.analysis_tbl.search().where(f"trajectory_id = '{trajectory_id}'").limit(1).to_pydantic(DbAnalysisResult)
        if results:
            return results[0].to_domain()
        return None

    def get_all_analysis(self) -> List[AnalysisResult]:
        """获取所有分析结果"""
        results = self.analysis_tbl.search().limit(10000).to_pydantic(DbAnalysisResult)
        return [r.to_domain() for r in results]

    def update_metadata(self, trajectory_id: str, metadata: Dict[str, Any]) -> None:
        """更新元数据"""
        allowed_fields = ["tags_json", "notes", "is_bookmarked", "updated_at"]
        values = {k: v for k, v in metadata.items() if k in allowed_fields}
        if values:
            values["updated_at"] = values.get("updated_at", __import__('time').time())
            self.tbl.update(where=f"trajectory_id = '{trajectory_id}'", values=values)

    def delete(self, trajectory_id: str) -> None:
        """删除轨迹"""
        self.tbl.delete(f"trajectory_id = '{trajectory_id}'")

    def search_similar(self, question_vector: List[float], limit: int = 10) -> List[Trajectory]:
        """向量搜索相似轨迹"""
        results = self.tbl.search(question_vector).limit(limit).to_pydantic(DbTrajectory)
        return [r.to_domain() for r in results]

    def filter(self, filters: Dict[str, Any], limit: int = 100, sort_params: Dict[str, str] = None) -> List[Trajectory]:
        """根据条件筛选轨迹

        Args:
            filters: 筛选条件字典
            limit: 返回结果数量限制
            sort_params: 排序参数 {"field": "field_name", "order": "asc"/"desc"}
        """
        where_clauses = []

        # 模糊匹配字段
        if "trajectory_id" in filters and filters["trajectory_id"]:
            where_clauses.append(f"trajectory_id LIKE '%{filters['trajectory_id']}%'")

        if "data_id" in filters and filters["data_id"]:
            where_clauses.append(f"data_id LIKE '%{filters['data_id']}%'")

        if "question" in filters and filters["question"]:
            # 问题文本模糊匹配（需要查询嵌套字段task.question）
            # 注意：LanceDB的struct类型需要特殊处理
            where_clauses.append(f"task.question LIKE '%{filters['question']}%'")

        if "agent_name" in filters and filters["agent_name"]:
            # Agent名称模糊匹配
            where_clauses.append(f"agent_name LIKE '%{filters['agent_name']}%'")

        if "termination_reason" in filters and filters["termination_reason"]:
            # 终止原因枚举（支持逗号分隔的多选）
            reasons = filters["termination_reason"].split(",")
            reasons_str = ", ".join([f"'{r.strip()}'" for r in reasons])
            where_clauses.append(f"termination_reason IN ({reasons_str})")

        # Reward字段：支持范围和精确匹配
        if "reward_exact" in filters and filters["reward_exact"] is not None:
            where_clauses.append(f"reward = {filters['reward_exact']}")
        else:
            if "reward_min" in filters and filters["reward_min"] is not None:
                where_clauses.append(f"reward >= {filters['reward_min']}")
            if "reward_max" in filters and filters["reward_max"] is not None:
                where_clauses.append(f"reward <= {filters['reward_max']}")

        # Toolcall Reward字段
        if "toolcall_reward_exact" in filters and filters["toolcall_reward_exact"] is not None:
            where_clauses.append(f"toolcall_reward = {filters['toolcall_reward_exact']}")
        else:
            if "toolcall_reward_min" in filters and filters["toolcall_reward_min"] is not None:
                where_clauses.append(f"toolcall_reward >= {filters['toolcall_reward_min']}")
            if "toolcall_reward_max" in filters and filters["toolcall_reward_max"] is not None:
                where_clauses.append(f"toolcall_reward <= {filters['toolcall_reward_max']}")

        # Res Reward字段
        if "res_reward_exact" in filters and filters["res_reward_exact"] is not None:
            where_clauses.append(f"res_reward = {filters['res_reward_exact']}")
        else:
            if "res_reward_min" in filters and filters["res_reward_min"] is not None:
                where_clauses.append(f"res_reward >= {filters['res_reward_min']}")
            if "res_reward_max" in filters and filters["res_reward_max"] is not None:
                where_clauses.append(f"res_reward <= {filters['res_reward_max']}")

        # 其他ID字段
        if "epoch_id" in filters and filters["epoch_id"] is not None:
            where_clauses.append(f"epoch_id = {filters['epoch_id']}")

        if "iteration_id" in filters and filters["iteration_id"] is not None:
            where_clauses.append(f"iteration_id = {filters['iteration_id']}")

        if "sample_id" in filters and filters["sample_id"] is not None:
            where_clauses.append(f"sample_id = {filters['sample_id']}")

        if "training_id" in filters and filters["training_id"]:
            where_clauses.append(f"training_id = '{filters['training_id']}'")

        # 布尔字段
        if "is_bookmarked" in filters and filters["is_bookmarked"] is not None:
            where_clauses.append(f"is_bookmarked = {filters['is_bookmarked']}")

        # 兼容旧的参数名
        if "id" in filters and filters["id"]:
            where_clauses.append(f"trajectory_id LIKE '%{filters['id']}%'")

        if "questionId" in filters and filters["questionId"]:
            where_clauses.append(f"data_id = '{filters['questionId']}'")

        # Step count字段：支持范围筛选
        if "step_count_min" in filters and filters["step_count_min"] is not None:
            where_clauses.append(f"step_count >= {filters['step_count_min']}")
        if "step_count_max" in filters and filters["step_count_max"] is not None:
            where_clauses.append(f"step_count <= {filters['step_count_max']}")

        # Execution time字段：支持范围筛选
        if "exec_time_min" in filters and filters["exec_time_min"] is not None:
            where_clauses.append(f"exec_time >= {filters['exec_time_min']}")
        if "exec_time_max" in filters and filters["exec_time_max"] is not None:
            where_clauses.append(f"exec_time <= {filters['exec_time_max']}")

        # 构建查询
        where_clause = " AND ".join(where_clauses) if where_clauses else None

        query = self.tbl.search()
        if where_clause:
            query = query.where(where_clause)

        # 获取数据并转换为DataFrame以支持排序
        df = query.limit(limit).to_pandas()

        # 在pandas中进行排序
        if sort_params and sort_params.get("field"):
            field = sort_params["field"]
            order = sort_params.get("order", "desc")
            ascending = order == "asc"

            if field in df.columns:
                df = df.sort_values(by=field, ascending=ascending)
            else:
                print(f"Warning: Sort field '{field}' not found in DataFrame")

        # 转换为Pydantic模型
        results = []
        for _, row in df.iterrows():
            # 将DataFrame行转换为字典
            row_dict = row.to_dict()
            # 创建DbTrajectory对象
            db_traj = DbTrajectory(**row_dict)
            results.append(db_traj.to_domain())

        return results


def create_default_vector_func() -> Callable:
    """创建默认的向量化函数（简单hash模拟）"""
    def vector_func(text: str) -> List[float]:
        # 使用hash生成模拟向量
        hash_obj = hashlib.md5(text.encode('utf-8'))
        base = int(hash_obj.hexdigest()[:8], 16)
        # 生成384维向量
        return [(base + i) % 100 / 100.0 for i in range(settings.vector_dimension)]
    return vector_func
