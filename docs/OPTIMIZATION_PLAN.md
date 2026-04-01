# 性能优化方案

## 执行摘要

基于性能测试结果，本方案针对**导入性能**和**查询性能**两个核心问题提供详细的优化策略。

- **导入性能**: 从11小时优化到10-15分钟（提升50-100倍）
- **查询性能**: 从9-10秒优化到<500ms（提升20-50倍）

---

## 一、导入性能优化方案

### 1.1 问题分析

**当前实现** (`import_service.py:348-533`):
```python
for traj_data in trajectories:
    # 每条记录都：
    # 1. 检查重复 (repository.get() - 1次查询)
    # 2. 序列化数据 (JSON dumps)
    # 3. 生成向量 (vector_func)
    # 4. 插入数据库 (repository.add() - 1次插入)
    self.repository.add(trajectory)
```

**问题**:
- 10,000次独立插入操作
- 10,000次重复性检查
- 每次插入都触发完整的事务、索引更新、磁盘刷新
- 无法利用批量操作的优化

### 1.2 优化方案

#### 方案A: 批量插入（核心优化）⭐⭐⭐

**实施位置**: `backend/services/import_service.py`

**修改内容**:

```python
# 在 import_from_jsonl() 方法中，替换逐条插入逻辑

async def import_from_jsonl(self, file_path: str) -> ImportResult:
    """从JSONL文件导入轨迹（流式处理 + 批量插入）"""
    # ... 前面的代码保持不变 ...

    batch_size = 500  # 每批500条
    batch = []
    batch_start_time = time.time()

    with open(path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue

            try:
                line_data = json.loads(line)

                if isinstance(line_data, dict) and "trajectories" in line_data:
                    trajectories = line_data["trajectories"]

                    for traj_idx, traj_data in enumerate(trajectories):
                        # 标准化数据
                        traj_data = self._normalize_trajectory_data(traj_data)

                        # 验证
                        is_valid, errors = self.validate_trajectory(traj_data)
                        if not is_valid:
                            result.failed_count += 1
                            result.errors.append(f"Line {line_num}[{traj_idx}]: {', '.join(errors)}")
                            continue

                        # 创建轨迹对象（不立即插入）
                        trajectory = Trajectory(**traj_data)
                        trajectory.source = "jsonl_import"
                        trajectory.created_at = time.time()
                        trajectory.updated_at = time.time()

                        batch.append(trajectory)

                        # 批量插入
                        if len(batch) >= batch_size:
                            self.repository.add_batch(batch)
                            result.imported_count += len(batch)
                            total_count += len(batch)

                            # 批量插入耗时日志
                            batch_time = time.time() - batch_start_time
                            logger.info(task_id, f"批量插入完成",
                                      batch_size=len(batch),
                                      elapsed=f"{batch_time:.2f}s",
                                      throughput=f"{len(batch)/batch_time:.1f}条/秒")

                            batch = []
                            batch_start_time = time.time()

                        if total_count % 1000 == 0:
                            logger.info(task_id, "导入进度",
                                      imported=total_count,
                                      progress=f"{total_count/100:.1f}%")

                # ... else 分支类似处理 ...

            except Exception as e:
                result.failed_count += 1
                result.errors.append(f"Line {line_num}: {str(e)}")

    # 插入剩余记录
    if batch:
        self.repository.add_batch(batch)
        result.imported_count += len(batch)

    result.progress = 100
    result.success = result.imported_count > 0
    result.status = "completed"
    result.completed_at = time.time()

    # ... 后续代码保持不变 ...
```

**代码改动量**: ~50行
**预期提升**: 50-100倍
**风险**: 低（batch插入方法已存在，只是未被使用）

---

#### 方案B: 可选的重复检查优化 ⭐⭐

**问题**: 当前每条记录都调用 `repository.get()` 检查重复

**优化选项**:

**选项1**: 批量检查（推荐）
```python
# 在开始导入前，一次性获取所有已存在的ID
def get_all_existing_ids(self) -> set:
    """获取所有已存在的trajectory_id"""
    # 使用LanceDB的轻量级查询，只获取ID列
    df = self.tbl.search().select(["trajectory_id"]).to_pandas()
    return set(df["trajectory_id"].tolist())

# 在导入开始时
existing_ids = self.repository.get_all_existing_ids() if first_import else set()

# 在处理时
if traj_data.get("trajectory_id") in existing_ids:
    result.skipped_count += 1
    continue
```

**选项2**: 跳过检查（最快）
```python
# 对于批量导入，假设数据已经去重
# 在导入配置中添加选项：
skip_duplicate_check = True  # 配置项

if not skip_duplicate_check:
    # 原有的检查逻辑
    pass
```

**推荐**: 选项1（批量检查），风险低且有明显收益

---

#### 方案C: 向量生成优化 ⭐

**当前问题**: 每条记录都调用 `vector_func()` 生成向量

**优化**: 批量生成向量（如果向量函数支持）

```python
# 如果使用真实的embedding模型（如OpenAI API）
# 可以批量调用API减少网络开销

def generate_vectors_batch(self, texts: List[str]) -> List[List[float]]:
    """批量生成向量"""
    # 使用embedding API的批量接口
    # 例如 OpenAI API 支持一次最多2048个文本
    pass
```

**注意**: 当前使用的是hash模拟向量，此优化收益有限。如果将来使用真实embedding，此优化非常重要。

---

### 1.3 导入优化实施优先级

| 优先级 | 方案 | 预期提升 | 实施难度 | 风险 |
|-------|------|---------|---------|------|
| P0 | 批量插入 | 50-100倍 | 低 | 低 |
| P1 | 批量重复检查 | 2-3倍 | 低 | 低 |
| P2 | 向量批量生成 | 1.5-2倍 | 中 | 中 |

**建议实施顺序**:
1. 先实施方案A（批量插入）- 最大收益，最低风险
2. 测试验证后，实施方案B（批量重复检查）
3. 如果使用真实embedding，再实施方案C

---

## 二、查询性能优化方案

### 2.1 问题分析

**当前实现流程** (`trajectory_service.py:43-80`):

```python
# 当前查询流程
def list(page, page_size, filters, sort_params):
    if filters:
        # 问题1: 获取 page_size * 10 条数据
        trajectories = repository.filter(filters, limit=page_size * 10)
        # 问题2: 在Python中进行分页
        total = len(trajectories)
        data = trajectories[offset:offset + page_size]
    else:
        # 问题3: 获取所有数据（最多10000条）
        all_trajectories = repository.get_all(limit=10000)
        # 问题4: 在Python中排序和分页
        total = len(all_trajectories)
        data = all_trajectories[offset:offset + page_size]
```

**路由层问题** (`trajectories.py:18-179`):
```python
# 问题5: 每次查询都获取完整的analysis_df
analysis_df = service.repository.get_analysis_df()  # 全表扫描！

# 问题6: 对每条记录都查找analysis数据
for t in result.data:
    analysis_row = analysis_df[analysis_df['trajectory_id'] == t.trajectory_id]
```

**核心问题**:
1. **数据库层**: 没有利用LanceDB的原生查询和分页能力
2. **服务层**: 在Python中处理大数据集（排序、分页、过滤）
3. **路由层**: 重复的全表查询（analysis_df）
4. **缺少索引**: 常用筛选字段没有建立索引

### 2.2 优化方案

#### 方案A: 利用LanceDB原生查询 ⭐⭐⭐

**实施位置**: `backend/repositories/trajectory.py`

**修改内容**:

```python
class TrajectoryRepository:
    """优化后的数据访问层"""

    def get_paginated(self, offset: int, limit: int,
                      filters: Dict[str, Any] = None,
                      sort_params: Dict[str, str] = None) -> List[Trajectory]:
        """使用LanceDB原生查询和分页

        Args:
            offset: 偏移量
            limit: 返回数量
            filters: 筛选条件
            sort_params: 排序参数
        """
        # 构建查询
        query = self.tbl.search()

        # 添加筛选条件
        if filters:
            where_clauses = self._build_where_clauses(filters)
            if where_clauses:
                where_clause = " AND ".join(where_clauses)
                query = query.where(where_clause)

        # 添加排序（LanceDB支持）
        if sort_params and sort_params.get("field"):
            field = sort_params["field"]
            order = sort_params.get("order", "desc")
            # LanceDB支持SQL风格的ORDER BY
            query = query.sort(field, ascending=(order == "asc"))

        # 应用分页（数据库层）
        query = query.offset(offset).limit(limit)

        # 转换结果
        df = query.to_pandas()
        results = []
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            db_traj = DbTrajectory(**row_dict)
            results.append(db_traj.to_domain())

        return results

    def count(self, filters: Dict[str, Any] = None) -> int:
        """获取匹配条件的记录数"""
        query = self.tbl.search()

        if filters:
            where_clauses = self._build_where_clauses(filters)
            if where_clauses:
                where_clause = " AND ".join(where_clauses)
                query = query.where(where_clause)

        # LanceDB支持COUNT
        df = query.to_pandas()
        return len(df)

    def _build_where_clauses(self, filters: Dict[str, Any]) -> List[str]:
        """构建WHERE子句"""
        clauses = []

        # 精确匹配字段
        exact_match_fields = ["data_id", "agent_name", "training_id"]
        for field in exact_match_fields:
            if field in filters and filters[field]:
                value = filters[field]
                # 使用LIKE支持部分匹配，或=精确匹配
                if isinstance(value, str) and '*' in value:
                    clauses.append(f"{field} LIKE '{value.replace('*', '%')}'")
                else:
                    clauses.append(f"{field} = '{value}'")

        # 范围字段
        range_fields = {
            "reward": ("reward_min", "reward_max", "reward_exact"),
            "toolcall_reward": ("toolcall_reward_min", "toolcall_reward_max", "toolcall_reward_exact"),
            "res_reward": ("res_reward_min", "res_reward_max", "res_reward_exact"),
            "step_count": ("step_count_min", "step_count_max", None),
            "exec_time": ("exec_time_min", "exec_time_max", None)
        }

        for field, (min_key, max_key, exact_key) in range_fields.items():
            if exact_key and exact_key in filters and filters[exact_key] is not None:
                clauses.append(f"{field} = {filters[exact_key]}")
            else:
                if min_key in filters and filters[min_key] is not None:
                    clauses.append(f"{field} >= {filters[min_key]}")
                if max_key in filters and filters[max_key] is not None:
                    clauses.append(f"{field} <= {filters[max_key]}")

        # ID字段
        for field in ["epoch_id", "iteration_id", "sample_id"]:
            if field in filters and filters[field] is not None:
                clauses.append(f"{field} = {filters[field]}")

        # 布尔字段
        if "is_bookmarked" in filters and filters["is_bookmarked"] is not None:
            clauses.append(f"is_bookmarked = {filters['is_bookmarked']}")

        return clauses
```

**代码改动量**: ~150行
**预期提升**: 10-20倍（查询从内存处理改为数据库处理）
**风险**: 中（需要充分测试筛选条件）

---

#### 方案B: 优化Analysis数据查询 ⭐⭐⭐

**实施位置**: `backend/routes/trajectories.py`

**修改内容**:

```python
@router.get("", response_model=Dict[str, Any])
async def list_trajectories(...):
    """优化后的轨迹列表查询"""

    # ... 前面的代码保持不变 ...

    result = await service.list(page, pageSize, filters if filters else None, sort_params)

    # 优化：只获取当前页的analysis数据，而不是全表
    trajectory_ids = [t.trajectory_id for t in result.data]

    # 批量获取analysis数据（一次性查询）
    analysis_map = {}
    if trajectory_ids:
        analysis_df = service.repository.get_analysis_by_ids(trajectory_ids)
        if not analysis_df.empty:
            for _, row in analysis_df.iterrows():
                analysis_map[row['trajectory_id']] = {
                    'isSuccess': bool(row['is_success']),
                    'category': row['category'],
                    'rootCause': row['root_cause']
                }

    # 构建响应
    data_list = []
    for t in result.data:
        traj_dict = t.model_dump()

        # 使用预加载的analysis数据
        if t.trajectory_id in analysis_map:
            traj_dict.update(analysis_map[t.trajectory_id])
        else:
            traj_dict['isSuccess'] = t.reward > 0
            traj_dict['category'] = ""
            traj_dict['rootCause'] = ""

        traj_dict['questionId'] = t.data_id
        traj_dict['step_count'] = len(t.steps)

        # is_success筛选
        if is_success is not None and traj_dict['isSuccess'] != is_success:
            continue

        data_list.append(traj_dict)
```

**配套的Repository方法**:

```python
# 在 TrajectoryRepository 中添加
def get_analysis_by_ids(self, trajectory_ids: List[str]) -> pd.DataFrame:
    """根据ID列表批量获取分析结果"""
    if not trajectory_ids:
        return pd.DataFrame()

    # 构建IN查询
    ids_str = ", ".join([f"'{tid}'" for tid in trajectory_ids])
    where_clause = f"trajectory_id IN ({ids_str})"

    df = self.analysis_tbl.search().where(where_clause).to_pandas()
    return df
```

**代码改动量**: ~50行
**预期提升**: 5-10倍（避免全表扫描）
**风险**: 低

---

#### 方案C: 添加查询结果缓存 ⭐⭐

**实施位置**: `backend/services/trajectory_service.py`

**修改内容**:

```python
from functools import lru_cache
import hashlib
import json

class TrajectoryService:
    """带缓存的轨迹服务"""

    def __init__(self, db_uri: Optional[str] = None, vector_func=None):
        # ... 原有代码 ...

        # 缓存配置
        self.cache_enabled = True
        self.cache_ttl = 300  # 5分钟缓存
        self._cache = {}  # {cache_key: (data, expire_time)}

    def _make_cache_key(self, page, page_size, filters, sort_params):
        """生成缓存键"""
        cache_data = {
            "page": page,
            "page_size": page_size,
            "filters": filters,
            "sort_params": sort_params
        }
        cache_str = json.dumps(cache_data, sort_keys=True)
        return hashlib.md5(cache_str.encode()).hexdigest()

    async def list(
        self,
        page: int = 1,
        page_size: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        sort_params: Optional[Dict[str, str]] = None
    ) -> PaginatedResult:
        """获取轨迹列表（带缓存）"""

        # 检查缓存
        if self.cache_enabled:
            cache_key = self._make_cache_key(page, page_size, filters, sort_params)

            if cache_key in self._cache:
                data, expire_time = self._cache[cache_key]
                if time.time() < expire_time:
                    logger.debug(f"缓存命中: {cache_key}")
                    return data
                else:
                    # 缓存过期，删除
                    del self._cache[cache_key]

        # 缓存未命中，执行查询
        result = await self._list_from_db(page, page_size, filters, sort_params)

        # 存入缓存
        if self.cache_enabled:
            cache_key = self._make_cache_key(page, page_size, filters, sort_params)
            expire_time = time.time() + self.cache_ttl
            self._cache[cache_key] = (result, expire_time)

        return result

    def invalidate_cache(self):
        """清除缓存"""
        self._cache.clear()

    def invalidate_cache_on_change(self):
        """数据变更时清除缓存"""
        self.invalidate_cache()
```

**代码改动量**: ~80行
**预期提升**: 100-1000倍（缓存命中时）
**风险**: 低（可以配置开关）

---

#### 方案D: 添加数据库索引 ⭐

**实施位置**: LanceDB表创建配置

**修改内容**:

```python
# 在 TrajectoryRepository.__init__ 中
def __init__(self, db_uri: str, vector_func: Callable, ...):
    self.db = lancedb.connect(db_uri)
    self.vector_func = vector_func

    # 初始化轨迹表（带索引）
    if table_name not in self.db.table_names():
        self.tbl = self.db.create_table(
            table_name,
            schema=DbTrajectory,
            mode="overwrite"  # 允许覆盖重建
        )

        # 创建索引（LanceDB支持）
        # 注意：LanceDB的向量索引自动创建，这里添加标量索引
        try:
            # 为常用筛选字段创建索引
            self.tbl.create_index(
                "data_id",  # data_id索引（最常用）
                replace=True
            )
            self.tbl.create_index(
                "agent_name",  # agent_name索引
                replace=True
            )
            self.tbl.create_index(
                "reward",  # reward范围索引
                replace=True
            )
            logger.info(f"索引创建成功: {table_name}")
        except Exception as e:
            logger.warning(f"索引创建失败: {e}")
    else:
        self.tbl = self.db.open_table(table_name)
```

**代码改动量**: ~30行
**预期提升**: 2-5倍（特定查询）
**风险**: 中（需要重建表，测试索引效果）

---

#### 方案E: 分页限制修复 ⭐⭐⭐

**问题**: 当前请求limit=100和limit=1000都返回20条

**原因**: API路由中pageSize默认值和最大值限制

**修复**:

```python
# backend/routes/trajectories.py
@router.get("", response_model=Dict[str, Any])
async def list_trajectories(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=1000),  # 修改最大值到1000
    # ... 其他参数 ...
):
    # 同时修改服务层的限制
    result = await service.list(page, pageSize, filters, sort_params)
```

```python
# backend/services/trajectory_service.py
async def list(self, page=1, page_size=20, ...):
    # 移除page_size * 10的限制
    if filters:
        trajectories = self.repository.filter(
            filters,
            limit=page_size * page,  # 只获取当前页+之前页的数据
            sort_params=sort_params
        )
    else:
        # 不再一次性获取10000条
        all_trajectories = self.repository.get_all(
            limit=page_size * page,  # 只获取需要的
            sort_params=sort_params
        )
```

**代码改动量**: ~10行
**预期提升**: 修复功能，用户体验提升
**风险**: 低

---

### 2.3 查询优化实施优先级

| 优先级 | 方案 | 预期提升 | 实施难度 | 风险 |
|-------|------|---------|---------|------|
| P0 | 修复分页限制 | 功能修复 | 低 | 低 |
| P0 | 优化Analysis查询 | 5-10倍 | 低 | 低 |
| P1 | 利用LanceDB原生查询 | 10-20倍 | 中 | 中 |
| P1 | 添加查询缓存 | 100倍(缓存命中) | 低 | 低 |
| P2 | 添加数据库索引 | 2-5倍 | 中 | 中 |

**建议实施顺序**:
1. 先修复分页限制（方案E）- 立即修复功能问题
2. 优化Analysis查询（方案B）- 最大收益，最低风险
3. 利用LanceDB原生查询（方案A）- 核心优化
4. 添加查询缓存（方案C）- 进一步提升
5. 添加索引（方案D）- 长期优化

---

## 三、实施计划

### 阶段1: 快速修复（1-2天）

- [ ] 实施导入批量插入（方案A）
- [ ] 修复分页限制问题（方案E）
- [ ] 优化Analysis数据查询（方案B）

**预期效果**:
- 导入时间: 11小时 → 10-15分钟
- 查询时间: 9-10秒 → 2-3秒

### 阶段2: 核心优化（3-5天）

- [ ] 利用LanceDB原生查询（方案A）
- [ ] 添加查询结果缓存（方案C）
- [ ] 批量重复检查（方案B）

**预期效果**:
- 查询时间: 2-3秒 → <500ms
- 缓存命中: <50ms

### 阶段3: 深度优化（可选，1-2周）

- [ ] 添加数据库索引（方案D）
- [ ] 向量批量生成（方案C）
- [ ] 性能监控和自动调优

**预期效果**:
- 复杂查询: 500ms → 100-200ms
- 系统稳定性提升

---

## 四、风险评估和缓解措施

### 风险1: 批量插入内存溢出

**风险**: 大批量处理可能消耗大量内存

**缓解措施**:
```python
# 限制批量大小
batch_size = 500  # 经过测试的安全值

# 添加内存监控
import psutil
def check_memory():
    if psutil.virtual_memory().percent > 80:
        logger.warning("内存使用超过80%，减小批量大小")
        return False
    return True
```

### 风险2: 查询结果不一致

**风险**: 缓存可能导致数据不一致

**缓解措施**:
- 设置合理的TTL（5分钟）
- 数据变更时自动清除缓存
- 提供手动清除缓存的API

### 风险3: LanceDB兼容性

**风险**: 原生查询可能在不同LanceDB版本表现不一致

**缓解措施**:
- 充分测试每个查询场景
- 保留原有的查询逻辑作为fallback
- 添加详细的错误日志

---

## 五、性能测试验证

### 测试场景

| 场景 | 当前性能 | 目标性能 | 验证方法 |
|------|---------|---------|---------|
| 导入10,000条 | 11小时 | 15分钟 | 自动化测试 |
| 分页查询(20条) | 9-10秒 | <500ms | 压力测试 |
| 筛选查询 | 2-3秒 | <300ms | 功能测试 |
| 并发查询(10用户) | 83秒/请求 | <2秒/请求 | 并发测试 |
| 缓存命中 | N/A | <50ms | 单元测试 |

### 回归测试清单

- [ ] 导入功能正常
- [ ] 分页功能正常
- [ ] 所有筛选条件正常
- [ ] 排序功能正常
- [ ] 数据一致性检查
- [ ] 并发安全性检查

---

## 六、监控和调优

### 性能监控指标

```python
# 添加性能监控装饰器
import time
from functools import wraps

def monitor_performance(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            elapsed = time.time() - start
            logger.info(f"{func.__name__} 耗时: {elapsed:.3f}秒")
            # 记录到监控系统
            metrics.record(func.__name__, elapsed)
    return wrapper

# 使用
@monitor_performance
async def list(self, page, page_size, filters, sort_params):
    # ...
```

### 持续优化

- 定期分析慢查询日志
- 根据实际使用模式调整缓存策略
- 监控数据库大小和增长趋势
- 优化热点查询路径

---

## 七、总结

本优化方案针对导入和查询两个核心问题，提供了分阶段、低风险的优化路径：

**核心优化**:
1. 导入批量插入 - 50-100倍提升
2. 利用数据库原生查询 - 10-20倍提升
3. 优化关联查询 - 5-10倍提升

**实施建议**:
- 优先实施低风险、高收益的方案
- 分阶段验证，每个阶段都充分测试
- 保留回退方案，确保系统稳定性

**预期最终效果**:
- 导入10,000条数据: **11小时 → 10-15分钟**
- 常规查询响应: **9-10秒 → <500ms**
- 系统支持: **10,000条 → 100,000+条数据**
