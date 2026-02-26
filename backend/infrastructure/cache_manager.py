"""
统一缓存管理器
基于 cachetools 的中心化缓存管理
"""
from typing import Any, Dict, Optional, Callable, List
from functools import wraps
from cachetools import TTLCache, LRUCache
from cachetools.keys import hashkey
import asyncio
import logging

logger = logging.getLogger(__name__)


class CacheManager:
    """
    统一缓存管理器

    管理所有缓存实例，支持：
    1. 按命名空间管理缓存
    2. 批量清除
    3. 统计信息
    4. 装饰器支持

    使用示例：
        # 1. 注册缓存
        CacheManager.register("trajectory_list", TTLCache(maxsize=1000, ttl=300))
        CacheManager.register("trajectory_stats", TTLCache(maxsize=10, ttl=60))

        # 2. 装饰器使用
        @CacheManager.cached("trajectory_list", key_func=lambda page, size, **kw: (page, size))
        async def list_trajectories(page, page_size, filters=None):
            return await fetch_from_db(...)

        # 3. 手动使用
        cache = CacheManager.get("trajectory_list")
        result = cache.get(key)
        cache[key] = result

        # 4. 批量清除
        CacheManager.clear_namespace("trajectory")  # 清除所有以 trajectory 开头的缓存
        CacheManager.clear_all()  # 清除所有缓存
    """

    _caches: Dict[str, Any] = {}
    _namespaces: Dict[str, List[str]] = {}  # 命名空间 -> 缓存名称列表
    _default_maxsize = 1000
    _default_ttl = 300

    @classmethod
    def register(
        cls,
        name: str,
        cache: Optional[Any] = None,
        namespace: Optional[str] = None,
        maxsize: int = None,
        ttl: int = None,
        cache_type: str = "ttl"
    ) -> Any:
        """
        注册缓存实例

        Args:
            name: 缓存名称
            cache: 自定义缓存实例，None则自动创建
            namespace: 命名空间，用于批量清除
            maxsize: 最大条目数（自动创建时）
            ttl: 过期时间秒数（自动创建时）
            cache_type: 缓存类型 ttl|lru

        Returns:
            缓存实例
        """
        if cache is None:
            maxsize = maxsize or cls._default_maxsize
            ttl = ttl or cls._default_ttl

            if cache_type == "ttl":
                cache = TTLCache(maxsize=maxsize, ttl=ttl)
            elif cache_type == "lru":
                cache = LRUCache(maxsize=maxsize)
            else:
                raise ValueError(f"Unknown cache type: {cache_type}")

        cls._caches[name] = cache

        # 注册到命名空间
        if namespace:
            if namespace not in cls._namespaces:
                cls._namespaces[namespace] = []
            if name not in cls._namespaces[namespace]:
                cls._namespaces[namespace].append(name)

        logger.debug(f"Registered cache: {name} (namespace: {namespace})")
        return cache

    @classmethod
    def get(cls, name: str) -> Any:
        """获取缓存实例"""
        if name not in cls._caches:
            raise KeyError(f"Cache '{name}' not found. Register it first.")
        return cls._caches[name]

    @classmethod
    def get_or_create(
        cls,
        name: str,
        namespace: Optional[str] = None,
        maxsize: int = None,
        ttl: int = None,
        cache_type: str = "ttl"
    ) -> Any:
        """获取缓存，不存在则自动创建"""
        if name not in cls._caches:
            return cls.register(name, namespace=namespace, maxsize=maxsize, ttl=ttl, cache_type=cache_type)
        return cls._caches[name]

    @classmethod
    def clear(cls, name: str) -> bool:
        """清除指定缓存"""
        if name in cls._caches:
            cls._caches[name].clear()
            logger.debug(f"Cleared cache: {name}")
            return True
        return False

    @classmethod
    def clear_namespace(cls, namespace: str) -> int:
        """清除命名空间下所有缓存"""
        count = 0
        if namespace in cls._namespaces:
            for name in cls._namespaces[namespace]:
                if cls.clear(name):
                    count += 1
        # 同时匹配以 namespace 开头的缓存名称
        for name in list(cls._caches.keys()):
            if name.startswith(f"{namespace}_") or name.startswith(f"{namespace}."):
                if cls.clear(name):
                    count += 1
        logger.info(f"Cleared {count} caches in namespace: {namespace}")
        return count

    @classmethod
    def clear_all(cls) -> int:
        """清除所有缓存"""
        count = len(cls._caches)
        for name in list(cls._caches.keys()):
            cls._caches[name].clear()
        logger.info(f"Cleared all {count} caches")
        return count

    @classmethod
    def get_stats(cls) -> Dict[str, Dict[str, Any]]:
        """获取所有缓存统计信息"""
        stats = {}
        for name, cache in cls._caches.items():
            cache_stats = {
                "size": len(cache),
                "maxsize": getattr(cache, "maxsize", "N/A"),
                "currsize": getattr(cache, "currsize", len(cache)),
            }
            if hasattr(cache, "ttl"):
                cache_stats["ttl"] = cache.ttl
            stats[name] = cache_stats
        return stats

    @classmethod
    def cached(
        cls,
        cache_name: str,
        key_func: Optional[Callable] = None,
        namespace: Optional[str] = None,
        maxsize: int = None,
        ttl: int = None
    ):
        """
        缓存装饰器

        Args:
            cache_name: 缓存名称
            key_func: 自定义缓存键生成函数，默认为 hashkey
            namespace: 命名空间
            maxsize: 最大条目数（自动创建时）
            ttl: 过期时间（自动创建时）

        使用示例：
            @CacheManager.cached("trajectory_list", key_func=lambda page, size: (page, size))
            async def list_trajectories(page, page_size, filters=None):
                return await fetch_from_db(...)
        """
        def decorator(func):
            # 确保缓存存在
            cache = cls.get_or_create(cache_name, namespace=namespace, maxsize=maxsize, ttl=ttl)

            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                # 生成缓存键
                if key_func:
                    try:
                        cache_key = key_func(*args, **kwargs)
                        if not isinstance(cache_key, tuple):
                            cache_key = (cache_key,)
                    except Exception as e:
                        logger.warning(f"key_func failed: {e}, using default")
                        cache_key = hashkey(*args, **kwargs)
                else:
                    cache_key = hashkey(*args, **kwargs)

                # 尝试从缓存获取
                if cache_key in cache:
                    logger.debug(f"Cache hit: {cache_name} key={cache_key}")
                    return cache[cache_key]

                # 执行函数
                result = await func(*args, **kwargs)

                # 存入缓存
                cache[cache_key] = result
                logger.debug(f"Cache set: {cache_name} key={cache_key}")
                return result

            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                # 生成缓存键
                if key_func:
                    try:
                        cache_key = key_func(*args, **kwargs)
                        if not isinstance(cache_key, tuple):
                            cache_key = (cache_key,)
                    except Exception as e:
                        logger.warning(f"key_func failed: {e}, using default")
                        cache_key = hashkey(*args, **kwargs)
                else:
                    cache_key = hashkey(*args, **kwargs)

                # 尝试从缓存获取
                if cache_key in cache:
                    logger.debug(f"Cache hit: {cache_name} key={cache_key}")
                    return cache[cache_key]

                # 执行函数
                result = func(*args, **kwargs)

                # 存入缓存
                cache[cache_key] = result
                logger.debug(f"Cache set: {cache_name} key={cache_key}")
                return result

            # 根据函数类型返回对应的 wrapper
            if asyncio.iscoroutinefunction(func):
                wrapper = async_wrapper
            else:
                wrapper = sync_wrapper

            # 附加缓存操作方法
            wrapper.cache_clear = cache.clear
            wrapper.cache_info = lambda: {
                "name": cache_name,
                "size": len(cache),
                "maxsize": getattr(cache, "maxsize", "N/A")
            }

            return wrapper
        return decorator


# 预定义常用缓存配置
CACHE_CONFIGS = {
    # 轨迹列表查询缓存：5分钟，最多1000条
    "trajectory.list": {"namespace": "trajectory", "maxsize": 1000, "ttl": 300},

    # 轨迹统计缓存：1分钟，最多10条
    "trajectory.stats": {"namespace": "trajectory", "maxsize": 10, "ttl": 60},

    # 问题列表缓存：1分钟
    "questions.list": {"namespace": "questions", "maxsize": 100, "ttl": 60},

    # 分析统计缓存：2分钟
    "analysis.stats": {"namespace": "analysis", "maxsize": 50, "ttl": 120},

    # 导出数据缓存：10分钟（导出通常比较慢）
    "export.data": {"namespace": "export", "maxsize": 50, "ttl": 600},

    # 可视化数据缓存：5分钟
    "viz.data": {"namespace": "visualization", "maxsize": 100, "ttl": 300},
}


def init_caches():
    """初始化所有预定义缓存"""
    for name, config in CACHE_CONFIGS.items():
        CacheManager.register(name, **config)
    logger.info(f"Initialized {len(CACHE_CONFIGS)} caches")


def clear_trajectory_caches():
    """清除所有与轨迹相关的缓存（数据变更时调用）"""
    count = CacheManager.clear_namespace("trajectory")
    CacheManager.clear_namespace("questions")
    CacheManager.clear_namespace("analysis")
    logger.info(f"Cleared all trajectory-related caches ({count} total)")
    return count
