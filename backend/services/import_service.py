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
from backend.services.trajectory_service import TrajectoryService


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

    def _detect_and_convert_nested_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """检测并转换嵌套格式的轨迹数据

        支持的嵌套结构:
        {
            "iteration": "...",
            "trajectories": [
                {
                    "trajectory": {
                        "task": {...},
                        "data_id": "...",
                        "training_id": "...",
                        "trajectory_id": "..."
                    },
                    "metrics": {...},
                    "chat_completions": [...]
                }
            ]
        }
        """
        # 检查是否是嵌套格式
        if "trajectories" in data and isinstance(data["trajectories"], list):
            # 这是一个包含多个轨迹的嵌套结构
            return None  # 返回 None 表示这是批量结构，需要在外部处理

        # 检查单个轨迹是否是嵌套格式
        if "trajectory" in data and isinstance(data["trajectory"], dict):
            nested = data["trajectory"]

            # 提取基础信息
            result = {
                "trajectory_id": nested.get("trajectory_id", ""),
                "data_id": nested.get("data_id", ""),
                "training_id": nested.get("training_id", ""),
                "epoch_id": int(nested.get("epoch_id", 0) or 0),
                "iteration_id": int(nested.get("iteration_id", 0) or 0),
                "sample_id": int(nested.get("sample_id", 0) or 0),
            }

            # 提取 task 信息
            if "task" in nested and isinstance(nested["task"], dict):
                task_info = nested["task"]
                if "task" in task_info and isinstance(task_info["task"], dict):
                    inner_task = task_info["task"]
                    result["task"] = {
                        "question": inner_task.get("problem", ""),
                        "ground_truth": inner_task.get("ground_truth", "")
                    }
                    # 提取其他元数据
                    result["agent_name"] = inner_task.get("agent_name", "")
                else:
                    result["task"] = {"question": "", "ground_truth": ""}
            else:
                result["task"] = {"question": "", "ground_truth": ""}

            # 提取 metrics 信息
            if "metrics" in data and isinstance(data["metrics"], dict):
                metrics = data["metrics"]
                result["reward"] = float(metrics.get("reward", 0) or 0)
                result["toolcall_reward"] = float(metrics.get("toolcall_reward", 0) or 0)
                result["res_reward"] = float(metrics.get("res_reward", 0) or 0)
                result["exec_time"] = float(metrics.get("total_time", 0) or 0)
            else:
                result["reward"] = 0.0
                result["toolcall_reward"] = 0.0
                result["res_reward"] = 0.0
                result["exec_time"] = 0.0

            # 提取 trajectory_reward（如果存在）
            if "trajectory_reward" in data:
                try:
                    result["trajectory_reward"] = float(data["trajectory_reward"])
                except (ValueError, TypeError):
                    result["trajectory_reward"] = 0.0

            # 提取 chat_completions
            if "chat_completions" in data and isinstance(data["chat_completions"], list):
                result["chat_completions"] = data["chat_completions"]
            else:
                result["chat_completions"] = []

            # 提取 steps（如果存在）
            result["steps"] = []

            return result

        # 不是嵌套格式，返回原始数据
        return data

    def _normalize_trajectory_data(self, traj_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化轨迹数据，处理格式差异"""
        # 首先尝试转换嵌套格式
        converted = self._detect_and_convert_nested_format(traj_data)
        if converted is None:
            # 这是批量嵌套结构，不应该在这里处理
            raise ValueError("批量嵌套结构应该在外部分解为单个轨迹")

        normalized = converted.copy()

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

        # 2.5 处理 final_reward/trajectory_reward：优先使用作为 reward
        # 如果存在 final_reward 或 trajectory_reward，使用它们作为 reward
        final_reward_val = None
        if "final_reward" in normalized:
            try:
                final_reward_val = float(normalized["final_reward"])
            except (ValueError, TypeError):
                pass
        elif "trajectory_reward" in normalized:
            try:
                final_reward_val = float(normalized["trajectory_reward"])
            except (ValueError, TypeError):
                pass

        if final_reward_val is not None and final_reward_val != 0.0:
            normalized["reward"] = final_reward_val
        # 如果 reward 为0且 res_reward 不为0，使用 res_reward 作为 reward
        elif normalized.get("reward", 0) == 0.0 and "res_reward" in normalized:
            try:
                res_reward = float(normalized["res_reward"])
                if res_reward != 0.0:
                    normalized["reward"] = res_reward
            except (ValueError, TypeError):
                pass

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
                    # 处理嵌套格式: { "iteration": "...", "trajectories": [ {...}, {...} ] }
                    # 每个元素可能是 { "trajectory": {...}, "metrics": {...} }
                    raw_trajectories = data["trajectories"]
                    for item in raw_trajectories:
                        if isinstance(item, dict) and "trajectory" in item:
                            # 这是嵌套格式，提取整个 item 包含 trajectory 和 metrics
                            trajectories.append(item)
                        else:
                            # 标准格式
                            trajectories.append(item)
                elif "trajectory" in data:
                    trajectories = [data]
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

        支持三种JSONL格式：
        1. 每行一个独立的JSON对象
           {"trajectory_id": "1", ...}
           {"trajectory_id": "2", ...}

        2. 每行包含trajectories数组的JSON对象
           {"iteration": "0", "trajectories": [...]}
           {"iteration": "1", "trajectories": [...]}

        3. 多行JSON对象（pretty-printed，跨越多行）
           {
             "trajectory_id": "1",
             ...
           }
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

            # 支持多行JSON对象的解析 - 使用递归下降解析器
            json_buffer = ""

            def process_json_object(obj_data: dict, line_num: int):
                """处理单个JSON对象（可能是轨迹或包含trajectories数组）"""
                nonlocal batch, total_count, batch_start_time, result

                try:
                    # 判断格式：如果包含"trajectories"字段，则遍历数组
                    if isinstance(obj_data, dict) and "trajectories" in obj_data:
                        trajectories = obj_data["trajectories"]
                        if not isinstance(trajectories, list):
                            error_msg = f"Line {line_num}: 'trajectories' must be a list"
                            logger.error(task_id, "数据格式错误", line=line_num, error=error_msg)
                            result.failed_count += 1
                            result.errors.append(error_msg)
                            return

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
                        # 单个轨迹对象
                        traj_data = obj_data

                        # 标准化数据
                        traj_data = self._normalize_trajectory_data(traj_data)

                        # 验证
                        is_valid, errors = self.validate_trajectory(traj_data)
                        if not is_valid:
                            error_msg = f"Line {line_num}: {', '.join(errors)}"
                            logger.warning(task_id, "轨迹验证失败", line=line_num, errors=errors)
                            result.failed_count += 1
                            result.errors.append(error_msg)
                            return

                        # 检查重复
                        traj_id = traj_data.get("trajectory_id")
                        if not skip_duplicate_check and traj_id in existing_ids:
                            logger.info(task_id, "跳过重复轨迹", trajectory_id=traj_id, line=line_num)
                            result.skipped_count += 1
                            return

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

                except Exception as e:
                    error_msg = f"Line {line_num}: {str(e)}"
                    logger.error(task_id, "处理JSON对象失败", line=line_num, error=str(e))
                    result.failed_count += 1
                    result.errors.append(error_msg)

            def try_parse_buffer():
                """尝试解析缓冲区中的JSON，支持多行JSON对象"""
                nonlocal json_buffer

                buffer = json_buffer.strip()
                if not buffer:
                    return True  # 缓冲区为空

                # 尝试直接解析（单行JSON）
                try:
                    obj = json.loads(buffer)
                    json_buffer = ""  # 清空缓冲区
                    return obj
                except json.JSONDecodeError:
                    pass

                # 尝试查找完整的JSON对象（多行情况）
                # 使用括号匹配来找到完整的JSON对象
                brace_count = 0
                in_string = False
                escape_next = False
                obj_start = -1

                for i, char in enumerate(buffer):
                    if escape_next:
                        escape_next = False
                        continue

                    if char == '\\' and in_string:
                        escape_next = True
                        continue

                    if char == '"' and not in_string:
                        in_string = True
                        continue

                    if char == '"' and in_string:
                        in_string = False
                        continue

                    if not in_string:
                        if char == '{':
                            if brace_count == 0:
                                obj_start = i
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0 and obj_start >= 0:
                                # 找到一个完整的JSON对象
                                try:
                                    obj = json.loads(buffer[obj_start:i+1])
                                    # 保留剩余部分到缓冲区
                                    json_buffer = buffer[i+1:]
                                    return obj
                                except json.JSONDecodeError:
                                    # 不是有效的JSON，继续查找
                                    continue

                # 没有找到完整的JSON对象
                return None

            # 记录解析调试信息
            debug_info = []

            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line_count += 1
                    json_buffer += line

                    # 尝试解析缓冲区中的JSON对象
                    while True:
                        obj = try_parse_buffer()
                        if obj is None:
                            # 缓冲区中没有完整的JSON对象，继续读取
                            break
                        if obj is True:
                            # 缓冲区为空
                            break

                        # 成功解析到一个JSON对象
                        process_json_object(obj, line_count)

                        # 更新进度
                        if total_count % 100 == 0:
                            result.progress = min(90, total_count // 10)
                            logger.info(task_id, "导入进度更新",
                                      imported=total_count,
                                      skipped=result.skipped_count,
                                      failed=result.failed_count,
                                      progress=result.progress)

            # 处理缓冲区中剩余的内容
            if json_buffer.strip():
                obj = try_parse_buffer()
                if obj and obj is not True:
                    process_json_object(obj, line_count)
                elif obj is None:
                    # 剩余内容无法解析为完整JSON
                    error_detail = f"文件末尾有无法解析的内容: {json_buffer[:200]}"
                    logger.error(task_id, error_detail)
                    debug_info.append({
                        "line": line_count,
                        "error": error_detail,
                        "buffer_preview": json_buffer[:500]
                    })

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

            # 如果有调试信息，添加到结果中
            if debug_info:
                result.errors.append(f"Debug info: {len(debug_info)} parse errors")
                for info in debug_info[:5]:  # 只显示前5个
                    result.errors.append(f"Line {info['line']}: {info['error'][:100]}")

            elapsed_time = time.time() - start_time
            logger.info(task_id, "导入完成",
                        imported=result.imported_count,
                        skipped=result.skipped_count,
                        failed=result.failed_count,
                        elapsed_time=f"{elapsed_time:.2f}s",
                        lines_processed=line_count)

            # 记录历史
            self._add_history(task_id, str(path.name), result)

            # 清除其他服务的缓存，确保新导入的数据立即可见
            self._invalidate_services_cache()

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

    def _invalidate_services_cache(self):
        """重新初始化其他服务的 repository，确保新导入的数据立即可见

        问题：清除数据或导入后，各模块的 repository 可能仍持有旧的数据库句柄
        解决：重新创建 repository 实例，强制连接到新的数据库
        """
        try:
            from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
            from backend.config import get_db_path

            # 重新初始化 trajectories 服务
            from backend.routes import trajectories
            if hasattr(trajectories, 'service'):
                new_repo = TrajectoryRepository(get_db_path(), create_default_vector_func())
                trajectories.service.repository = new_repo
                if hasattr(trajectories.service, 'invalidate_cache'):
                    trajectories.service.invalidate_cache()
                logger.info("import_cache", "已重置 trajectories 服务")

            # 重新初始化 questions 模块
            from backend.routes import questions
            if hasattr(questions, '_repository'):
                questions._repository = TrajectoryRepository(get_db_path(), create_default_vector_func())
            if hasattr(questions, '_questions_cache'):
                questions._questions_cache["data"] = None
                questions._questions_cache["expire_time"] = 0
            logger.info("import_cache", "已重置 questions 服务")

            # 重新初始化 export 服务
            from backend.routes import export
            if hasattr(export, 'service'):
                export.service.repository = TrajectoryRepository(get_db_path(), create_default_vector_func())
                if hasattr(export.service, 'invalidate_cache'):
                    export.service.invalidate_cache()

            # 重新初始化 visualization 服务
            from backend.routes import visualization
            if hasattr(visualization, 'service'):
                visualization.service.repository = TrajectoryRepository(get_db_path(), create_default_vector_func())
                if hasattr(visualization.service, 'invalidate_cache'):
                    visualization.service.invalidate_cache()

            # 重新初始化 analysis_stats 模块
            from backend.routes import analysis_stats
            if hasattr(analysis_stats, '_repository'):
                analysis_stats._repository = TrajectoryRepository(get_db_path(), create_default_vector_func())
            logger.info("import_cache", "已重置 analysis_stats 服务")

            # 重新初始化 main 模块的全局 trajectory_service
            from backend import main
            if hasattr(main, '_trajectory_service') and main._trajectory_service is not None:
                main._trajectory_service = TrajectoryService(get_db_path(), create_default_vector_func())
                logger.info("import_cache", "已重置 main._trajectory_service")

        except Exception as e:
            # 缓存清除失败不影响导入结果
            logger.warning("import_cache", "重置服务失败", error=str(e))


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
