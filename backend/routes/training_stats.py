"""
Training 统计 API 路由
提供 Epoch 和 Iteration 维度的训练统计数据
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from backend.services.training_stats_service import TrainingStatsService

router = APIRouter(prefix="/api/training-stats", tags=["training-stats"])

# 服务单例
_stats_service: Optional[TrainingStatsService] = None


def get_stats_service() -> TrainingStatsService:
    """获取统计服务实例（懒加载）"""
    global _stats_service
    if _stats_service is None:
        _stats_service = TrainingStatsService()
    return _stats_service


@router.get("/training-runs")
async def get_training_runs() -> JSONResponse:
    """
    获取所有 training_id 列表

    Returns:
        {"training_ids": ["train_1", "train_2", ...]}
    """
    service = get_stats_service()
    training_ids = service.get_training_runs()
    return JSONResponse({"training_ids": training_ids})


@router.get("/epoch-level")
async def get_epoch_level_stats(
    training_ids: Optional[str] = Query(None, description="逗号分隔的 training_id 列表")
) -> JSONResponse:
    """
    获取 Epoch 维度统计数据

    Args:
        training_ids: 可选，指定 training_id，多个用逗号分隔，不指定返回所有

    Returns:
        {
            "trainings": [
                {
                    "training_id": str,
                    "epochs": [
                        {
                            "epoch": int,
                            "pass_at_1": float,
                            "pass_at_k": float,
                            "avg_reward": float,
                            "success_rate": float
                        }
                    ]
                }
            ]
        }
    """
    service = get_stats_service()

    # 解析 training_ids 参数
    id_list = None
    if training_ids:
        id_list = [tid.strip() for tid in training_ids.split(",") if tid.strip()]

    result = service.get_epoch_level_stats(id_list)
    return JSONResponse(result)


@router.get("/iteration-level")
async def get_iteration_level_stats(
    training_id: str = Query(..., description="Training ID"),
    epoch_ids: Optional[str] = Query(None, description="逗号分隔的 epoch_id 列表")
) -> JSONResponse:
    """
    获取 Iteration 维度统计数据

    Args:
        training_id: 必需，指定 training_id
        epoch_ids: 可选，指定 epoch_id，多个用逗号分隔，不指定返回所有

    Returns:
        {
            "training_id": str,
            "epochs": [
                {
                    "epoch_id": int,
                    "iterations": [
                        {
                            "iteration": int,
                            "pass_at_1": float,
                            "pass_at_k": float,
                            "avg_reward": float,
                            "success_rate": float
                        }
                    ]
                }
            ]
        }
    """
    service = get_stats_service()

    # 解析 epoch_ids 参数
    epoch_list = None
    if epoch_ids:
        try:
            epoch_list = [int(eid.strip()) for eid in epoch_ids.split(",") if eid.strip()]
        except ValueError:
            return JSONResponse(
                {"error": "Invalid epoch_ids format"},
                status_code=400
            )

    result = service.get_iteration_level_stats(training_id, epoch_list)
    return JSONResponse(result)
