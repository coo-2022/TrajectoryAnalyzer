"""
可视化相关API路由
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any

from backend.services.visualization_service import VisualizationService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/viz", tags=["visualization"])

# 初始化服务
service = VisualizationService(get_db_path(), create_default_vector_func())


@router.get("/timeline/{trajectory_id}", response_model=Dict[str, Any])
async def get_timeline(trajectory_id: str, include_all_metrics: bool = False):
    """获取时序图数据"""
    timeline = await service.get_timeline_data(trajectory_id, include_all_metrics)
    if "error" in timeline:
        raise HTTPException(status_code=404, detail=timeline["error"])
    return timeline


@router.get("/flow/{trajectory_id}", response_model=Dict[str, Any])
async def get_flow(trajectory_id: str):
    """获取流程图数据"""
    flow = await service.get_flow_data(trajectory_id)
    if "error" in flow:
        raise HTTPException(status_code=404, detail=flow["error"])
    return flow


@router.get("/stats", response_model=Dict[str, Any])
async def get_stats_charts():
    """获取所有统计图表数据"""
    charts = await service.get_stats_charts()
    return charts


@router.get("/overview", response_model=Dict[str, Any])
async def get_overview():
    """获取概览统计"""
    overview = await service.get_overview_stats()
    return overview


@router.get("/failures", response_model=Dict[str, Any])
async def get_failure_chart():
    """获取失败分布图"""
    distribution = await service.get_failure_distribution()
    return {"distribution": distribution}


@router.get("/reward-trend", response_model=Dict[str, Any])
async def get_reward_trend():
    """获取Reward趋势图"""
    trend = await service.get_reward_trend()
    return trend


@router.get("/agent-comparison", response_model=Dict[str, Any])
async def get_agent_comparison():
    """获取Agent对比图"""
    comparison = await service.get_agent_comparison()
    return {"comparison": comparison}


@router.get("/difficulty", response_model=Dict[str, Any])
async def get_difficulty_distribution():
    """获取难度分布"""
    difficulty = await service.get_difficulty_distribution()
    return difficulty


@router.get("/network", response_model=Dict[str, Any])
async def get_network_graph(limit: int = Query(10, ge=1, le=50)):
    """获取关系网络图"""
    network = await service.get_similarity_network(limit)
    return network


@router.get("/export/{chart_type}/{trajectory_id}", response_model=Dict[str, Any])
async def export_chart_config(chart_type: str, trajectory_id: str):
    """导出图表配置"""
    config = await service.export_chart_config(chart_type, trajectory_id)
    if "error" in config:
        raise HTTPException(status_code=400, detail=config["error"])
    return config
