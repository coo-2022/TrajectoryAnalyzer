"""
可视化服务
"""
from typing import List, Dict, Any, Optional
import time

from backend.models.trajectory import Trajectory
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.services.analysis_service import AnalysisService
from backend.config import settings, get_db_path


class VisualizationService:
    """可视化数据生成服务"""

    def __init__(self, db_uri: Optional[str] = None, vector_func=None):
        self.db_uri = db_uri or get_db_path()
        self.vector_func = vector_func or create_default_vector_func()
        self.repository = TrajectoryRepository(self.db_uri, self.vector_func)
        self.analysis_service = AnalysisService(self.db_uri, self.vector_func)

    async def get_timeline_data(self, trajectory_id: str, include_all_metrics: bool = False) -> Dict[str, Any]:
        """生成时序图数据"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return {"error": "Trajectory not found"}

        # 提取步骤数据
        steps_data = []
        for i, step in enumerate(trajectory.steps):
            step_data = {
                "step": i + 1,
                "reward": step.reward,
                "done": step.done
            }
            steps_data.append(step_data)

        # 构建时序数据
        x_axis = [f"Step {d['step']}" for d in steps_data]
        reward_data = [d['reward'] for d in steps_data]

        series = [{"name": "Reward", "data": reward_data}]

        if include_all_metrics:
            # 可以添加其他指标
            pass

        return {
            "x_axis": x_axis,
            "y_axis": "Reward",
            "series": series,
            "data": steps_data,
            "title": f"Reward Timeline - {trajectory_id}"
        }

    async def get_flow_data(self, trajectory_id: str) -> Dict[str, Any]:
        """生成流程图数据"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return {"error": "Trajectory not found"}

        nodes = []
        edges = []

        # 添加开始节点
        nodes.append({
            "id": "start",
            "label": "Start",
            "type": "start",
            "status": "success"
        })

        # 处理每个步骤
        for i, step in enumerate(trajectory.steps):
            step_id = f"step_{i + 1}"

            # 确定状态
            if step.reward < 0:
                status = "error"
            elif step.done:
                status = "success"
            else:
                status = "running"

            # 确定类型
            action = step.action or "thought"
            if "finish" in str(action).lower():
                node_type = "finish"
            elif "tool" in str(action).lower():
                node_type = "tool"
            else:
                node_type = "action"

            nodes.append({
                "id": step_id,
                "label": f"Step {i + 1}: {action}",
                "type": node_type,
                "status": status,
                "reward": step.reward
            })

            # 添加边
            if i == 0:
                edges.append({
                    "source": "start",
                    "target": step_id,
                    "label": ""
                })
            else:
                prev_step_id = f"step_{i}"
                edges.append({
                    "source": prev_step_id,
                    "target": step_id,
                    "label": f"{step.reward:.2f}"
                })

        return {
            "nodes": nodes,
            "edges": edges,
            "title": f"Execution Flow - {trajectory_id}"
        }

    async def get_overview_stats(self) -> Dict[str, Any]:
        """获取概览统计数据"""
        stats = await self.analysis_service.get_statistics()

        return {
            "total_trajectories": stats.total_count,
            "success_rate": (stats.success_count / stats.total_count * 100) if stats.total_count > 0 else 0,
            "avg_exec_time": stats.avg_exec_time,
            "avg_reward": stats.avg_reward,
            "pass_at_1": stats.pass_at_1,
            "pass_at_k": stats.pass_at_k
        }

    async def get_failure_distribution(self) -> List[Dict[str, Any]]:
        """获取失败原因分布"""
        distribution = await self.analysis_service.get_failure_distribution()

        return [d.model_dump() for d in distribution]

    async def get_reward_trend(self) -> Dict[str, Any]:
        """获取Reward趋势"""
        df = self.repository.get_lightweight_df()

        if df.empty:
            return {"data": [], "x_axis": [], "y_axis": ""}

        # 按索引排序
        df = df.sort_index()

        rewards = df['reward'].tolist()
        x_axis = [f"Traj {i}" for i in range(len(rewards))]

        return {
            "x_axis": x_axis,
            "y_axis": "Reward",
            "data": rewards,
            "title": "Reward Trend"
        }

    async def get_agent_comparison(self) -> List[Dict[str, Any]]:
        """获取不同Agent的对比数据"""
        df = self.repository.get_lightweight_df()

        if df.empty or 'agent_name' not in df.columns:
            return []

        # 按agent分组统计
        agent_stats = df.groupby('agent_name').agg({
            'reward': 'mean',
            'exec_time': 'mean',
            'trajectory_id': 'count'
        }).reset_index()

        agent_stats.columns = ['agent_name', 'avg_reward', 'avg_exec_time', 'total_count']

        # 计算成功率（需要合并分析结果）
        analysis_df = self.repository.get_analysis_df()
        if not analysis_df.empty:
            merged = df.merge(analysis_df[['trajectory_id', 'is_success']], on='trajectory_id', how='left')
            merged['is_success'] = merged['is_success'].fillna(False)

            success_rates = merged.groupby('agent_name')['is_success'].mean()
            agent_stats['success_rate'] = agent_stats['agent_name'].map(success_rates).fillna(0.0)
        else:
            agent_stats['success_rate'] = 0.0

        result = []
        for _, row in agent_stats.iterrows():
            result.append({
                "agent_name": row['agent_name'],
                "success_rate": float(row['success_rate']),
                "avg_reward": float(row['avg_reward']),
                "avg_exec_time": float(row['avg_exec_time']),
                "total_count": int(row['total_count'])
            })

        return result

    async def get_difficulty_distribution(self) -> Dict[str, int]:
        """获取问题难度分布"""
        stats = await self.analysis_service.get_statistics()
        df = self.repository.get_lightweight_df()

        if df.empty:
            return {"easy": 0, "medium": 0, "hard": 0}

        # 合并分析结果
        analysis_df = self.repository.get_analysis_df()
        merged = df.merge(analysis_df[['trajectory_id', 'is_success']], on='trajectory_id', how='left')
        merged['is_success'] = merged['is_success'].fillna(False)

        # 按data_id分组计算成功率
        if 'data_id' in merged.columns:
            question_stats = merged.groupby('data_id')['is_success'].mean()

            easy = (question_stats >= 0.9).sum()
            hard = (question_stats == 0.0).sum()
            medium = len(question_stats) - easy - hard
        else:
            easy, medium, hard = 0, 0, 0

        return {
            "easy": int(easy),
            "medium": int(medium),
            "hard": int(hard)
        }

    async def get_similarity_network(self, limit: int = 10) -> Dict[str, Any]:
        """生成相似关系网络图"""
        trajectories = self.repository.get_all(limit=limit)

        if len(trajectories) < 2:
            return {"nodes": [], "links": []}

        nodes = []
        links = []

        # 添加节点
        for traj in trajectories:
            nodes.append({
                "id": traj.trajectory_id,
                "label": traj.data_id,
                "reward": traj.reward,
                "is_success": traj.reward > 0.5
            })

        # 计算相似度并添加边
        for i, traj1 in enumerate(trajectories):
            for traj2 in trajectories[i+1:]:
                # 简单相似度计算：基于问题相似
                question1 = traj1.get_question().lower()
                question2 = traj2.get_question().lower()

                # 简单的词汇重叠相似度
                words1 = set(question1.split())
                words2 = set(question2.split())

                if words1 and words2:
                    similarity = len(words1 & words2) / len(words1 | words2)
                else:
                    similarity = 0.0

                # 只添加相似度大于阈值的边
                if similarity > 0.3:
                    links.append({
                        "source": traj1.trajectory_id,
                        "target": traj2.trajectory_id,
                        "similarity": float(similarity)
                    })

        return {
            "nodes": nodes,
            "links": links
        }

    async def export_chart_config(self, chart_type: str, trajectory_id: str) -> Dict[str, Any]:
        """导出图表配置"""
        if chart_type == "timeline":
            data = await self.get_timeline_data(trajectory_id)
            chart_type_name = "line"
        elif chart_type == "flow":
            data = await self.get_flow_data(trajectory_id)
            chart_type_name = "graph"
        else:
            return {"error": "Unknown chart type"}

        return {
            "type": chart_type_name,
            "title": data.get("title", ""),
            "data": data,
            "generated_at": time.time()
        }

    async def get_stats_charts(self) -> Dict[str, Any]:
        """获取所有统计图表数据"""
        overview = await self.get_overview_stats()
        failure_dist = await self.get_failure_distribution()
        reward_trend = await self.get_reward_trend()
        agent_comp = await self.get_agent_comparison()
        difficulty = await self.get_difficulty_distribution()

        return {
            "overview": overview,
            "failure_distribution": failure_dist,
            "reward_trend": reward_trend,
            "agent_comparison": agent_comp,
            "difficulty_distribution": difficulty
        }
