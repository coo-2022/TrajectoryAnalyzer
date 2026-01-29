"""
导入相关API路由
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from typing import Dict, Any

from backend.models.import_result import ImportResult
from backend.services.import_service import ImportService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/import", tags=["import"])

# 初始化服务
service = ImportService(get_db_path(), create_default_vector_func())


@router.post("/json", response_model=Dict[str, Any], status_code=202)
async def import_json_file(file: UploadFile = File(...)):
    """导入JSON文件"""
    # 保存上传的文件
    import tempfile
    import os

    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # 执行导入
        result = await service.import_from_json(temp_file_path)

        # 删除临时文件
        os.unlink(temp_file_path)

        return result.model_dump()

    except Exception as e:
        # 清理临时文件
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

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
