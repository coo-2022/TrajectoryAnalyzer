"""
导入结果模型
"""
import time
from typing import List, Optional
from pydantic import BaseModel, Field


class ImportResult(BaseModel):
    """导入结果"""
    success: bool = False
    task_id: str = Field(default_factory=lambda: f"import_{int(time.time())}")
    imported_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    status: str = "completed"  # pending, processing, completed, failed
    progress: int = 0  # 0-100
    created_at: float = Field(default_factory=time.time)
    completed_at: Optional[float] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "task_id": "import_1234567890",
                "imported_count": 10,
                "failed_count": 0,
                "skipped_count": 0,
                "errors": [],
                "warnings": [],
                "status": "completed",
                "progress": 100
            }
        }


class ImportError(BaseModel):
    """导入错误详情"""
    trajectory_id: Optional[str] = None
    index: int
    error_message: str
    error_type: str


class ImportHistory(BaseModel):
    """导入历史记录"""
    task_id: str
    file_name: str
    imported_count: int
    failed_count: int
    status: str
    created_at: float
    completed_at: Optional[float] = None
