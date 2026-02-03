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
from backend.services.logger_service import logger


# 内存中存储导入任务状态
_import_tasks: Dict[str, ImportResult] = {}
_import_history: List[ImportHistory] = []


class ImportService:
    """JSON导入服务"""

    # 批量插入配置
    BATCH_SIZE = 500  # 每批处理500条记录

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

        # 必需字段（精简到最核心的）
        required_fields = [
            "trajectory_id",
            "data_id",
        ]

        for field in required_fields:
            if field not in traj_data:
                errors.append(f"Missing required field: {field}")

        # reward 字段可选，默认0.0
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

    def _normalize_trajectory_data(self, traj_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化轨迹数据，处理格式差异"""
        normalized = traj_data.copy()

        # 0. 修复 trajectory_id：确保包含 tree_id
        if "trajectory_id" in normalized and "tree_id" in normalized:
            traj_id = normalized["trajectory_id"]
            tree_id = str(normalized["tree_id"])

            # 检查 trajectory_id 是否已包含 tree_id（最后一段应该是 tree_id）
            parts = traj_id.split("-")
            if len(parts) >= 6:
                # 如果最后一部分不等于 tree_id，说明 ID 缺少 tree_id
                if parts[-1] != tree_id:
                    # 重新生成 trajectory_id，包含 tree_id
                    # 格式: {data_id}-{training_id}-{epoch_id}-{iteration_id}-{sample_id}-{tree_id}
                    data_id = normalized.get("data_id", "")
                    training_id = normalized.get("training_id", "")
                    epoch_id = normalized.get("epoch_id", "")
                    iteration_id = normalized.get("iteration_id", "")
                    sample_id = normalized.get("sample_id", "")

                    normalized["trajectory_id"] = f"{data_id}-{training_id}-{epoch_id}-{iteration_id}-{sample_id}-{tree_id}"

        # 1. 处理缺失的必需字段
        if "task" not in normalized:
            # 从 chat_completions 中提取问题
            if "chat_completions" in normalized and len(normalized["chat_completions"]) > 1:
                user_msg = normalized["chat_completions"][1]
                if isinstance(user_msg, dict) and user_msg.get("role") == "user":
                    question = user_msg.get("content", "")
                    normalized["task"] = {"question": question}
            else:
                normalized["task"] = {"question": ""}

        # 2. 填充可选字段的默认值
        normalized.setdefault("exec_time", 0.0)
        normalized.setdefault("agent_name", "")
        normalized.setdefault("termination_reason", "")
        normalized.setdefault("toolcall_reward", 0.0)
        normalized.setdefault("res_reward", 0.0)

        # 3. 转换 reward 类型
        if "reward" in normalized:
            try:
                normalized["reward"] = float(normalized["reward"])
            except (ValueError, TypeError):
                normalized["reward"] = 0.0

        # 4. 标准化 steps 数据
        if "steps" in normalized:
            normalized_steps = []
            for step in normalized["steps"]:
                if isinstance(step, dict):
                    normalized_step = step.copy()
                    # 转换字符串类型的数字字段
                    for field in ["reward", "mc_return", "done", "step_id"]:
                        if field in normalized_step:
                            if isinstance(normalized_step[field], str):
                                if field in ["reward", "mc_return"]:
                                    try:
                                        normalized_step[field] = float(normalized_step[field])
                                    except ValueError:
                                        normalized_step[field] = 0.0
                                elif field == "done":
                                    normalized_step[field] = normalized_step[field].lower() == "true"
                                elif field == "step_id":
                                    try:
                                        normalized_step[field] = int(normalized_step[field])
                                    except ValueError:
                                        normalized_step[field] = 0
                    normalized_steps.append(normalized_step)
            normalized["steps"] = normalized_steps

        return normalized

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
            # 标准化数据
            traj_data = self._normalize_trajectory_data(traj_data)

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
                    # 标准化数据
                    traj_data = self._normalize_trajectory_data(traj_data)

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

    async def import_from_jsonl(self, file_path: str, skip_duplicate_check: bool = False) -> ImportResult:
        """从JSONL文件导入轨迹（流式处理，适合超大文件）

        支持两种JSONL格式：
        1. 每行一个独立的JSON对象
           {"trajectory_id": "1", ...}
           {"trajectory_id": "2", ...}

        2. 每行包含trajectories数组的JSON对象
           {"iteration": "0", "trajectories": [...]}
           {"iteration": "1", "trajectories": [...]}
        """
        task_id = f"import_{int(time.time())}"
        result = ImportResult(
            task_id=task_id,
            status="processing",
            progress=0,
            message="Importing from JSONL file (streaming mode)"
        )
        _import_tasks[task_id] = result

        # 记录开始日志
        logger.info(task_id, f"开始导入JSONL文件: {file_path}")

        try:
            # 验证路径
            logger.info(task_id, "验证文件路径...", file_path=file_path)
            is_allowed, error_msg = self.is_path_allowed(file_path)
            if not is_allowed:
                logger.error(task_id, "文件路径验证失败", error=error_msg)
                result.success = False
                result.errors.append(error_msg)
                result.status = "failed"
                return result

            path = Path(file_path).expanduser().resolve()
            logger.info(task_id, "文件路径验证通过", path=str(path))

            # 获取文件大小
            file_size = path.stat().st_size
            logger.info(task_id, "文件信息", size=file_size, size_mb=f"{file_size / 1024 / 1024:.2f} MB")

            # 批量去重优化：一次性加载所有已存在的ID
            existing_ids = set()
            if not skip_duplicate_check:
                logger.info(task_id, "加载现有轨迹ID用于去重检查...")
                existing_ids = self.repository.get_all_existing_ids()
                logger.info(task_id, "已加载现有轨迹ID", count=len(existing_ids))
            else:
                logger.info(task_id, "跳过去重检查（skip_duplicate_check=True）")

            # 流式读取，逐行处理
            total_count = 0
            line_count = 0
            start_time = time.time()

            # 批量插入优化
            batch = []
            batch_start_time = time.time()

            logger.info(task_id, "开始解析文件内容...")

            with open(path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():  # 跳过空行
                        continue

                    line_count += 1

                    try:
                        line_data = json.loads(line)

                        # 判断格式：如果包含"trajectories"字段，则遍历数组
                        if isinstance(line_data, dict) and "trajectories" in line_data:
                            trajectories = line_data["trajectories"]
                            if not isinstance(trajectories, list):
                                error_msg = f"Line {line_num}: 'trajectories' must be a list"
                                logger.error(task_id, "数据格式错误", line=line_num, error=error_msg)
                                result.failed_count += len(trajectories) if isinstance(trajectories, list) else 1
                                result.errors.append(error_msg)
                                continue

                            # 处理数组中的每个轨迹
                            for traj_idx, traj_data in enumerate(trajectories):
                                try:
                                    # 标准化数据
                                    traj_data = self._normalize_trajectory_data(traj_data)

                                    # 验证
                                    is_valid, errors = self.validate_trajectory(traj_data)
                                    if not is_valid:
                                        error_msg = f"Line {line_num}[{traj_idx}]: {', '.join(errors)}"
                                        logger.warning(task_id, "轨迹验证失败", line=line_num, index=traj_idx, errors=errors)
                                        result.failed_count += 1
                                        result.errors.append(error_msg)
                                        continue

                                    # 检查重复
                                    traj_id = traj_data.get("trajectory_id")
                                    if not skip_duplicate_check and traj_id in existing_ids:
                                        logger.info(task_id, "跳过重复轨迹", trajectory_id=traj_id, line=line_num, index=traj_idx)
                                        result.skipped_count += 1
                                        continue

                                    # 创建轨迹对象（不立即插入）
                                    trajectory = Trajectory(**traj_data)
                                    trajectory.source = "jsonl_import"
                                    trajectory.created_at = time.time()
                                    trajectory.updated_at = time.time()

                                    # 添加到批量
                                    batch.append(trajectory)

                                    # 批量插入
                                    if len(batch) >= self.BATCH_SIZE:
                                        self.repository.add_batch(batch)
                                        result.imported_count += len(batch)
                                        total_count += len(batch)

                                        # 批量插入性能日志
                                        batch_time = time.time() - batch_start_time
                                        logger.info(task_id, "批量插入完成",
                                                  batch_size=len(batch),
                                                  elapsed=f"{batch_time:.2f}s",
                                                  throughput=f"{len(batch)/batch_time:.1f}条/秒")

                                        batch = []
                                        batch_start_time = time.time()

                                    if total_count % 1000 == 0:
                                        logger.info(task_id, "导入进度", imported=total_count, line=line_num)

                                except Exception as e:
                                    error_msg = f"Line {line_num}[{traj_idx}]: {str(e)}"
                                    logger.error(task_id, "导入轨迹失败", line=line_num, index=traj_idx, error=str(e))
                                    result.failed_count += 1
                                    result.errors.append(error_msg)
                        else:
                            # 格式1：每行一个轨迹对象
                            traj_data = line_data

                            # 标准化数据
                            traj_data = self._normalize_trajectory_data(traj_data)

                            # 验证
                            is_valid, errors = self.validate_trajectory(traj_data)
                            if not is_valid:
                                error_msg = f"Line {line_num}: {', '.join(errors)}"
                                logger.warning(task_id, "轨迹验证失败", line=line_num, errors=errors)
                                result.failed_count += 1
                                result.errors.append(error_msg)
                                continue

                            # 检查重复
                            traj_id = traj_data.get("trajectory_id")
                            if not skip_duplicate_check and traj_id in existing_ids:
                                logger.info(task_id, "跳过重复轨迹", trajectory_id=traj_id, line=line_num)
                                result.skipped_count += 1
                                continue

                            # 创建轨迹对象（不立即插入）
                            trajectory = Trajectory(**traj_data)
                            trajectory.source = "jsonl_import"
                            trajectory.created_at = time.time()
                            trajectory.updated_at = time.time()

                            # 添加到批量
                            batch.append(trajectory)

                            # 批量插入
                            if len(batch) >= self.BATCH_SIZE:
                                self.repository.add_batch(batch)
                                result.imported_count += len(batch)
                                total_count += len(batch)

                                # 批量插入性能日志
                                batch_time = time.time() - batch_start_time
                                logger.info(task_id, "批量插入完成",
                                          batch_size=len(batch),
                                          elapsed=f"{batch_time:.2f}s",
                                          throughput=f"{len(batch)/batch_time:.1f}条/秒")

                                batch = []
                                batch_start_time = time.time()

                        # 每100条或每10行更新一次进度
                        if total_count % 100 == 0 or line_count % 10 == 0:
                            result.progress = min(90, total_count // 10)
                            logger.info(task_id, "导入进度更新",
                                      imported=total_count,
                                      skipped=result.skipped_count,
                                      failed=result.failed_count,
                                      progress=result.progress)

                    except json.JSONDecodeError as e:
                        error_msg = f"Line {line_num}: Invalid JSON - {str(e)}"
                        logger.error(task_id, "JSON解析失败", line=line_num, error=str(e))
                        result.failed_count += 1
                        result.errors.append(error_msg)
                    except Exception as e:
                        error_msg = f"Line {line_num}: {str(e)}"
                        logger.error(task_id, "处理行失败", line=line_num, error=str(e))
                        result.failed_count += 1
                        result.errors.append(error_msg)

            # 插入剩余记录
            if batch:
                self.repository.add_batch(batch)
                result.imported_count += len(batch)
                total_count += len(batch)

                # 批量插入性能日志
                batch_time = time.time() - batch_start_time
                logger.info(task_id, "批量插入完成(最后一批)",
                          batch_size=len(batch),
                          elapsed=f"{batch_time:.2f}s",
                          throughput=f"{len(batch)/batch_time:.1f}条/秒")

            result.progress = 100
            result.success = result.imported_count > 0 or result.skipped_count > 0
            result.status = "completed"
            result.completed_at = time.time()
            result.message = f"Imported {result.imported_count} trajectories from JSONL"

            elapsed_time = time.time() - start_time
            logger.info(task_id, "导入完成",
                        imported=result.imported_count,
                        skipped=result.skipped_count,
                        failed=result.failed_count,
                        elapsed_time=f"{elapsed_time:.2f}s",
                        lines_processed=line_count)

            # 记录历史
            self._add_history(task_id, str(path.name), result)

        except Exception as e:
            logger.error(task_id, "导入失败", error=str(e))
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
