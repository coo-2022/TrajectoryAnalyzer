"""
轨迹相关API路由
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any

from backend.models.trajectory import Trajectory
from backend.services.trajectory_service import TrajectoryService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/trajectories", tags=["trajectories"])

# 初始化服务
service = TrajectoryService(get_db_path(), create_default_vector_func())


@router.get("", response_model=Dict[str, Any])
async def list_trajectories(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    # 筛选参数
    trajectory_id: Optional[str] = None,
    data_id: Optional[str] = None,
    question: Optional[str] = None,
    agent_name: Optional[str] = None,
    termination_reason: Optional[str] = None,
    is_success: Optional[bool] = None,
    reward_min: Optional[float] = None,
    reward_max: Optional[float] = None,
    reward_exact: Optional[float] = None,
    toolcall_reward_min: Optional[float] = None,
    toolcall_reward_max: Optional[float] = None,
    toolcall_reward_exact: Optional[float] = None,
    res_reward_min: Optional[float] = None,
    res_reward_max: Optional[float] = None,
    res_reward_exact: Optional[float] = None,
    epoch_id: Optional[int] = None,
    iteration_id: Optional[int] = None,
    sample_id: Optional[int] = None,
    training_id: Optional[str] = None,
    is_bookmarked: Optional[bool] = None,
    step_count_min: Optional[int] = None,
    step_count_max: Optional[int] = None,
    exec_time_min: Optional[float] = None,
    exec_time_max: Optional[float] = None,
    # 排序参数
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = Query("desc", regex="^(asc|desc)$")
):
    """
    获取轨迹列表

    筛选参数说明：
    - trajectory_id: 轨迹ID精确匹配
    - data_id: 数据ID精确匹配
    - question: 问题文本模糊匹配
    - agent_name: Agent名称模糊匹配
    - termination_reason: 终止原因枚举（逗号分隔多选）
    - reward_min/max: reward范围筛选
    - reward_exact: reward精确匹配
    - toolcall_reward_min/max/exact: toolcall_reward范围/精确筛选
    - res_reward_min/max/exact: res_reward范围/精确筛选
    - epoch_id/iteration_id/sample_id: 精确匹配
    - training_id: training_id精确匹配
    - is_bookmarked: 是否收藏

    排序参数说明：
    - sort_by: 排序字段（reward, created_at, step_count, exec_time等）
    - sort_order: asc或desc
    """
    filters = {}
    if trajectory_id:
        filters["trajectory_id"] = trajectory_id
    if data_id:
        filters["data_id"] = data_id
    if question:
        filters["question"] = question
    if agent_name:
        filters["agent_name"] = agent_name
    if termination_reason:
        filters["termination_reason"] = termination_reason
    # is_success筛选在API层处理，不传递给repository
    if reward_min is not None:
        filters["reward_min"] = reward_min
    if reward_max is not None:
        filters["reward_max"] = reward_max
    if reward_exact is not None:
        filters["reward_exact"] = reward_exact
    if toolcall_reward_min is not None:
        filters["toolcall_reward_min"] = toolcall_reward_min
    if toolcall_reward_max is not None:
        filters["toolcall_reward_max"] = toolcall_reward_max
    if toolcall_reward_exact is not None:
        filters["toolcall_reward_exact"] = toolcall_reward_exact
    if res_reward_min is not None:
        filters["res_reward_min"] = res_reward_min
    if res_reward_max is not None:
        filters["res_reward_max"] = res_reward_max
    if res_reward_exact is not None:
        filters["res_reward_exact"] = res_reward_exact
    if epoch_id is not None:
        filters["epoch_id"] = epoch_id
    if iteration_id is not None:
        filters["iteration_id"] = iteration_id
    if sample_id is not None:
        filters["sample_id"] = sample_id
    if training_id:
        filters["training_id"] = training_id
    if is_bookmarked is not None:
        filters["is_bookmarked"] = is_bookmarked
    if step_count_min is not None:
        filters["step_count_min"] = step_count_min
    if step_count_max is not None:
        filters["step_count_max"] = step_count_max
    if exec_time_min is not None:
        filters["exec_time_min"] = exec_time_min
    if exec_time_max is not None:
        filters["exec_time_max"] = exec_time_max

    # 排序参数
    sort_params = None
    if sort_by:
        sort_params = {"field": sort_by, "order": sort_order}

    result = await service.list(page, pageSize, filters if filters else None, sort_params)

    # Get analysis data
    analysis_df = service.repository.get_analysis_df()

    # Build response with analysis data
    data_list = []
    for t in result.data:
        traj_dict = t.model_dump()

        # Add analysis data if available
        if not analysis_df.empty:
            analysis_row = analysis_df[analysis_df['trajectory_id'] == t.trajectory_id]
            if not analysis_row.empty:
                traj_dict['isSuccess'] = bool(analysis_row.iloc[0]['is_success'])
                traj_dict['category'] = analysis_row.iloc[0]['category']
                traj_dict['rootCause'] = analysis_row.iloc[0]['root_cause']
                traj_dict['step_count'] = len(t.steps)
            else:
                traj_dict['isSuccess'] = t.reward > 0
                traj_dict['category'] = ""
                traj_dict['rootCause'] = ""
                traj_dict['step_count'] = len(t.steps)
        else:
            traj_dict['isSuccess'] = t.reward > 0
            traj_dict['category'] = ""
            traj_dict['rootCause'] = ""
            traj_dict['step_count'] = len(t.steps)

        # Add questionId field for frontend
        traj_dict['questionId'] = t.data_id

        # Apply is_success filter if specified
        if is_success is not None and traj_dict['isSuccess'] != is_success:
            continue

        data_list.append(traj_dict)

    # 如果应用了is_success筛选，需要重新计算total
    # 因为筛选是在API层进行的，不是在数据库层
    if is_success is not None:
        # 对于第一页，计算完整的筛选后的total
        # 这里简化处理，返回当前筛选后的数据长度
        # 更准确的实现需要另外查询一次数据库获取总数
        total = len(data_list)
    else:
        total = result.total

    return {
        "data": data_list,
        "total": total,
        "page": result.page,
        "pageSize": result.page_size
    }


@router.get("/{trajectory_id}", response_model=Dict[str, Any])
async def get_trajectory(trajectory_id: str):
    """获取轨迹详情"""
    trajectory = await service.get(trajectory_id)
    if not trajectory:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    traj_dict = trajectory.model_dump()

    # Add analysis data if available
    analysis_df = service.repository.get_analysis_df()
    if not analysis_df.empty:
        analysis_row = analysis_df[analysis_df['trajectory_id'] == trajectory_id]
        if not analysis_row.empty:
            traj_dict['isSuccess'] = bool(analysis_row.iloc[0]['is_success'])
            traj_dict['category'] = analysis_row.iloc[0]['category']
            traj_dict['rootCause'] = analysis_row.iloc[0]['root_cause']
        else:
            traj_dict['isSuccess'] = trajectory.reward > 0
            traj_dict['category'] = ""
            traj_dict['rootCause'] = ""
    else:
        traj_dict['isSuccess'] = trajectory.reward > 0
        traj_dict['category'] = ""
        traj_dict['rootCause'] = ""

    # Add questionId field
    traj_dict['questionId'] = trajectory.data_id
    traj_dict['step_count'] = len(trajectory.steps)

    return traj_dict


@router.post("", response_model=Dict[str, Any], status_code=201)
async def create_trajectory(trajectory_data: Dict[str, Any]):
    """创建轨迹"""
    try:
        trajectory = await service.create(trajectory_data)
        return trajectory.model_dump()
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{trajectory_id}", response_model=Dict[str, Any])
async def update_trajectory(trajectory_id: str, updates: Dict[str, Any]):
    """更新轨迹"""
    trajectory = await service.update(trajectory_id, updates)
    if not trajectory:
        raise HTTPException(status_code=404, detail="Trajectory not found")
    return trajectory.model_dump()


@router.delete("/{trajectory_id}", status_code=204)
async def delete_trajectory(trajectory_id: str):
    """删除轨迹"""
    success = await service.delete(trajectory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trajectory not found")


@router.get("/search/q", response_model=Dict[str, Any])
async def search_trajectories(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100)
):
    """关键词搜索轨迹"""
    results = await service.search(q, limit)
    return {
        "data": [t.model_dump() for t in results],
        "total": len(results)
    }


@router.get("/similar/{question}", response_model=List[Dict[str, Any]])
async def find_similar_trajectories(
    question: str,
    limit: int = Query(10, ge=1, le=50)
):
    """查找相似轨迹"""
    results = await service.search_similar(question, limit)
    return [t.model_dump() for t in results]


@router.put("/{trajectory_id}/tags", response_model=Dict[str, Any])
async def add_tags(trajectory_id: str, tags: Dict[str, List[str]]):
    """添加标签"""
    success = False
    for tag in tags.get("tags", []):
        if await service.add_tag(trajectory_id, tag):
            success = True

    if not success:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    trajectory = await service.get(trajectory_id)
    return {"tags": trajectory.tags}


@router.delete("/{trajectory_id}/tags/{tag}", response_model=Dict[str, Any])
async def remove_tag(trajectory_id: str, tag: str):
    """删除标签"""
    success = await service.remove_tag(trajectory_id, tag)
    if not success:
        raise HTTPException(status_code=404, detail="Trajectory not found or tag not found")
    return {"message": "Tag removed"}


@router.put("/{trajectory_id}/bookmark", response_model=Dict[str, Any])
async def toggle_bookmark(trajectory_id: str):
    """切换收藏状态"""
    is_bookmarked = await service.toggle_bookmark(trajectory_id)
    if is_bookmarked is None:
        raise HTTPException(status_code=404, detail="Trajectory not found")
    return {"is_bookmarked": is_bookmarked}


@router.put("/{trajectory_id}/notes", response_model=Dict[str, Any])
async def update_notes(trajectory_id: str, notes_data: Dict[str, str]):
    """更新备注"""
    notes = notes_data.get("notes", "")
    success = await service.update_notes(trajectory_id, notes)
    if not success:
        raise HTTPException(status_code=404, detail="Trajectory not found")
    return {"message": "Notes updated"}
