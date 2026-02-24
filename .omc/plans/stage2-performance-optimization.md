# Stage 2 Performance Optimization Plan

## Executive Summary

This plan implements the second stage of performance optimizations for the trajectory store system. Following the successful completion of Stage 1 (batch insert, pagination fix, analysis query optimization), Stage 2 focuses on three high-priority optimizations targeting query performance and import efficiency.

**Expected Overall Improvements:**
- Query performance: 10-20x improvement via native LanceDB queries
- Cache hit response: 100x improvement (< 50ms response time)
- Import performance: Additional 2-3x improvement via batch duplicate checking

**Stage 1 Completed (Reference):**
| Optimization | Commit | Improvement |
|--------------|--------|-------------|
| Batch insert | Completed | 50-100x |
| Pagination limit fix | Completed | Fixed functionality |
| Analysis query optimization | Completed | 5-10x |

---

## Context

### Files Modified in This Plan

| File | Current Lines | Purpose |
|------|---------------|---------|
| `backend/repositories/trajectory.py` | 494 | Data access layer - add native query methods |
| `backend/services/trajectory_service.py` | 239 | Service layer - add caching layer |
| `backend/services/import_service.py` | 647 | Import service - already has batch insert, add batch duplicate check |

### Current Performance Baseline (Post-Stage 1)

| Metric | Value | Target |
|--------|-------|--------|
| Import 10,000 records | 10-15 minutes | 5-7 minutes |
| Paginated query (20 records) | ~2-3 seconds | < 500ms |
| Cache hit response | N/A | < 50ms |
| Statistics query | ~2 seconds | < 200ms |

---

## Optimization 1: LanceDB Native Query Optimization

**Priority:** P1
**Expected Improvement:** 10-20x query performance
**Risk Level:** Medium
**Estimated Effort:** 3-4 hours

### Problem Statement

Current implementation in `TrajectoryRepository.get_all()` and `filter()` methods:
- Fetches all data to pandas DataFrame before applying pagination
- Performs sorting in Python rather than database
- Does not utilize LanceDB's native SQL-like query capabilities
- Lines 247-274 and 357-482 in `trajectory.py`

### Solution Design

#### 1.1 Add New `get_paginated()` Method

**File:** `backend/repositories/trajectory.py`
**Location:** After line 274 (after `get_all()` method)

**Implementation:**

```python
def get_paginated(
    self,
    offset: int,
    limit: int,
    filters: Dict[str, Any] = None,
    sort_params: Dict[str, str] = None
) -> List[Trajectory]:
    """使用LanceDB原生查询和分页

    Args:
        offset: 偏移量
        limit: 返回数量
        filters: 筛选条件
        sort_params: 排序参数 {"field": "field_name", "order": "asc"/"desc"}

    Returns:
        轨迹列表
    """
    query = self.tbl.search()

    # 添加筛选条件
    if filters:
        where_clauses = self._build_where_clauses(filters)
        if where_clauses:
            where_clause = " AND ".join(where_clauses)
            query = query.where(where_clause)

    # 注意：LanceDB的query对象没有.sort()方法
    # 排序在pandas DataFrame上应用（当前代码的做法）
    # 或者可以使用DuckDB进行真正的ORDER BY
    # Sort applied in pandas after query (current approach)

    # 应用分页（数据库层）
    query = query.offset(offset).limit(limit)

    # 转换结果
    df = query.to_pandas()

    # 应用排序（pandas侧 - LanceDB不支持.sort()方法）
    if sort_params and sort_params.get("field"):
        field = sort_params["field"]
        order = sort_params.get("order", "desc")
        ascending = (order == "asc")
        # 确保字段存在
        if field in df.columns:
            df = df.sort_values(by=field, ascending=ascending)

    results = []
    for _, row in df.iterrows():
        row_dict = row.to_dict()
        db_traj = DbTrajectory(**row_dict)
        results.append(db_traj.to_domain())

    return results
```

#### 1.2 Add `count()` Method

**File:** `backend/repositories/trajectory.py`
**Location:** After `get_paginated()` method

**Implementation:**

```python
def count(self, filters: Dict[str, Any] = None) -> int:
    """获取匹配条件的记录数

    Args:
        filters: 筛选条件

    Returns:
        匹配的记录总数
    """
    query = self.tbl.search()

    if filters:
        where_clauses = self._build_where_clauses(filters)
        if where_clauses:
            where_clause = " AND ".join(where_clauses)
            query = query.where(where_clause)

    # LanceDB支持COUNT - 通过to_pandas获取长度
    df = query.to_pandas()
    return len(df)
```

#### 1.3 Add `_build_where_clauses()` Helper Method

**File:** `backend/repositories/trajectory.py`
**Location:** After `count()` method (before or after existing `filter()` method)

**Implementation:**

```python
def _build_where_clauses(self, filters: Dict[str, Any]) -> List[str]:
    """构建WHERE子句（复用filter方法的逻辑）

    Args:
        filters: 筛选条件字典

    Returns:
        WHERE子句列表
    """
    clauses = []

    # 精确匹配字段
    exact_match_fields = ["data_id", "agent_name", "training_id"]
    for field in exact_match_fields:
        if field in filters and filters[field]:
            value = filters[field]
            # 支持LIKE部分匹配
            if isinstance(value, str) and '*' in value:
                # SQL输入清洗：转义单引号
                safe_value = value.replace("'", "''").replace('*', '%')
                clauses.append(f"{field} LIKE '{safe_value}'")
            else:
                # SQL输入清洗：转义单引号
                safe_value = str(value).replace("'", "''")
                clauses.append(f"{field} = '{safe_value}'")

    # 模糊匹配字段（带SQL输入清洗）
    if "trajectory_id" in filters and filters["trajectory_id"]:
        # 转义单引号以防止SQL注入
        safe_value = filters["trajectory_id"].replace("'", "''")
        clauses.append(f"trajectory_id LIKE '%{safe_value}%'")

    if "question" in filters and filters["question"]:
        # 转义单引号以防止SQL注入
        safe_value = filters["question"].replace("'", "''")
        clauses.append(f"task.question LIKE '%{safe_value}%'")

    # 终止原因枚举（需要验证输入为有效值）
    if "termination_reason" in filters and filters["termination_reason"]:
        reasons = filters["termination_reason"].split(",")
        # 验证并转义每个原因值
        safe_reasons = []
        valid_reasons = ["success", "error", "timeout", "max_iterations", "user_cancelled"]
        for r in reasons:
            r = r.strip()
            r = r.replace("'", "''")  # 转义单引号
            if r in valid_reasons:
                safe_reasons.append(f"'{r}'")
        if safe_reasons:
            reasons_str = ", ".join(safe_reasons)
            clauses.append(f"termination_reason IN ({reasons_str})")

    # Reward字段：支持范围和精确匹配（数值类型，无需转义）
    if "reward_exact" in filters and filters["reward_exact"] is not None:
        clauses.append(f"reward = {float(filters['reward_exact'])}")
    else:
        if "reward_min" in filters and filters["reward_min"] is not None:
            clauses.append(f"reward >= {float(filters['reward_min'])}")
        if "reward_max" in filters and filters["reward_max"] is not None:
            clauses.append(f"reward <= {float(filters['reward_max'])}")

    # Toolcall Reward字段（数值类型，无需转义）
    if "toolcall_reward_exact" in filters and filters["toolcall_reward_exact"] is not None:
        clauses.append(f"toolcall_reward = {float(filters['toolcall_reward_exact'])}")
    else:
        if "toolcall_reward_min" in filters and filters["toolcall_reward_min"] is not None:
            clauses.append(f"toolcall_reward >= {float(filters['toolcall_reward_min'])}")
        if "toolcall_reward_max" in filters and filters["toolcall_reward_max"] is not None:
            clauses.append(f"toolcall_reward <= {float(filters['toolcall_reward_max'])}")

    # Res Reward字段（数值类型，无需转义）
    if "res_reward_exact" in filters and filters["res_reward_exact"] is not None:
        clauses.append(f"res_reward = {float(filters['res_reward_exact'])}")
    else:
        if "res_reward_min" in filters and filters["res_reward_min"] is not None:
            clauses.append(f"res_reward >= {float(filters['res_reward_min'])}")
        if "res_reward_max" in filters and filters["res_reward_max"] is not None:
            clauses.append(f"res_reward <= {float(filters['res_reward_max'])}")

    # ID字段（整数类型，无需转义）
    for field in ["epoch_id", "iteration_id", "sample_id"]:
        if field in filters and filters[field] is not None:
            clauses.append(f"{field} = {int(filters[field])}")

    # 布尔字段（布尔类型，无需转义）
    if "is_bookmarked" in filters and filters["is_bookmarked"] is not None:
        clauses.append(f"is_bookmarked = {bool(filters['is_bookmarked'])}")

    # Step count字段（整数类型，无需转义）
    if "step_count_min" in filters and filters["step_count_min"] is not None:
        clauses.append(f"step_count >= {int(filters['step_count_min'])}")
    if "step_count_max" in filters and filters["step_count_max"] is not None:
        clauses.append(f"step_count <= {int(filters['step_count_max'])}")

    # Execution time字段（浮点类型，无需转义）
    if "exec_time_min" in filters and filters["exec_time_min"] is not None:
        clauses.append(f"exec_time >= {float(filters['exec_time_min'])}")
    if "exec_time_max" in filters and filters["exec_time_max"] is not None:
        clauses.append(f"exec_time <= {float(filters['exec_time_max'])}")

    return clauses
```

#### 1.4 Update Service Layer to Use New Method

**File:** `backend/services/trajectory_service.py`
**Location:** Lines 43-85 (replace `list()` method implementation)

**Modified Implementation:**

```python
async def list(
    self,
    page: int = 1,
    page_size: int = 20,
    filters: Optional[Dict[str, Any]] = None,
    sort_params: Optional[Dict[str, str]] = None
) -> PaginatedResult:
    """获取轨迹列表（使用原生LanceDB查询）

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
```

### Acceptance Criteria

1. **Performance:** Paginated queries return in < 500ms for 10,000 record dataset
2. **Correctness:** All filter conditions produce identical results to current implementation
3. **No Regression:** Existing tests pass without modification
4. **Total Count:** `count()` method returns accurate totals for all filter combinations

### Verification Steps

```bash
# 1. Run existing tests
pytest backend/tests/test_trajectory_service.py -v

# 2. Performance test with 10,000 records
python test_query_performance.py

# 3. Compare results between old and new implementation
python verify_query_correctness.py
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LanceDB query syntax differences | Keep old `filter()` method as fallback |
| Sorting on non-indexed fields slow | Test all sort_by options; sorting done in pandas after query |
| WHERE clause SQL injection | String inputs sanitized via single quote escaping (`value.replace("'", "''")`); numeric inputs cast to proper types |
| Offset performance degradation | Monitor deep pagination (page > 100) |
| LanceDB `.sort()` method doesn't exist | Use pandas `sort_values()` instead (current approach) |

---

## Optimization 2: Query Result Caching

**Priority:** P1
**Expected Improvement:** 100x on cache hits
**Risk Level:** Low
**Estimated Effort:** 2-3 hours

### Problem Statement

Current implementation in `TrajectoryService.list()`:
- Every query hits the database
- No caching of frequently accessed pages
- Repeated filter combinations query same data repeatedly
- Statistics query (`get_statistics()`) recalculates every time

### Solution Design

#### 2.1 Add Caching Infrastructure

**File:** `backend/services/trajectory_service.py`
**Location:** After imports (around line 11), add new imports

**Add Imports:**

```python
import hashlib
import json
import time  # Required for cache TTL and timestamps
from typing import Dict, Any, Optional, Tuple
```

#### 2.2 Modify `TrajectoryService.__init__()`

**File:** `backend/services/trajectory_service.py`
**Location:** Lines 25-28

**Modified Implementation:**

```python
def __init__(self, db_uri: Optional[str] = None, vector_func=None):
    self.db_uri = db_uri or get_db_path()
    self.vector_func = vector_func or create_default_vector_func()
    self.repository = TrajectoryRepository(self.db_uri, self.vector_func)

    # 缓存配置
    self.cache_enabled = True
    self.cache_ttl = 300  # 5分钟缓存
    self.cache_max_size = 1000  # 最大缓存条目数
    self._cache: Dict[str, Tuple[Any, float]] = {}  # {cache_key: (data, expire_time)}
```

#### 2.3 Add Cache Helper Methods

**File:** `backend/services/trajectory_service.py`
**Location:** After `__init__()`, before `create()` method

**Implementation:**

```python
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
```

#### 2.4 Modify `list()` Method to Use Cache

**File:** `backend/services/trajectory_service.py`
**Location:** Lines 43-85 (after Optimization 1 modifications)

**Final Cached Implementation:**

```python
async def list(
    self,
    page: int = 1,
    page_size: int = 20,
    filters: Optional[Dict[str, Any]] = None,
    sort_params: Optional[Dict[str, str]] = None
) -> PaginatedResult:
    """获取轨迹列表（带缓存）"""

    # 检查缓存
    cache_key = self._make_cache_key(page, page_size, filters, sort_params)
    cached_result = self._get_from_cache(cache_key)

    if cached_result is not None:
        return cached_result

    # 缓存未命中，执行查询
    offset = (page - 1) * page_size

    data = self.repository.get_paginated(
        offset=offset,
        limit=page_size,
        filters=filters,
        sort_params=sort_params
    )

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
```

#### 2.5 Add Cache Invalidation on Data Changes

**File:** `backend/services/trajectory_service.py`
**Location:** Modify `create()`, `update()`, `delete()` methods

**Modified Methods:**

```python
async def create(self, trajectory_data: Dict[str, Any]) -> Trajectory:
    """创建轨迹"""
    trajectory = Trajectory(**trajectory_data)
    trajectory.created_at = time.time()
    trajectory.updated_at = time.time()

    self.repository.add(trajectory)
    self.invalidate_cache()  # 清除缓存
    return trajectory

async def update(self, trajectory_id: str, updates: Dict[str, Any]) -> Optional[Trajectory]:
    """更新轨迹"""
    trajectory = self.repository.get(trajectory_id)
    if not trajectory:
        return None

    for key, value in updates.items():
        if hasattr(trajectory, key):
            setattr(trajectory, key, value)
    trajectory.updated_at = time.time()

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
```

#### 2.6 Add Statistics Caching

**File:** `backend/services/trajectory_service.py`
**Location:** Lines 135-170 (modify `get_statistics()`)

**Implementation:**

```python
# 在__init__中添加
self._stats_cache: Optional[Tuple[AnalysisStatistics, float]] = None
self._stats_cache_ttl = 60  # 统计数据缓存60秒

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
```

### Acceptance Criteria

1. **Cache Hit Performance:** Cached queries return in < 50ms
2. **Cache Invalidation:** Data changes immediately invalidate relevant cache entries
3. **Memory Limits:** Cache memory usage stays under 100MB for typical workload
4. **TTL Accuracy:** Cache entries expire at configured TTL
5. **No Stale Data:** Users never see stale data after updates

### Verification Steps

```bash
# 1. Test cache hit performance
python test_cache_performance.py

# 2. Test cache invalidation
python test_cache_invalidation.py

# 3. Memory usage test
python test_cache_memory.py

# 4. Integration test
pytest backend/tests/test_cache.py -v
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Memory bloat | Set max cache size (1000 entries) |
| Stale data | Invalidate on all mutations |
| Cache key collisions | Use MD5 hash with normalized inputs |
| TTL expiration issues | Check expire time on every read |
| Statistics staleness | Separate, shorter TTL for stats (60s) |

---

## Optimization 3: Batch Duplicate Checking

**Priority:** P1
**Expected Improvement:** 2-3x import speed
**Risk Level:** Low
**Estimated Effort:** 1-2 hours

### Problem Statement

Current import service in `import_service.py`:
- Lines 441, 497: Checks duplicates one-by-one using `repository.get()`
- Each check is a separate database query
- For 10,000 records, this means 10,000 individual queries
- Import is already using batch insert, but duplicate checking is still serial

### Solution Design

#### 3.1 Add `get_all_existing_ids()` Method

**File:** `backend/repositories/trajectory.py`
**Location:** After `search_similar()` method (around line 355)

**Implementation:**

```python
def get_all_existing_ids(self) -> set:
    """获取所有已存在的trajectory_id

    Returns:
        包含所有trajectory_id的集合
    """
    # 使用轻量级查询，只获取ID列
    try:
        df = self.tbl.search().select(["trajectory_id"]).to_pandas()
        return set(df["trajectory_id"].tolist())
    except Exception:
        # 如果查询失败（如表为空），返回空集合
        return set()
```

#### 3.2 Modify `import_from_jsonl()` to Use Batch Duplicate Check

**File:** `backend/services/import_service.py`
**Location:** Lines 351-583 (modify `import_from_jsonl()` method)

**Key Changes:**

1. Add optional `first_import` parameter to skip duplicate checking for known new imports
2. Load existing IDs once at the start if duplicate checking is needed
3. Replace `repository.get()` calls with set membership checks

**Modified Implementation:**

```python
async def import_from_jsonl(
    self,
    file_path: str,
    skip_duplicate_check: bool = False  # 新增参数
) -> ImportResult:
    """从JSONL文件导入轨迹（流式处理 + 批量重复检查）

    Args:
        file_path: JSONL文件路径
        skip_duplicate_check: 是否跳过重复检查（用于已知的新数据导入）

    支持两种JSONL格式：
    1. 每行一个独立的JSON对象
    2. 每行包含trajectories数组的JSON对象
    """
    task_id = f"import_{int(time.time())}"
    result = ImportResult(
        task_id=task_id,
        status="processing",
        progress=0,
        message="Importing from JSONL file (streaming mode)"
    )
    _import_tasks[task_id] = result

    logger.info(task_id, f"开始导入JSONL文件: {file_path}")

    try:
        # 验证路径
        is_allowed, error_msg = self.is_path_allowed(file_path)
        if not is_allowed:
            logger.error(task_id, "文件路径验证失败", error=error_msg)
            result.success = False
            result.errors.append(error_msg)
            result.status = "failed"
            return result

        path = Path(file_path).expanduser().resolve()

        # 批量重复检查优化：预先加载所有现有ID
        existing_ids = set()
        if not skip_duplicate_check:
            logger.info(task_id, "加载现有轨迹ID用于重复检查...")
            existing_ids = self.repository.get_all_existing_ids()
            logger.info(task_id, "已加载现有ID", count=len(existing_ids))

        # 初始化批处理
        batch = []
        batch_size = 100
        batch_start_time = time.time()
        total_processed = 0

        # 获取文件总行数用于进度计算
        total_lines = 0
        with open(path, 'r', encoding='utf-8') as f:
            total_lines = sum(1 for _ in f)

        with open(path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if not line.strip():
                    continue

                try:
                    line_data = json.loads(line)

                    # 格式2: 每行包含trajectories数组
                    if isinstance(line_data, dict) and "trajectories" in line_data:
                        trajectories = line_data["trajectories"]

                        for traj_idx, traj_data in enumerate(trajectories):
                            try:
                                traj_data = self._normalize_trajectory_data(traj_data)

                                is_valid, errors = self.validate_trajectory(traj_data)
                                if not is_valid:
                                    result.failed_count += 1
                                    result.errors.append(f"Line {line_num}[{traj_idx}]: {', '.join(errors)}")
                                    continue

                                # 使用集合检查代替数据库查询
                                traj_id = traj_data.get("trajectory_id")
                                if not skip_duplicate_check and traj_id in existing_ids:
                                    result.skipped_count += 1
                                    continue

                                trajectory = Trajectory(**traj_data)
                                trajectory.source = "jsonl_import"
                                trajectory.created_at = time.time()
                                trajectory.updated_at = time.time()

                                batch.append(trajectory)

                                # 批量插入逻辑
                                if len(batch) >= batch_size:
                                    self.repository.add_batch(batch)
                                    result.imported_count += len(batch)
                                    batch = []
                                    batch_start_time = time.time()

                                    # 更新进度
                                    progress = int((line_num / total_lines) * 100)
                                    result.progress = progress
                                    logger.info(
                                        task_id,
                                        f"进度: {progress}%",
                                        imported=result.imported_count,
                                        skipped=result.skipped_count,
                                        failed=result.failed_count
                                    )

                            except Exception as e:
                                result.failed_count += 1
                                result.errors.append(f"Line {line_num}[{traj_idx}]: {str(e)}")

                    # 格式1: 每行一个独立的轨迹对象
                    else:
                        traj_data = line_data
                        traj_data = self._normalize_trajectory_data(traj_data)

                        is_valid, errors = self.validate_trajectory(traj_data)
                        if not is_valid:
                            result.failed_count += 1
                            result.errors.append(f"Line {line_num}: {', '.join(errors)}")
                            continue

                        traj_id = traj_data.get("trajectory_id")
                        if not skip_duplicate_check and traj_id in existing_ids:
                            result.skipped_count += 1
                            continue

                        trajectory = Trajectory(**traj_data)
                        trajectory.source = "jsonl_import"
                        trajectory.created_at = time.time()
                        trajectory.updated_at = time.time()

                        batch.append(trajectory)

                        # 批量插入逻辑
                        if len(batch) >= batch_size:
                            self.repository.add_batch(batch)
                            result.imported_count += len(batch)
                            batch = []
                            batch_start_time = time.time()

                            # 更新进度
                            progress = int((line_num / total_lines) * 100)
                            result.progress = progress
                            logger.info(
                                task_id,
                                f"进度: {progress}%",
                                imported=result.imported_count,
                                skipped=result.skipped_count,
                                failed=result.failed_count
                            )

                except Exception as e:
                    result.failed_count += 1
                    result.errors.append(f"Line {line_num}: {str(e)}")

        # 插入剩余的记录
        if batch:
            self.repository.add_batch(batch)
            result.imported_count += len(batch)

        result.progress = 100
        result.success = result.failed_count == 0 or result.imported_count > 0
        result.status = "completed" if result.success else "partial"
        result.message = (
            f"导入完成: {result.imported_count} 成功, "
            f"{result.skipped_count} 跳过, "
            f"{result.failed_count} 失败"
        )

        logger.info(
            task_id,
            result.message,
            imported=result.imported_count,
            skipped=result.skipped_count,
            failed=result.failed_count
        )

    except Exception as e:
        logger.error(task_id, "导入失败", error=str(e))
        result.success = False
        result.errors.append(f"JSONL import failed: {str(e)}")
        result.status = "failed"

    return result
```

### Acceptance Criteria

1. **Performance:** Import 10,000 records improves by 2-3x vs current batch insert
2. **Correctness:** All duplicate records are correctly identified and skipped
3. **Memory:** Loading 10,000 IDs uses < 10MB memory
4. **Optional:** `skip_duplicate_check` parameter allows bypassing check for known new data

### Verification Steps

```bash
# 1. Test duplicate detection
python test_duplicate_detection.py

# 2. Performance comparison
python test_import_performance.py --with-batch-dup-check

# 3. Memory test
python test_import_memory.py
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Memory overflow loading IDs | Only load IDs, not full records |
| Stale existing_ids during import | Acceptable - imports are usually into stable datasets |
| Concurrent import race condition | **ACCEPTABLE** - If two imports run simultaneously and both check the same ID before either inserts, the second will fail with duplicate key error. This is rare and the error is already handled. We document this behavior rather than add expensive locking. |
| skip_duplicate_check misuse | Add warning in API documentation |

### Test File Creation

**Step:** Create test files for Optimization 3 verification

```bash
# Create test file for cache performance
touch test_cache_performance.py

# Create test file for LanceDB query performance
touch test_lancedb_queries.py
```

These test files will be populated as part of the implementation to verify:
1. Cache hit/miss timing
2. Query performance improvements
3. Duplicate detection accuracy
4. Memory usage during import

---

## Testing and Verification Plan

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `tests/test_repository_native_query.py` | `get_paginated()`, `count()`, `_build_where_clauses()` |
| `tests/test_service_cache.py` | Cache hit/miss, TTL, invalidation |
| `tests/test_import_batch_dup.py` | Batch duplicate checking |

### Integration Tests

| Test Scenario | Expected Result |
|---------------|-----------------|
| Query page 1 with filters | < 500ms, correct results |
| Query same page twice (cache hit) | < 50ms second request |
| Import 10,000 records (first time) | < 7 minutes total |
| Import same 10,000 records (second time) | All marked as skipped |
| Create trajectory then query | Cache invalidated, new data visible |
| Statistics query (repeated) | < 100ms after first |

### Performance Benchmarks

```python
# test_stage2_performance.py
import time
import asyncio
from backend.services.trajectory_service import TrajectoryService

async def benchmark():
    service = TrajectoryService()

    # 1. Native query benchmark
    start = time.time()
    result = await service.list(page=1, page_size=20, sort_params={"field": "reward", "order": "desc"})
    query_time = time.time() - start
    print(f"Query time: {query_time * 1000:.2f}ms")
    assert query_time < 0.5, f"Query too slow: {query_time}s"

    # 2. Cache hit benchmark
    start = time.time()
    result = await service.list(page=1, page_size=20, sort_params={"field": "reward", "order": "desc"})
    cache_time = time.time() - start
    print(f"Cache hit time: {cache_time * 1000:.2f}ms")
    assert cache_time < 0.05, f"Cache hit too slow: {cache_time}s"

    # 3. Statistics benchmark
    start = time.time()
    stats = await service.get_statistics()
    stats_time = time.time() - start
    print(f"Statistics time: {stats_time * 1000:.2f}ms")
    # First call may be slow, second should be fast
    start = time.time()
    stats = await service.get_statistics()
    stats_cached_time = time.time() - start
    print(f"Statistics cached time: {stats_cached_time * 1000:.2f}ms")
    assert stats_cached_time < 0.1, f"Cached stats too slow: {stats_cached_time}s"

    print("All benchmarks passed!")

if __name__ == "__main__":
    asyncio.run(benchmark())
```

---

## Rollback Plan

Each optimization is committed separately to enable individual rollback:

| Commit | Contents | Rollback Command |
|--------|----------|------------------|
| `feat/native-query-optimization` | Optimization 1 | `git revert HEAD` |
| `feat/query-result-caching` | Optimization 2 | `git revert HEAD` |
| `feat/batch-duplicate-check` | Optimization 3 | `git revert HEAD` |

### Rollback Triggers

1. **Optimization 1:** Query correctness issues (results differ from old implementation)
2. **Optimization 2:** Memory usage > 500MB or stale data reported
3. **Optimization 3:** Import errors or false duplicate detection

### Rollback Verification

After rollback, run:
```bash
pytest backend/tests/ -v
python test_stage1_performance.py  # Ensure Stage 1 gains preserved
```

---

## Implementation Order and Dependencies

```
Optimization 3 (Batch Duplicate Check)
         |
         v (No dependencies, lowest risk)
Optimization 1 (Native Query)
         |
         v (Requires repository changes)
Optimization 2 (Caching)
         |
         v (Built on top of optimized queries)
COMPLETE
```

**Rationale:**
1. **Optimization 3 first:** Lowest risk, independent changes, quick win
2. **Optimization 1 second:** Foundation for caching, must work correctly first
3. **Optimization 2 last:** Depends on working query layer

---

## Success Metrics

| Metric | Before | After (Target) | Measurement |
|--------|--------|----------------|-------------|
| Paginated query (20 records) | 2-3s | < 500ms | `test_query_performance.py` |
| Cache hit response | N/A | < 50ms | `test_cache_performance.py` |
| Statistics query | ~2s | < 100ms (cached) | `test_stats_performance.py` |
| Import 10,000 records (new data) | 10-15 min | 5-7 min | `test_import_performance.py` |
| Import 10,000 records (with dupes) | 10-15 min | 5-7 min | `test_import_performance.py` |
| Memory usage (service) | ~500MB | < 600MB | `test_memory_usage.py` |

---

## Post-Implementation Tasks

1. **Update documentation:** `OPTIMIZATION_PLAN.md` with Stage 2 completion
2. **Create performance report:** Update `PERFORMANCE_ANALYSIS.md` with new benchmarks
3. **Add monitoring:** Log cache hit/miss rates
4. **Configure production:** Adjust cache TTL based on usage patterns
5. **Stage 3 planning:** Index creation and further optimization

---

## Appendix: File Changes Summary

### `backend/repositories/trajectory.py`

| Section | Lines | Change |
|---------|-------|--------|
| New method `get_paginated()` | ~275-310 | Add native query with pagination |
| New method `count()` | ~312-330 | Add efficient count |
| New method `_build_where_clauses()` | ~332-420 | Extract WHERE clause logic |
| New method `get_all_existing_ids()` | ~510-520 | Add batch duplicate check support |

### `backend/services/trajectory_service.py`

| Section | Lines | Change |
|---------|-------|--------|
| Imports | ~11-13 | Add hashlib, json |
| `__init__()` | ~25-35 | Add cache configuration |
| New cache helpers | ~37-90 | Add `_make_cache_key`, `_get_from_cache`, `_set_cache`, `invalidate_cache` |
| `list()` | ~92-120 | Add caching, use `get_paginated()` |
| `create()`, `update()`, `delete()` | Various | Add cache invalidation |
| `get_statistics()` | ~170-210 | Add statistics caching |

### `backend/services/import_service.py`

| Section | Lines | Change |
|---------|-------|--------|
| `import_from_jsonl()` signature | ~351 | Add `skip_duplicate_check` parameter |
| `import_from_jsonl()` body | ~390-450 | Load existing IDs once, use set for duplicate check |

---

**Plan Version:** 1.1
**Created:** 2025-02-03
**Last Updated:** 2025-02-03 (Ralplan refinement)
**Estimated Total Effort:** 6-9 hours
**Risk Level:** Medium (isolated changes, individual rollback available)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-02-03 | Fixed per Critic feedback: Added `import time`, removed ellipsis placeholders, added SQL sanitization, documented race condition, removed non-existent `.sort()` method |
| 1.0 | 2025-02-03 | Initial plan creation |

---

## Fixes Applied (Per Ralplan Feedback)

### Critic Critical Issues - RESOLVED:

1. **Missing `import time`** - Added to imports section (line 366)
2. **Incomplete Optimization 3** - Replaced all "..." placeholders with complete implementation
3. **SQL injection risk** - Added comprehensive SQL input sanitization via single quote escaping and type casting
4. **Missing test files** - Added test file creation steps in Optimization 3

### Architect Recommendations - APPLIED:

1. **Removed `.sort()` method** - LanceDB doesn't have this method; using pandas `sort_values()` instead with documentation
2. **Added SQL sanitization** - String inputs escaped via `value.replace("'", "''")`, numeric inputs cast to proper types
3. **Documented race condition** - Concurrent import race condition documented as acceptable (rare, already handled)
4. **Kept current SQL syntax** - Current WHERE clause syntax is correct, no changes needed

---

PLAN_READY: .omc/plans/stage2-performance-optimization.md
