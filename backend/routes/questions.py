"""
问题相关API路由
"""
from fastapi import APIRouter, Query
from typing import Dict, Any, List, Optional
import pandas as pd
import time

from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/questions", tags=["questions"])

# 初始化repository
from backend.repositories.trajectory import TrajectoryRepository
_repository = TrajectoryRepository(get_db_path(), create_default_vector_func())

# ==========================================
# 缓存配置
# ==========================================
_questions_cache = {
    "data": None,
    "expire_time": 0
}
_QUESTIONS_CACHE_TTL = 60  # 60秒缓存


@router.get("", response_model=Dict[str, Any])
async def list_questions(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100)
):
    """获取问题列表（带缓存）"""
    # 检查缓存
    current_time = time.time()
    if _questions_cache["data"] is not None and current_time < _questions_cache["expire_time"]:
        # 缓存命中，直接分页返回
        question_stats = _questions_cache["data"]
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

    # 缓存未命中，重新计算
    # 获取所有轨迹数据
    df = _repository.get_lightweight_df()

    if df.empty:
        return {"data": [], "total": 0, "page": page, "pageSize": pageSize}

    # 按data_id分组统计
    question_stats = []

    # 获取分析数据
    analysis_df = _repository.get_analysis_df()

    for data_id in df['data_id'].unique():
        question_df = df[df['data_id'] == data_id]

        # 获取问题文本
        task_data = question_df.iloc[0]['task']
        if isinstance(task_data, dict):
            question_text = task_data.get('question', 'N/A')
        else:
            question_text = "N/A"

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
            "difficulty": difficulty
        })

    # 按data_id排序
    question_stats.sort(key=lambda x: x['id'])

    # 存入缓存
    _questions_cache["data"] = question_stats
    _questions_cache["expire_time"] = current_time + _QUESTIONS_CACHE_TTL

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
    pageSize: int = Query(20, ge=1, le=100)
):
    """获取某个问题的所有轨迹"""
    # 使用filter方法筛选
    trajectories = _repository.filter({"questionId": question_id}, limit=pageSize * page)

    total = len(trajectories)
    start = (page - 1) * pageSize
    end = start + pageSize
    data = trajectories[start:end]

    return {
        "data": [t.model_dump() for t in data],
        "total": total,
        "page": page,
        "pageSize": pageSize
    }
