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

        # 允许直接读取的目录列表（用于本地文件导入）
        self.allowed_directories = self._load_allowed_directories()

    def _load_allowed_directories(self) -> List[Path]:
        """加载允许访问的目录"""
        dirs = []

        # 默认允许的目录
        default_dirs = [
            Path.home() / "Downloads",
            Path.home() / "Documents",
            Path.home() / "Desktop",
            Path("/tmp"),
        ]

        for dir_path in default_dirs:
            if dir_path.exists():
                dirs.append(dir_path)

        # 从配置文件加载额外目录
        if hasattr(settings, 'allowed_import_directories'):
            for dir_str in settings.allowed_import_directories:
                dir_path = Path(dir_str).expanduser().resolve()
                if dir_path.exists():
                    dirs.append(dir_path)

        return dirs

    def is_path_allowed(self, file_path: str) -> tuple[bool, str]:
        """检查文件路径是否在允许的目录内"""
        try:
            path = Path(file_path).expanduser().resolve()

            # 检查文件是否存在
            if not path.exists():
                return False, f"File does not exist: {file_path}"

            # 检查是否是文件（不是目录）
            if not path.is_file():
                return False, f"Not a file: {file_path}"

            # 检查是否在允许的目录内
            for allowed_dir in self.allowed_directories:
                try:
                    path.relative_to(allowed_dir)
                    return True, ""
                except ValueError:
                    continue

            # 如果没有匹配的目录，返回错误信息
            allowed_paths = [str(d) for d in self.allowed_directories]
            return False, f"Path not in allowed directories. Allowed: {', '.join(allowed_paths)}"

        except Exception as e:
            return False, f"Path validation error: {str(e)}"

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
        """从JSON文件导入轨迹（直接读取文件路径，无需拷贝）"""
        task_id = f"import_{int(time.time())}"
        result = ImportResult(
            task_id=task_id,
            status="processing",
            progress=0
        )
        _import_tasks[task_id] = result

        try:
            # 验证路径
            is_allowed, error_msg = self.is_path_allowed(file_path)
            if not is_allowed:
                result.success = False
                result.errors.append(error_msg)
                result.status = "failed"
                return result

            path = Path(file_path).expanduser().resolve()

            # 直接读取文件，无需拷贝
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
            self._add_history(task_id, str(path.name), result)

        except json.JSONDecodeError as e:
            result.success = False
            result.errors.append(f"Invalid JSON: {str(e)}")
            result.status = "failed"
        except Exception as e:
            result.success = False
            result.errors.append(f"Import failed: {str(e)}")
            result.status = "failed"

        return result

    async def import_from_jsonl(self, file_path: str) -> ImportResult:
        """从JSONL文件导入轨迹（流式处理，适合超大文件）

        JSONL格式：每行一个独立的JSON对象
        {"trajectory_id": "1", ...}
        {"trajectory_id": "2", ...}
        """
        task_id = f"import_{int(time.time())}"
        result = ImportResult(
            task_id=task_id,
            status="processing",
            progress=0,
            message="Importing from JSONL file (streaming mode)"
        )
        _import_tasks[task_id] = result

        try:
            # 验证路径
            is_allowed, error_msg = self.is_path_allowed(file_path)
            if not is_allowed:
                result.success = False
                result.errors.append(error_msg)
                result.status = "failed"
                return result

            path = Path(file_path).expanduser().resolve()

            # 流式读取，逐行处理
            total_count = 0
            with open(path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():  # 跳过空行
                        continue

                    try:
                        traj_data = json.loads(line)

                        # 验证
                        is_valid, errors = self.validate_trajectory(traj_data)
                        if not is_valid:
                            result.failed_count += 1
                            result.errors.append(f"Line {line_num}: {', '.join(errors)}")
                            continue

                        # 检查重复
                        traj_id = traj_data.get("trajectory_id")
                        if self.repository.get(traj_id):
                            result.skipped_count += 1
                            continue

                        # 创建并保存
                        trajectory = Trajectory(**traj_data)
                        trajectory.source = "jsonl_import"
                        trajectory.created_at = time.time()
                        trajectory.updated_at = time.time()

                        self.repository.add(trajectory)
                        result.imported_count += 1
                        total_count += 1

                        # 每100条更新一次进度
                        if total_count % 100 == 0:
                            result.progress = min(90, total_count // 10)

                    except json.JSONDecodeError as e:
                        result.failed_count += 1
                        result.errors.append(f"Line {line_num}: Invalid JSON - {str(e)}")
                    except Exception as e:
                        result.failed_count += 1
                        result.errors.append(f"Line {line_num}: {str(e)}")

            result.progress = 100
            result.success = result.imported_count > 0 or result.skipped_count > 0
            result.status = "completed"
            result.completed_at = time.time()
            result.message = f"Imported {result.imported_count} trajectories from JSONL"

            # 记录历史
            self._add_history(task_id, str(path.name), result)

        except Exception as e:
            result.success = False
            result.errors.append(f"JSONL import failed: {str(e)}")
            result.status = "failed"

        return result

    async def get_import_status(self, task_id: str) -> Optional[ImportResult]:
        """获取导入任务状态"""
        return _import_tasks.get(task_id)

    async def get_import_history(self, limit: int = 50) -> List[ImportHistory]:
        """获取导入历史"""
        return sorted(_import_history, key=lambda x: x.created_at, reverse=True)[:limit]

    def get_allowed_directories(self) -> List[str]:
        """获取允许导入的目录列表"""
        return [str(d) for d in self.allowed_directories]

    def add_allowed_directory(self, dir_path: str) -> tuple[bool, str]:
        """添加允许导入的目录"""
        try:
            path = Path(dir_path).expanduser().resolve()
            if not path.exists():
                return False, f"Directory does not exist: {dir_path}"
            if not path.is_dir():
                return False, f"Not a directory: {dir_path}"

            if path not in self.allowed_directories:
                self.allowed_directories.append(path)

            return True, f"Added allowed directory: {dir_path}"
        except Exception as e:
            return False, f"Failed to add directory: {str(e)}"

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
