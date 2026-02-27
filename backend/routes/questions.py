"""
问题相关API路由
使用 CacheManager 进行统一缓存管理
"""
from fastapi import APIRouter, Query
from typing import Dict, Any, List, Optional
import pandas as pd

from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path
from backend.infrastructure import CacheManager

router = APIRouter(prefix="/api/questions", tags=["questions"])

# 初始化repository
from backend.repositories.trajectory import TrajectoryRepository
_repository = TrajectoryRepository(get_db_path(), create_default_vector_func())


# 生成问题列表的缓存数据
def _compute_question_stats() -> List[Dict[str, Any]]:
    """计算问题统计（缓存未命中时调用）"""
    df = _repository.get_lightweight_df()

    if df.empty:
        return []

    # 获取分析数据
    analysis_df = _repository.get_analysis_df()

    question_stats = []
    for data_id in df['data_id'].unique():
        question_df = df[df['data_id'] == data_id]

        # 获取问题文本
        task_data = question_df.iloc[0]['task']
        if isinstance(task_data, dict):
            question_text = task_data.get('question', 'N/A')
        else:
            question_text = "N/A"

        # 获取训练信息（从第一条轨迹获取）
        first_traj = question_df.iloc[0]
        training_id = first_traj.get('training_id', '')
        epoch_id = int(first_traj.get('epoch_id', 0)) if pd.notna(first_traj.get('epoch_id')) else None
        iteration_id = int(first_traj.get('iteration_id', 0)) if pd.notna(first_traj.get('iteration_id')) else None
        sample_id = int(first_traj.get('sample_id', 0)) if pd.notna(first_traj.get('sample_id')) else None

        # 统计成功/失败
        if not analysis_df.empty:
            merged = question_df.merge(analysis_df, on='trajectory_id', how='left')
            merged['is_success'] = merged['is_success'].fillna(False)
            success_count = int(merged['is_success'].sum())
            total_count = len(merged)
        else:
            # 简单用reward > 0判断成功
            success_count = int((question_df['reward'] > 0).sum())
            total_count = len(question_df)

        rate = success_count / total_count if total_count > 0 else 0

        # 根据成功率确定难度
        if rate >= 0.7:
            difficulty = "Easy"
        elif rate >= 0.4:
            difficulty = "Medium"
        else:
            difficulty = "Hard"

        question_stats.append({
            "id": data_id,
            "question": question_text,
            "successCount": success_count,
            "totalCount": total_count,
            "rate": rate,
            "difficulty": difficulty,
            "training_id": training_id,
            "epoch_id": epoch_id,
            "iteration_id": iteration_id,
            "sample_id": sample_id
        })

    # 按data_id排序
    question_stats.sort(key=lambda x: x['id'])
    return question_stats


@router.get("", response_model=Dict[str, Any])
async def list_questions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100)
):
    """获取问题列表（带缓存）"""
    # 使用 CacheManager
    cache = CacheManager.get_or_create("questions.list", namespace="questions", maxsize=10, ttl=600)

    # 尝试从缓存获取完整列表
    cache_key = "all_questions"
    question_stats = cache.get(cache_key)

    if question_stats is None:
        # 缓存未命中，计算并存储
        question_stats = _compute_question_stats()
        cache[cache_key] = question_stats

    # 分页
    total = len(question_stats)
    start = (page - 1) * pageSize
    end = start + pageSize
    data = question_stats[start:end]

    return {
        "data": data,
        "total": total,
        "page": page,
        "pageSize": pageSize
    }


@router.get("/{question_id}/trajectories", response_model=Dict[str, Any])
async def get_question_trajectories(
    question_id: str,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    training_id: Optional[str] = Query(None, description="Filter by training ID"),
    epoch_id: Optional[int] = Query(None, description="Filter by epoch ID")
):
    """获取某个问题的所有轨迹，支持按 training_id 和 epoch_id 过滤"""
    # 构建过滤条件
    filters = {"questionId": question_id}
    if training_id:
        filters["training_id"] = training_id
    if epoch_id is not None:
        filters["epoch_id"] = epoch_id

    # 使用filter方法筛选
    trajectories = _repository.filter(filters, limit=pageSize * page)

    total = len(trajectories)
    start = (page - 1) * pageSize
    end = start + pageSize
    data = trajectories[start:end]

    return {
        "data": [t.dict() if hasattr(t, 'dict') else t for t in data],
        "total": total,
        "page": page,
        "pageSize": pageSize
    }


@router.get("/{question_id}/stats", response_model=Dict[str, Any])
async def get_question_stats(question_id: str):
    """获取单个问题的统计信息"""
    df = _repository.get_lightweight_df()

    if df.empty or question_id not in df['data_id'].values:
        return {"error": "Question not found"}

    question_df = df[df['data_id'] == question_id]
    analysis_df = _repository.get_analysis_df()

    # 获取问题文本
    task_data = question_df.iloc[0]['task']
    if isinstance(task_data, dict):
        question_text = task_data.get('question', 'N/A')
    else:
        question_text = "N/A"

    # 统计
    if not analysis_df.empty:
        merged = question_df.merge(analysis_df, on='trajectory_id', how='left')
        merged['is_success'] = merged['is_success'].fillna(False)
        success_count = int(merged['is_success'].sum())
        total_count = len(merged)
    else:
        success_count = int((question_df['reward'] > 0).sum())
        total_count = len(question_df)

    rate = success_count / total_count if total_count > 0 else 0

    # 确定难度
    if rate >= 0.7:
        difficulty = "Easy"
    elif rate >= 0.4:
        difficulty = "Medium"
    else:
        difficulty = "Hard"

    return {
        "id": question_id,
        "question": question_text,
        "successCount": success_count,
        "totalCount": total_count,
        "rate": rate,
        "difficulty": difficulty
    }
