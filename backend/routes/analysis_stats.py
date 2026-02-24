"""
统计分析路由
提供轨迹终止原因、工具返回、奖励分类、过程相关性等统计API
"""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional, List
import pandas as pd

from backend.services.analysis_stats_service import AnalysisStatsService
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/analysis-stats", tags=["analysis-stats"])
service = AnalysisStatsService()

# 初始化 repository
_repository = TrajectoryRepository(get_db_path(), create_default_vector_func())


@router.get("/termination-stats")
async def get_termination_stats() -> JSONResponse:
    """
    获取终止原因统计

    Returns:
        {
            "total": 总轨迹数,
            "categories": {
                "env_done": {"count": 数量, "ratio": 比例},
                "truncation": {"count": 数量, "ratio": 比例},
                "timeout": {"count": 数量, "ratio": 比例},
                "finish": {"count": 数量, "ratio": 比例}
            },
            "unexpected": {"count": 非正常终止数量, "ratio": 比例}
        }
    """
    data = service.get_termination_stats()
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/tool-return-stats")
async def get_tool_return_stats() -> JSONResponse:
    """
    获取工具返回统计

    Returns:
        {
            "total_tool_calls": 总工具调用次数,
            "categories": {
                "normal": {"count": 数量, "ratio": 比例},
                "empty": {"count": 数量, "ratio": 比例},
                "timeout": {"count": 数量, "ratio": 比例},
                "connection_error": {"count": 数量, "ratio": 比例}
            },
            "unexpected": {"count": 异常返回数量, "ratio": 比例}
        }
    """
    data = service.get_tool_return_stats()
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/unexpected-tool-contexts")
async def get_unexpected_tool_contexts(
    category: Optional[str] = Query(None, description="工具返回类别: empty, timeout, connection_error"),
    limit: int = Query(50, description="返回数量限制", ge=1, le=500)
) -> JSONResponse:
    """
    获取异常工具返回的上下文

    Args:
        category: 可选，过滤特定类别 (empty|timeout|connection_error)
        limit: 返回数量限制

    Returns:
        {
            "total": 总数,
            "data": [
                {
                    "trajectory_id": "轨迹ID",
                    "step_id": 步骤ID,
                    "action": "动作名称",
                    "observation": "观察结果",
                    "category": "类别",
                    "context": {"question": "问题", "step_number": 步骤编号}
                }
            ]
        }
    """
    data = service.get_unexpected_tool_contexts(category=category, limit=limit)
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/reward-category-stats")
async def get_reward_category_stats() -> JSONResponse:
    """
    获取奖励分类统计

    Returns:
        {
            "total": 总轨迹数,
            "max_reward": 最大奖励,
            "min_reward": 最小奖励,
            "avg_reward": 平均奖励,
            "categories": {
                "perfect_score": {"count": 数量, "ratio": 比例},
                "complete_failure": {"count": 数量, "ratio": 比例},
                "partial_success": {"count": 数量, "ratio": 比例}
            }
        }
    """
    data = service.get_reward_category_stats()
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/process-reward-correlation")
async def get_process_reward_correlation() -> JSONResponse:
    """
    获取过程奖励与最终奖励的相关性分析

    Returns:
        {
            "kendall_tau": Kendall相关系数,
            "p_value": 显著性水平,
            "sample_size": 样本数量,
            "interpretation": "相关性解释",
            "suggested_strategy": "建议策略 (beam_search|2.0)",
            "scatter_data": {
                "x": [平均过程奖励列表],
                "y": [最终奖励列表],
                "trajectory_ids": ["轨迹ID列表"]
            }
        }
    """
    data = service.get_process_reward_correlation()
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/latest-epoch")
async def get_latest_epoch_stats() -> JSONResponse:
    """
    获取最新一次 epoch 的统计数据

    Returns:
        {
            "latest_epoch": 最新 epoch_id,
            "total_trajectories": 该 epoch 的轨迹总数,
            "difficulty_distribution": {
                "easy": {"count": 数量, "ratio": 比例},
                "medium": {"count": 数量, "ratio": 比例},
                "hard": {"count": 数量, "ratio": 比例}
            },
            "top5_difficult": [
                {
                    "data_id": "问题ID",
                    "question": "问题文本",
                    "success_rate": 成功率,
                    "total_count": 轨迹数
                }
            ]
        }
    """
    df = _repository.get_lightweight_df()

    if df.empty:
        return JSONResponse(
            content={
                "latest_epoch": None,
                "total_trajectories": 0,
                "difficulty_distribution": {"easy": {"count": 0, "ratio": 0}, "medium": {"count": 0, "ratio": 0}, "hard": {"count": 0, "ratio": 0}},
                "top5_difficult": []
            },
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    # 获取最新 epoch
    latest_epoch = int(df['epoch_id'].max())

    # 过滤最新 epoch 的数据
    epoch_df = df[df['epoch_id'] == latest_epoch]

    # 按问题分组统计
    question_stats = []
    for data_id in epoch_df['data_id'].unique():
        question_df = epoch_df[epoch_df['data_id'] == data_id]

        # 获取问题文本
        task_data = question_df.iloc[0]['task']
        if isinstance(task_data, dict):
            question_text = task_data.get('question', 'N/A')
        else:
            question_text = "N/A"

        # 统计成功率（reward > 0 认为成功）
        success_count = int((question_df['reward'] > 0).sum())
        total_count = len(question_df)
        success_rate = success_count / total_count if total_count > 0 else 0

        question_stats.append({
            "data_id": data_id,
            "question": question_text,
            "success_rate": success_rate,
            "total_count": total_count
        })

    # 难度分布
    easy_count = sum(1 for q in question_stats if q['success_rate'] >= 0.7)
    medium_count = sum(1 for q in question_stats if 0.4 <= q['success_rate'] < 0.7)
    hard_count = sum(1 for q in question_stats if q['success_rate'] < 0.4)
    total_questions = len(question_stats)

    difficulty_distribution = {
        "easy": {"count": easy_count, "ratio": round(easy_count / total_questions, 2) if total_questions > 0 else 0},
        "medium": {"count": medium_count, "ratio": round(medium_count / total_questions, 2) if total_questions > 0 else 0},
        "hard": {"count": hard_count, "ratio": round(hard_count / total_questions, 2) if total_questions > 0 else 0}
    }

    # Top 5 困难问题（成功率最低）
    question_stats.sort(key=lambda x: x['success_rate'])
    top5_difficult = question_stats[:5]

    return JSONResponse(
        content={
            "latest_epoch": latest_epoch,
            "total_trajectories": len(epoch_df),
            "difficulty_distribution": difficulty_distribution,
            "top5_difficult": top5_difficult
        },
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
