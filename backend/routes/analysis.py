"""
分析相关API路由
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from backend.models.analysis import AnalysisResult, AnalysisStatistics
from backend.services.analysis_service import AnalysisService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# 初始化服务
service = AnalysisService(get_db_path(), create_default_vector_func())


@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_trajectory(data: Dict[str, str]):
    """分析单个轨迹"""
    trajectory_id = data.get("trajectory_id")
    if not trajectory_id:
        raise HTTPException(status_code=422, detail="trajectory_id is required")

    # 这里需要先获取轨迹数据，然后分析
    # 简化实现，直接返回示例
    # TODO: 实现完整的分析流程

    # 获取轨迹
    trajectory = service.repository.get(trajectory_id)
    if not trajectory:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    # 转换为字典进行分析
    traj_dict = trajectory.model_dump()
    result = await service.analyze_trajectory(traj_dict)

    return result.model_dump()


@router.get("/stats", response_model=Dict[str, Any])
async def get_statistics():
    """获取全局统计"""
    stats = await service.get_statistics()
    return stats.model_dump()


@router.get("/{trajectory_id}", response_model=Dict[str, Any])
async def get_analysis_result(trajectory_id: str):
    """获取分析结果"""
    result = await service.get_analysis(trajectory_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result.model_dump()


@router.post("/batch", response_model=Dict[str, Any], status_code=202)
async def batch_analyze(data: Dict[str, Any]):
    """批量分析轨迹"""
    trajectory_ids = data.get("trajectory_ids", [])

    if not trajectory_ids:
        raise HTTPException(status_code=422, detail="trajectory_ids is required")

    # 获取轨迹数据
    trajectories = []
    for traj_id in trajectory_ids:
        traj = service.repository.get(traj_id)
        if traj:
            trajectories.append(traj.model_dump())

    # 执行分析
    results = await service.batch_analyze(trajectories)

    return {
        "task_id": f"batch_analyze_{int(__import__('time').time())}",
        "total": len(trajectories),
        "analyzed": len(results),
        "results": [r.model_dump() for r in results]
    }


@router.get("/failures/distribution", response_model=List[Dict[str, Any]])
async def get_failure_distribution():
    """获取失败原因分布"""
    distribution = await service.get_failure_distribution()
    return [d.model_dump() for d in distribution]


@router.get("/failures/category/{category}", response_model=List[Dict[str, Any]])
async def filter_by_category(category: str):
    """按失败类别筛选"""
    trajectories = await service.filter_by_category(category)
    return [t.model_dump() for t in trajectories]


@router.get("/report", response_model=Dict[str, Any])
async def generate_report():
    """生成分析报告"""
    report = await service.generate_report()
    return report
