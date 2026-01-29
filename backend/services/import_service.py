"""
JSON导入服务
"""
import json
import time
from typing import List, Dict, Any, Optional
from pathlib import Path

from backend.models.trajectory import Trajectory
from backend.models.import_result import ImportResult, ImportHistory
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import settings, get_db_path


# 内存中存储导入任务状态
_import_tasks: Dict[str, ImportResult] = {}
_import_history: List[ImportHistory] = []


class ImportService:
    """JSON导入服务"""

    def __init__(self, db_uri: Optional[str] = None, vector_func=None):
        self.db_uri = db_uri or get_db_path()
        self.vector_func = vector_func or create_default_vector_func()
        self.repository = TrajectoryRepository(self.db_uri, self.vector_func)

    def validate_trajectory(self, traj_data: Dict[str, Any]) -> tuple[bool, List[str]]:
        """验证轨迹数据"""
        errors = []

        # 必需字段
        required_fields = [
            "trajectory_id",
            "data_id",
            "task",
            "reward",
            "exec_time",
            "agent_name",
            "termination_reason"
        ]

        for field in required_fields:
            if field not in traj_data:
                errors.append(f"Missing required field: {field}")

        # 验证task字段
        if "task" in traj_data:
            task = traj_data["task"]
            if isinstance(task, dict):
                if "question" not in task:
                    errors.append("task.question is required")
            elif not isinstance(task, str):
                errors.append("task must be a dict or string")

        # 验证reward类型
        if "reward" in traj_data:
            try:
                float(traj_data["reward"])
            except (ValueError, TypeError):
                errors.append("reward must be a number")

        # 验证steps和chat_completions
        if "steps" in traj_data and not isinstance(traj_data["steps"], list):
            errors.append("steps must be a list")

        if "chat_completions" in traj_data and not isinstance(traj_data["chat_completions"], list):
            errors.append("chat_completions must be a list")

        return len(errors) == 0, errors

    async def import_from_dict(self, traj_data: Dict[str, Any]) -> ImportResult:
        """从字典导入单个轨迹"""
        task_id = f"import_{int(time.time())}_{id(traj_data)}"
        result = ImportResult(
            task_id=task_id,
            status="processing",
            progress=0
        )
        _import_tasks[task_id] = result

        try:
            # 验证数据
            is_valid, errors = self.validate_trajectory(traj_data)
            if not is_valid:
                result.success = False
                result.failed_count = 1
                result.errors = errors
                result.status = "failed"
                return result

            # 检查是否已存在
            existing = self.repository.get(traj_data["trajectory_id"])
            if existing:
                result.warnings.append(f"Trajectory {traj_data['trajectory_id']} already exists, skipping")
                result.skipped_count = 1
                result.status = "completed"
                result.progress = 100
                return result

            # 创建轨迹
            trajectory = Trajectory(**traj_data)
            trajectory.source = "json_import"
            trajectory.created_at = time.time()
            trajectory.updated_at = time.time()

            self.repository.add(trajectory)
            result.imported_count = 1
            result.success = True
            result.status = "completed"
            result.progress = 100

            # 记录历史
            self._add_history(task_id, "dict_import", result)

        except Exception as e:
            result.success = False
            result.failed_count = 1
            result.errors.append(str(e))
            result.status = "failed"

        return result

    async def import_from_json(self, file_path: str) -> ImportResult:
        """从JSON文件导入轨迹"""
        task_id = f"import_{int(time.time())}"
        result = ImportResult(
            task_id=task_id,
            status="processing",
            progress=0
        )
        _import_tasks[task_id] = result

        try:
            # 读取文件
            path = Path(file_path)
            if not path.exists():
                result.success = False
                result.errors.append(f"File not found: {file_path}")
                result.status = "failed"
                return result

            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 提取轨迹列表
            trajectories = []
            if isinstance(data, dict):
                if "trajectories" in data:
                    trajectories = data["trajectories"]
                elif "trajectory" in data:
                    trajectories = [data["trajectory"]]
                else:
                    result.errors.append("Invalid JSON format. Expected 'trajectories' or 'trajectory' key")
                    result.status = "failed"
                    return result
            elif isinstance(data, list):
                trajectories = data
            else:
                result.errors.append("Invalid JSON format. Expected dict or list")
                result.status = "failed"
                return result

            total = len(trajectories)
            result.progress = 10

            # 批量导入
            for i, traj_data in enumerate(trajectories):
                try:
                    # 验证
                    is_valid, errors = self.validate_trajectory(traj_data)
                    if not is_valid:
                        result.failed_count += 1
                        result.errors.append(f"Trajectory {i}: {', '.join(errors)}")
                        continue

                    # 检查重复
                    traj_id = traj_data.get("trajectory_id")
                    if self.repository.get(traj_id):
                        result.skipped_count += 1
                        result.warnings.append(f"Trajectory {traj_id} already exists")
                        continue

                    # 创建并保存
                    trajectory = Trajectory(**traj_data)
                    trajectory.source = "json_import"
                    trajectory.created_at = time.time()
                    trajectory.updated_at = time.time()

                    self.repository.add(trajectory)
                    result.imported_count += 1

                    # 更新进度
                    progress = 10 + int((i + 1) / total * 80)
                    result.progress = progress

                except Exception as e:
                    result.failed_count += 1
                    result.errors.append(f"Trajectory {i}: {str(e)}")

            result.progress = 100
            result.success = result.imported_count > 0 or result.skipped_count > 0
            result.status = "completed"
            result.completed_at = time.time()

            # 记录历史
            self._add_history(task_id, path.name, result)

        except json.JSONDecodeError as e:
            result.success = False
            result.errors.append(f"Invalid JSON: {str(e)}")
            result.status = "failed"
        except Exception as e:
            result.success = False
            result.errors.append(f"Import failed: {str(e)}")
            result.status = "failed"

        return result

    async def get_import_status(self, task_id: str) -> Optional[ImportResult]:
        """获取导入任务状态"""
        return _import_tasks.get(task_id)

    async def get_import_history(self, limit: int = 50) -> List[ImportHistory]:
        """获取导入历史"""
        return sorted(_import_history, key=lambda x: x.created_at, reverse=True)[:limit]

    def _add_history(self, task_id: str, file_name: str, result: ImportResult):
        """添加导入历史记录"""
        history = ImportHistory(
            task_id=task_id,
            file_name=file_name,
            imported_count=result.imported_count,
            failed_count=result.failed_count,
            status=result.status,
            created_at=result.created_at,
            completed_at=result.completed_at
        )
        _import_history.append(history)

        # 限制历史记录数量
        if len(_import_history) > 100:
            _import_history.pop(0)

    async def search_similar(self, question: str, limit: int = 10) -> List[Trajectory]:
        """搜索相似轨迹（用于验证导入后的数据）"""
        vector = self.vector_func(question)
        return self.repository.search_similar(vector, limit)


# 清理旧任务
def cleanup_old_tasks(max_age_seconds: int = 3600):
    """清理超过指定时间的任务"""
    current_time = time.time()
    to_remove = []
    for task_id, result in _import_tasks.items():
        if current_time - result.created_at > max_age_seconds:
            to_remove.append(task_id)

    for task_id in to_remove:
        del _import_tasks[task_id]
