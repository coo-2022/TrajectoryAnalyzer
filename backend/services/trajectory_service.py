"""
Trajectory业务服务
"""
import hashlib
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel

from backend.models.trajectory import Trajectory, TrajectoryListResponse, TrajectoryFilter
from backend.models.analysis import AnalysisStatistics
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import settings, get_db_path


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

        # 缓存配置
        self.cache_enabled = True
        self.cache_ttl = 300  # 5分钟缓存
        self.cache_max_size = 1000  # 最大缓存条目数
        self._cache: Dict[str, Tuple[Any, float]] = {}  # {cache_key: (data, expire_time)}
        self._stats_cache: Optional[Tuple[AnalysisStatistics, float]] = None
        self._stats_cache_ttl = 60  # 统计数据缓存60秒

    def _make_cache_key(
        self,
        page: int,
        page_size: int,
        filters: Optional[Dict[str, Any]] = None,
        sort_params: Optional[Dict[str, str]] = None
    ) -> str:
        """生成缓存键

        Args:
            page: 页码
            page_size: 每页大小
            filters: 筛选条件
            sort_params: 排序参数

        Returns:
            MD5哈希缓存键
        """
        cache_data = {
            "page": page,
            "page_size": page_size,
            "filters": self._normalize_filters_for_cache(filters),
            "sort_params": sort_params
        }
        cache_str = json.dumps(cache_data, sort_keys=True, default=str)
        return hashlib.md5(cache_str.encode()).hexdigest()

    def _normalize_filters_for_cache(self, filters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """规范化筛选条件用于缓存（处理None值）

        Args:
            filters: 原始筛选条件

        Returns:
            规范化后的筛选条件
        """
        if not filters:
            return {}

        # 移除None值，确保相同条件生成相同键
        return {k: v for k, v in filters.items() if v is not None}

    def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """从缓存获取数据

        Args:
            cache_key: 缓存键

        Returns:
            缓存的数据，如果不存在或已过期返回None
        """
        if not self.cache_enabled:
            return None

        if cache_key in self._cache:
            data, expire_time = self._cache[cache_key]
            if time.time() < expire_time:
                return data
            else:
                # 缓存过期，删除
                del self._cache[cache_key]

        return None

    def _set_cache(self, cache_key: str, data: Any) -> None:
        """设置缓存

        Args:
            cache_key: 缓存键
            data: 要缓存的数据
        """
        if not self.cache_enabled:
            return

        # 如果缓存已满，删除最旧的条目
        if len(self._cache) >= self.cache_max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]

        expire_time = time.time() + self.cache_ttl
        self._cache[cache_key] = (data, expire_time)

    def invalidate_cache(self) -> None:
        """清除所有缓存"""
        self._cache.clear()

    def invalidate_cache_on_change(self) -> None:
        """数据变更时清除缓存（供外部调用）"""
        self.invalidate_cache()

    async def create(self, trajectory_data: Dict[str, Any]) -> Trajectory:
        """创建轨迹"""
        trajectory = Trajectory(**trajectory_data)
        trajectory.created_at = time.time()
        trajectory.updated_at = time.time()

        self.repository.add(trajectory)
        self.invalidate_cache()  # 清除缓存
        return trajectory

    async def get(self, trajectory_id: str) -> Optional[Trajectory]:
        """获取轨迹详情"""
        return self.repository.get(trajectory_id)

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
        # 检查缓存
        cache_key = self._make_cache_key(page, page_size, filters, sort_params)
        cached_result = self._get_from_cache(cache_key)

        if cached_result is not None:
            return cached_result

        # 缓存未命中，执行查询
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

        result = PaginatedResult(
            data=data,
            total=total,
            page=page,
            page_size=page_size
        )

        # 存入缓存
        self._set_cache(cache_key, result)

        return result

    async def update(self, trajectory_id: str, updates: Dict[str, Any]) -> Optional[Trajectory]:
        """更新轨迹"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return None

        # 更新字段
        for key, value in updates.items():
            if hasattr(trajectory, key):
                setattr(trajectory, key, value)
        trajectory.updated_at = time.time()

        # 删除旧的，添加新的
        self.repository.delete(trajectory_id)
        self.repository.add(trajectory)
        self.invalidate_cache()  # 清除缓存

        return trajectory

    async def delete(self, trajectory_id: str) -> bool:
        """删除轨迹"""
        try:
            self.repository.delete(trajectory_id)
            self.invalidate_cache()  # 清除缓存
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

    async def get_statistics(self) -> AnalysisStatistics:
        """获取统计信息（带缓存）"""
        # 检查缓存
        if self._stats_cache is not None:
            stats, expire_time = self._stats_cache
            if time.time() < expire_time:
                return stats

        # 缓存未命中，计算统计信息
        df = self.repository.get_lightweight_df()
        analysis_df = self.repository.get_analysis_df()

        if df.empty:
            return AnalysisStatistics()

        total_count = len(df)

        # 计算成功率
        merged_df = df.merge(analysis_df, on='trajectory_id', how='left')
        merged_df['is_success'] = merged_df['is_success'].fillna(False)
        success_count = int(merged_df['is_success'].sum())
        failure_count = total_count - success_count

        # Pass@1: 每个问题的平均成功率
        question_stats = merged_df.groupby('trajectory_id')['is_success'].mean()
        pass_at_1 = float(question_stats.mean()) if len(question_stats) > 0 else 0.0

        # Pass@K: 每个问题至少一次成功的比例
        pass_at_k = float(merged_df['is_success'].max()) if total_count > 0 else 0.0

        # 平均值
        avg_reward = float(df['reward'].mean()) if 'reward' in df.columns else 0.0
        avg_exec_time = float(df['exec_time'].mean()) if 'exec_time' in df.columns else 0.0

        stats = AnalysisStatistics(
            total_count=total_count,
            success_count=success_count,
            failure_count=failure_count,
            pass_at_1=pass_at_1,
            pass_at_k=pass_at_k,
            avg_reward=avg_reward,
            avg_exec_time=avg_exec_time
        )

        # 存入缓存
        self._stats_cache = (stats, time.time() + self._stats_cache_ttl)

        return stats

    async def add_tag(self, trajectory_id: str, tag: str) -> bool:
        """添加标签"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory:
            return False

        if tag not in trajectory.tags:
            trajectory.tags.append(tag)

        tags_json = __import__('json').dumps(trajectory.tags, ensure_ascii=False)
        self.repository.update_metadata(trajectory_id, {"tags_json": tags_json})
        return True

    async def remove_tag(self, trajectory_id: str, tag: str) -> bool:
        """删除标签"""
        trajectory = self.repository.get(trajectory_id)
        if not trajectory or tag not in trajectory.tags:
            return False

        trajectory.tags.remove(tag)
        tags_json = __import__('json').dumps(trajectory.tags, ensure_ascii=False)
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
        return await self.list(
            page=1,
            page_size=limit,
            filters={"is_bookmarked": True}
        )
