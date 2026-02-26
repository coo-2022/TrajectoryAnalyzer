"""
导入相关API路由
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import Dict, Any, Optional
from pydantic import BaseModel
from pathlib import Path
import json

from backend.models.import_result import ImportResult
from backend.services.import_service import ImportService
from backend.services.logger_service import logger
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/import", tags=["import"])

# 初始化服务
service = ImportService(get_db_path(), create_default_vector_func())


def detect_file_format(file_path: str) -> tuple[str, Optional[str]]:
    """自动检测文件格式

    Args:
        file_path: 文件路径

    Returns:
        tuple: (format_type, error_message)
        - format_type: "json", "jsonl", 或 "unknown"
        - error_message: 如果检测失败，返回错误信息；成功返回 None
    """
    path = Path(file_path).expanduser().resolve()

    if not path.exists():
        return "unknown", f"文件不存在: {file_path}"

    if not path.is_file():
        return "unknown", f"路径不是文件: {file_path}"

    # 首先检查文件扩展名
    suffix = path.suffix.lower()
    if suffix == '.jsonl':
        return "jsonl", None
    if suffix == '.json':
        return "json", None

    # 如果扩展名不明确，尝试读取文件内容判断
    try:
        with open(path, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()

        if not first_line:
            return "unknown", "文件为空"

        # 尝试解析第一行作为 JSON
        try:
            json.loads(first_line)
            # 如果能解析，可能是 JSONL（每行一个 JSON 对象）
            # 再检查整个文件是否是合法的 JSON（数组或对象）
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            try:
                parsed = json.loads(content)
                # 如果是数组，就是 JSON；如果是对象，需要进一步判断
                if isinstance(parsed, list):
                    return "json", None
                # 如果是对象，可能是 JSON 也可能是 JSONL 的一行
                # 检查文件是否有换行符
                if '\n' in content:
                    # 有多行，可能是 JSONL
                    return "jsonl", None
                return "json", None
            except json.JSONDecodeError:
                # 整个文件不是合法 JSON，但每行是，说明是 JSONL
                return "jsonl", None
        except json.JSONDecodeError:
            # 第一行不是完整 JSON，可能是多行 JSONL 格式
            # 尝试读取更多内容来判断
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    # 读取前 10 行或前 10KB 内容
                    lines = []
                    for i, line in enumerate(f):
                        if i >= 10:
                            break
                        lines.append(line)
                    sample_content = ''.join(lines).strip()

                # 尝试找到第一个完整的 JSON 对象
                # 使用括号匹配
                brace_count = 0
                in_string = False
                escape_next = False
                obj_start = -1

                for i, char in enumerate(sample_content):
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
                                # 尝试解析找到的完整对象
                                try:
                                    obj = json.loads(sample_content[obj_start:i+1])
                                    # 如果能解析，说明是多行 JSONL 格式
                                    return "jsonl", None
                                except json.JSONDecodeError:
                                    continue

                # 如果找不到完整对象，但文件以 { 开头，可能是多行 JSONL
                if sample_content.startswith('{'):
                    return "jsonl", None

                return "unknown", "文件格式不正确：不是有效的 JSON 或 JSONL 格式"
            except Exception:
                return "unknown", "文件格式不正确：不是有效的 JSON 或 JSONL 格式"

    except Exception as e:
        return "unknown", f"读取文件失败: {str(e)}"


class FilePathRequest(BaseModel):
    """文件路径请求模型"""
    file_path: str
    file_type: str = "auto"  # auto, json, 或 jsonl


@router.post("/json", response_model=Dict[str, Any], status_code=202)
async def import_json_file(file: UploadFile = File(...)):
    """导入文件 - 支持JSON和JSONL格式自动检测（流式处理）

    自动检测文件格式（.json 或 .jsonl），使用与路径导入相同的逻辑
    支持大文件上传
    """
    import tempfile
    import os
    import shutil

    temp_file_path = None

    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
            temp_file_path = temp_file.name
            # 使用流式写入，支持大文件
            shutil.copyfileobj(file.file, temp_file)

        # 自动检测文件格式（与 from-path 使用相同逻辑）
        detected_format, error_msg = detect_file_format(temp_file_path)
        if detected_format == "unknown":
            os.unlink(temp_file_path)
            raise HTTPException(status_code=400, detail=error_msg or "无法识别文件格式")

        logger.info("import_upload", f"上传文件格式检测: {detected_format}", file_name=file.filename)

        # 根据检测到的格式执行导入
        if detected_format == "jsonl":
            result = await service.import_from_jsonl(temp_file_path)
        else:
            result = await service.import_from_json(temp_file_path)

        # 删除临时文件
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

        return result.model_dump()

    except HTTPException:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        raise
    except Exception as e:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

        raise HTTPException(status_code=400, detail=str(e))


@router.post("/from-path", response_model=Dict[str, Any])
async def import_from_path(request: FilePathRequest):
    """从本地文件路径导入轨迹（无需上传，直接读取）

    优点：
    - 无需网络传输
    - 无需创建临时文件
    - 直接读取原始文件
    - 适合大文件导入

    安全性：
    - 只能访问允许的目录（默认：~/Downloads, ~/Documents, ~/Desktop, /tmp）
    - 可通过 API 添加更多允许的目录

    支持格式：
    - JSON: 标准JSON数组或对象
    - JSONL: 每行一个JSON对象（推荐用于大文件）
    - 自动检测: file_type="auto" 时自动识别格式（默认）
    """
    try:
        # 确定文件格式
        file_type = request.file_type.lower()

        if file_type == "auto":
            # 自动检测格式
            detected_format, error_msg = detect_file_format(request.file_path)
            if detected_format == "unknown":
                raise HTTPException(status_code=400, detail=error_msg or "无法识别文件格式")
            file_type = detected_format
            logger.info("import_detect", f"自动检测到文件格式: {file_type}", file_path=request.file_path)

        # 验证文件格式是否支持
        if file_type not in ["json", "jsonl"]:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_type}。支持的格式: json, jsonl, auto")

        # 执行导入
        if file_type == "jsonl":
            result = await service.import_from_jsonl(request.file_path)
        else:
            result = await service.import_from_json(request.file_path)

        return result.model_dump()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/dict", response_model=Dict[str, Any])
async def import_from_dict(data: Dict[str, Any]):
    """从字典导入单个轨迹"""
    # 支持两种格式：{"trajectory": {...}} 或直接 {...}
    if "trajectory" in data:
        traj_data = data["trajectory"]
    else:
        traj_data = data

    result = await service.import_from_dict(traj_data)
    return result.model_dump()


@router.get("/status/{task_id}", response_model=Dict[str, Any])
async def get_import_status(task_id: str):
    """获取导入任务状态"""
    result = await service.get_import_status(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result.model_dump()


@router.get("/history", response_model=Dict[str, Any])
async def get_import_history(limit: int = Query(50, ge=1, le=200)):
    """获取导入历史"""
    history = await service.get_import_history(limit)
    return {
        "data": [h.model_dump() for h in history],
        "total": len(history)
    }


@router.get("/allowed-directories", response_model=Dict[str, Any])
async def get_allowed_directories():
    """获取允许导入的目录列表"""
    dirs = service.get_allowed_directories()
    return {
        "directories": dirs,
        "total": len(dirs)
    }


@router.post("/add-directory", response_model=Dict[str, Any])
async def add_allowed_directory(directory: str = Body(..., embed=True)):
    """添加允许导入的目录

    例如：POST /api/import/add-directory
    Body: {"directory": "/home/user/data"}
    """
    success, message = service.add_allowed_directory(directory)
    if success:
        dirs = service.get_allowed_directories()
        return {
            "success": True,
            "message": message,
            "directories": dirs
        }
    else:
        raise HTTPException(status_code=400, detail=message)


@router.get("/logs/{task_id}", response_model=Dict[str, Any])
async def get_import_logs(task_id: str, level: Optional[str] = Query(None)):
    """获取指定导入任务的日志

    参数:
    - task_id: 导入任务ID
    - level: 日志级别过滤 (info, warning, error)，可选
    """
    try:
        logs = logger.get_task_logs(task_id)

        # 按级别过滤
        if level:
            logs = [log for log in logs if log["level"] == level]

        return {
            "task_id": task_id,
            "logs": logs,
            "total": len(logs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs", response_model=Dict[str, Any])
async def get_all_logs(limit: int = Query(100, ge=1, le=1000), level: Optional[str] = Query(None)):
    """获取所有导入日志

    参数:
    - limit: 返回的日志条数限制 (默认100，最大1000)
    - level: 日志级别过滤 (info, warning, error)，可选
    """
    try:
        logs = logger.get_logs(limit=limit)

        # 按级别过滤
        if level:
            logs = [log for log in logs if log["level"] == level]

        return {
            "logs": logs,
            "total": len(logs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-data", response_model=Dict[str, Any])
async def clear_all_data():
    """清除所有数据（轨迹和分析数据）

    警告：此操作会永久删除所有数据，不可恢复！
    """
    import shutil
    import os
    import gc

    try:
        # 获取数据库路径
        db_path = get_db_path()
        data_dir = os.path.dirname(db_path)

        # 删除 lancedb 目录
        lancedb_path = os.path.join(data_dir, "lancedb")
        cleared_paths = []

        if os.path.exists(lancedb_path):
            shutil.rmtree(lancedb_path)
            cleared_paths.append(lancedb_path)

        # 强制垃圾回收，释放文件句柄
        gc.collect()

        # 重新创建数据库目录
        get_db_path()

        # 重新初始化本模块的服务
        global service
        service = ImportService(get_db_path(), create_default_vector_func())

        # 清除所有缓存
        try:
            from backend.infrastructure import CacheManager
            count = CacheManager.clear_all()
            logger.info(f"clear_data", f"已清除 {count} 个缓存")
        except Exception as e:
            logger.error(f"清除缓存时出错: {e}")
            # 不抛出异常，因为数据已经清除成功

        return {
            "success": True,
            "message": "所有数据已清除",
            "cleared_paths": cleared_paths
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除数据失败: {str(e)}")
