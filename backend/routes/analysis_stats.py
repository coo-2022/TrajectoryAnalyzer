"""
统计分析路由
提供轨迹终止原因、工具返回、奖励分类、过程相关性等统计API
"""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional

from backend.services.analysis_stats_service import AnalysisStatsService

router = APIRouter(prefix="/api/analysis-stats", tags=["analysis-stats"])
service = AnalysisStatsService()


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
