"""
分析结果模型
"""
import time
from typing import List, Optional
from pydantic import BaseModel, Field


class AnalysisResult(BaseModel):
    """分析结果"""
    trajectory_id: str
    is_success: bool
    category: str = ""
    root_cause: str = ""
    suggestion: str = ""
    analyzed_at: float = Field(default_factory=time.time)

    class Config:
        json_schema_extra = {
            "example": {
                "trajectory_id": "traj_001",
                "is_success": True,
                "category": "4. Model Capability Issue",
                "root_cause": "4.0 Unknown Error",
                "suggestion": "建议增加重试机制",
                "analyzed_at": 1234567890.0
            }
        }


class AnalysisStatistics(BaseModel):
    """分析统计"""
    total_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    pass_at_1: float = 0.0  # 首次尝试成功率
    pass_at_k: float = 0.0  # 至少一次成功率
    avg_reward: float = 0.0
    avg_exec_time: float = 0.0


class FailureDistribution(BaseModel):
    """失败原因分布"""
    category: str
    count: int
    percentage: float


class AnalysisReport(BaseModel):
    """分析报告"""
    statistics: AnalysisStatistics
    failures: List[FailureDistribution]
    top_failure_reasons: List[dict]
    generated_at: float = Field(default_factory=time.time)
