"""
Trajectory业务服务
使用 CacheManager 进行统一缓存管理
"""
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.models.trajectory import Trajectory, TrajectoryListResponse, TrajectoryFilter
from backend.models.analysis import AnalysisStatistics
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import settings, get_db_path
from backend.infrastructure import CacheManager


class PaginatedResult(BaseModel):
    """分页结果"""
    data: List[Trajectory]
    total: int
    page: int
    page_size: int


class TrajectoryService:
    """轨迹业务服务"""

    def __init__(self, db_uri: Optional[str] = None, vector_func=None):
        self.db_uri = db_uri or get_db_path()
        self.vector_func = vector_func or create_default_vector_func()
        self.repository = TrajectoryRepository(self.db_uri, self.vector_func)

    def _make_list_cache_key(
        self,
        page: int,
        page_size: int,
        filters: Optional[Dict[str, Any]] = None,
        sort_params: Optional[Dict[str, str]] = None
    ) -> tuple:
        """生成列表查询的缓存键"""
        # 规范化 filters，移除 None 值
        normalized_filters = {k: v for k, v in (filters or {}).items() if v is not None}
        # 使用元组作为缓存键（cachetools 自动处理）
        return (page, page_size, json.dumps(normalized_filters, sort_keys=True), json.dumps(sort_params, sort_keys=True))

    @CacheManager.cached(
        "trajectory.list",
        key_func=lambda *args, **kwargs: (
            args[1] if len(args) > 1 else kwargs.get('page', 1),  # page
            args[2] if len(args) > 2 else kwargs.get('page_size', 20),  # page_size
            json.dumps({k: v for k, v in (kwargs.get('filters') or {}).items() if v is not None}, sort_keys=True),
            json.dumps(kwargs.get('sort_params'), sort_keys=True)
        )
    )
    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        sort_params: Optional[Dict[str, str]] = None
    ) -> PaginatedResult:
        """获取轨迹列表（带缓存）

        Args:
            page: 页码
            page_size: 每页大小
            filters: 筛选条件
            sort_params: 排序参数 {"field": "field_name", "order": "asc"/"desc"}
        """
        offset = (page - 1) * page_size

        # 使用新的原生查询方法
        data = self.repository.get_paginated(
            offset=offset,
            limit=page_size,
            filters=filters,
            sort_params=sort_params
        )

        # 使用新的count方法获取总数
        total = self.repository.count(filters=filters)

        return PaginatedResult(
            data=data,
            total=total,
            page=page,
            page_size=page_size
        )

    @CacheManager.cached("trajectory.stats")
    async def get_statistics(self) -> AnalysisStatistics:
        """获取统计信息（带缓存）"""
        # 缓存未命中，计算统计信息
        df = self.repository.get_lightweight_df()
        analysis_df = self.repository.get_analysis_df()

        if df.empty:
            return AnalysisStatistics()

        total_count = len(df)

        # 计算成功率
        if not analysis_df.empty:
            # 如果有分析结果，使用分析结果
            merged_df = df.merge(analysis_df, on='trajectory_id', how='left')
            merged_df['is_success'] = merged_df['is_success'].fillna(False)
            success_count = int(merged_df['is_success'].sum())
            failure_count = total_count - success_count

            # Pass@1: 每个问题(data_id)的平均成功率
            question_stats = merged_df.groupby('data_id')['is_success'].mean()
            pass_at_1 = float(question_stats.mean()) if len(question_stats) > 0 else 0.0

            # Pass@K: 每个问题至少一次成功的比例
            pass_at_k = float(question_stats[question_stats > 0].count() / len(question_stats)) if len(question_stats) > 0 else 0.0
        else:
            # 如果没有分析结果，使用reward>0作为成功标准
            success_count = int((df['reward'] > 0).sum())
            failure_count = total_count - success_count

            # 按data_id分组计算成功率
            question_stats = df.groupby('data_id').agg({
                'reward': [('success', lambda x: (x > 0).mean()), ('count', 'count')]
            })
            question_stats.columns = question_stats.columns.droplevel(0)
            pass_at_1 = float(question_stats['success'].mean()) if len(question_stats) > 0 else 0.0
            pass_at_k = float((question_stats['success'] > 0).sum() / len(question_stats)) if len(question_stats) > 0 else 0.0

        # 平均值
        avg_reward = float(df['reward'].mean()) if 'reward' in df.columns else 0.0
        avg_exec_time = float(df['exec_time'].mean()) if 'exec_time' in df.columns else 0.0

        return AnalysisStatistics(
            total_count=total_count,
            success_count=success_count,
            failure_count=failure_count,
            pass_at_1=pass_at_1,
            pass_at_k=pass_at_k,
            avg_reward=avg_reward,
            avg_exec_time=avg_exec_time
        )

    async def create(self, trajectory_data: Dict[str, Any]) -> Trajectory:
        """创建轨迹"""
        trajectory = Trajectory(**trajectory_data)
        trajectory.created_at = __import__('time').time()
        trajectory.updated_at = __import__('time').time()

        self.repository.add(trajectory)
        # 清除相关缓存（由 CacheManager 统一管理）
        CacheManager.clear_namespace("trajectory")
        return trajectory

    async def get(self, trajectory_id: str) -> Optional[Trajectory]:
        """获取轨迹详情"""
        return self.repository.get(trajectory_id)

    async def update(self, trajectory_id: str, updates: Dict[str, Any]) -> Optional[Trajectory]:
        """更新轨迹"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return None

        # 更新字段
        for key, value in updates.items():
            if hasattr(trajectory, key):
                setattr(trajectory, key, value)
        trajectory.updated_at = __import__('time').time()

        # 删除旧的，添加新的
        self.repository.delete(trajectory_id)
        self.repository.add(trajectory)
        CacheManager.clear_namespace("trajectory")

        return trajectory

    async def delete(self, trajectory_id: str) -> bool:
        """删除轨迹"""
        try:
            self.repository.delete(trajectory_id)
            CacheManager.clear_namespace("trajectory")
            return True
        except Exception:
            return False

    async def search(self, keyword: str, limit: int = 20) -> List[Trajectory]:
        """关键词搜索"""
        all_trajectories = self.repository.get_all(limit=10000)
        keyword_lower = keyword.lower()

        results = []
        for traj in all_trajectories:
            question = traj.get_question().lower()
            gt = traj.get_ground_truth().lower()

            if keyword_lower in question or keyword_lower in gt:
                results.append(traj)
                if len(results) >= limit:
                    break

        return results

    async def search_similar(self, question: str, limit: int = 10) -> List[Trajectory]:
        """向量搜索相似轨迹"""
        vector = self.vector_func(question)
        return self.repository.search_similar(vector, limit)

    async def add_tag(self, trajectory_id: str, tag: str) -> bool:
        """添加标签"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return False

        if tag not in trajectory.tags:
            trajectory.tags.append(tag)

        tags_json = json.dumps(trajectory.tags, ensure_ascii=False)
        self.repository.update_metadata(trajectory_id, {"tags_json": tags_json})
        return True

    async def remove_tag(self, trajectory_id: str, tag: str) -> bool:
        """删除标签"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory or tag not in trajectory.tags:
            return False

        trajectory.tags.remove(tag)
        tags_json = json.dumps(trajectory.tags, ensure_ascii=False)
        self.repository.update_metadata(trajectory_id, {"tags_json": tags_json})
        return True

    async def toggle_bookmark(self, trajectory_id: str) -> Optional[bool]:
        """切换收藏状态"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return None

        trajectory.is_bookmarked = not trajectory.is_bookmarked
        self.repository.update_metadata(
            trajectory_id,
            {"is_bookmarked": trajectory.is_bookmarked}
        )
        return trajectory.is_bookmarked

    async def update_notes(self, trajectory_id: str, notes: str) -> bool:
        """更新备注"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return False

        trajectory.notes = notes
        self.repository.update_metadata(trajectory_id, {"notes": notes})
        return True

    async def filter_by_tags(self, tags: List[str], limit: int = 100) -> List[Trajectory]:
        """按标签筛选"""
        all_trajectories = self.repository.get_all(limit=limit * 2)

        results = []
        for traj in all_trajectories:
            if any(tag in traj.tags for tag in tags):
                results.append(traj)
                if len(results) >= limit:
                    break

        return results

    async def get_bookmarked(self, limit: int = 100) -> List[Trajectory]:
        """获取收藏的轨迹"""
        return (await self.list(
            page=1,
            page_size=limit,
            filters={"is_bookmarked": True}
        )).data

