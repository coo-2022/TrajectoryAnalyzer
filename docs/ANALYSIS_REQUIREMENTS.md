# 轨迹分析功能需求文档

## 1. 基础信息 - 轨迹完成分类统计

### 1.1 功能描述
分析轨迹的终止原因，分类统计不同终止类型的比例，并支持筛选查看非正常终止的轨迹。

### 1.2 数据字段
**现有数据:**
- `termination_reason` (str): 轨迹终止原因
  - 当前值: `success`, `failed`
  - 存储位置: `trajectories.termination_reason`

### 1.3 分类定义
需要将 `termination_reason` 映射到以下四个类别:

| 类别 | 描述 | 映射规则 |
|------|------|----------|
| `env_done` | 环境正常完成 | `termination_reason == 'success'` |
| `truncation` | 截断终止 | `termination_reason IN ('truncated', 'max_steps', 'step_limit')` |
| `timeout` | 超时终止 | `termination_reason IN ('timeout', 'timed_out')` |
| `finish` | 主动完成 | `termination_reason IN ('finish', 'completed', 'done')` |

**非正常终止 (Unexpected Termination):**
- `truncation`
- `timeout`
- 以及 `termination_reason IN ('error', 'failed', 'exception')`

### 1.4 API 端点需求

#### 1.4.1 获取终止原因统计
```
GET /api/analysis/termination-stats
```

**Response:**
```json
{
  "total": 60,
  "categories": {
    "env_done": {"count": 40, "ratio": 0.667},
    "truncation": {"count": 10, "ratio": 0.167},
    "timeout": {"count": 5, "ratio": 0.083},
    "finish": {"count": 5, "ratio": 0.083}
  },
  "unexpected": {
    "count": 15,
    "ratio": 0.25
  }
}
```

#### 1.4.2 筛选非正常终止轨迹
扩展现有的 `/api/trajectories` 端点:
```
GET /api/trajectories?unexpected_termination=true
```

**实现:**
- 添加 `unexpected_termination` 参数
- 过滤条件: `termination_reason NOT IN ('success', 'finish', 'completed', 'done')`

### 1.5 UI 组件需求

#### 1.5.1 终止原因统计卡片
**位置:** 首页 Dashboard 或新的 "Analysis" 页面

**组件:** `TerminationStatsCard`

```tsx
interface TerminationStats {
  total: number;
  categories: {
    env_done: { count: number; ratio: number };
    truncation: { count: number; ratio: number };
    timeout: { count: number; ratio: number };
    finish: { count: number; ratio: number };
  };
  unexpected: { count: number; ratio: number };
}
```

**显示内容:**
- 总轨迹数
- 四个类别的饼图或条形图
- 非正常终止高亮显示（红色）
- 点击类别可筛选对应轨迹

#### 1.5.2 非正常终止轨迹列表
**功能:**
- 筛选按钮 "View Unexpected Terminations"
- 展示列表（复用现有 TrajectoryView）
- 显示 termination_reason 列

---

## 2. 工具信息 - Tool Return 分类统计

### 2.1 功能描述
分析每个步骤中工具调用的返回结果，分类统计不同返回类型的比例，并支持查看异常工具调用的上下文。

### 2.2 数据字段
**现有数据:**
- `steps_json`: 包含所有步骤数据
  - `action` (str): 工具/动作名称
  - `observation` (str): 工具返回结果
  - `info` (dict): 额外信息
  - `reward` (float): 该步骤的奖励

### 2.3 分类定义
需要解析每个步骤的 `observation` 字段，分类为:

| 类别 | 描述 | 识别规则 |
|------|------|----------|
| `normal` | 正常返回 | observation 不为空且不包含异常关键字 |
| `empty` | 空返回 | observation 为空、None 或仅空白字符 |
| `timeout` | 超时 | observation 包含 "timeout", "timed out" 等关键字 |
| `connection_error` | 连接报错 | observation 包含 "connection", "network", "error", "failed" 等关键字 |

**异常工具返回 (Unexpected Tool Returns):**
- `empty`
- `timeout`
- `connection_error`

### 2.4 数据处理需求

#### 2.4.1 工具返回分类逻辑
```python
def classify_tool_return(observation: str) -> str:
    """分类工具返回结果"""
    if not observation or not observation.strip():
        return "empty"

    obs_lower = observation.lower()

    # 优先级: timeout > connection_error > normal
    if any(kw in obs_lower for kw in ["timeout", "timed out", "time out"]):
        return "timeout"
    if any(kw in obs_lower for kw in ["connection", "network error", "connect failed"]):
        return "connection_error"

    return "normal"
```

#### 2.4.2 统计计算
```python
# 伪代码
for trajectory in trajectories:
    for step in trajectory.steps:
        category = classify_tool_return(step.observation)
        tool_return_stats[category] += 1
```

### 2.5 API 端点需求

#### 2.5.1 获取工具返回统计
```
GET /api/analysis/tool-return-stats
```

**Response:**
```json
{
  "total_tool_calls": 360,
  "categories": {
    "normal": {"count": 300, "ratio": 0.833},
    "empty": {"count": 30, "ratio": 0.083},
    "timeout": {"count": 20, "ratio": 0.056},
    "connection_error": {"count": 10, "ratio": 0.028}
  },
  "unexpected": {
    "count": 60,
    "ratio": 0.167
  }
}
```

#### 2.5.2 获取异常工具返回的上下文
```
GET /api/analysis/unexpected-tool-contexts?limit=50
```

**Query Parameters:**
- `category`: (optional) `empty|timeout|connection_error`
- `limit`: 默认 50

**Response:**
```json
{
  "total": 60,
  "data": [
    {
      "trajectory_id": "q_001_gpt_1",
      "step_id": 3,
      "action": "code_execution",
      "observation": "Connection timeout",
      "category": "timeout",
      "context": {
        "question": "...",
        "step_number": 3
      }
    }
  ]
}
```

### 2.6 UI 组件需求

#### 2.6.1 工具返回统计卡片
**组件:** `ToolReturnStatsCard`

**显示内容:**
- 总工具调用次数
- 四个类别的条形图
- 异常返回高亮显示
- 点击类别查看详情

#### 2.6.2 异常工具上下文列表
**组件:** `UnexpectedToolContextsView`

**功能:**
- 表格展示异常工具调用
- 列: trajectory_id, step_id, action, observation, category
- 点击跳转到轨迹详情
- 支持按类别筛选

---

## 3. 奖励信息 - Trajectory Reward 分类统计

### 3.1 功能描述
分析轨迹的最终奖励值，分类统计不同奖励级别的比例，并支持查看特殊奖励的轨迹。

### 3.2 数据字段
**现有数据:**
- `reward` (float): 轨迹最终奖励
- `toolcall_reward` (float): 工具调用奖励分量
- `res_reward` (float): 结果奖励分量

### 3.3 分类定义
根据 `reward` 值分类:

| 类别 | 描述 | 奖励范围 |
|------|------|----------|
| `perfect_score` | 完美分数 | `reward >= 1.0` 或 `reward == max_reward` |
| `complete_failure` | 完全失败 | `reward <= 0` |
| `partial_success` | 部分成功 | `0 < reward < 1.0` |

**特殊奖励 (Special Rewards):**
- `perfect_score` (最高奖励)
- `complete_failure` (最低奖励)
- 或者可以定义: `reward >= 0.9` (接近完美), `reward <= -0.9` (严重失败)

### 3.4 API 端点需求

#### 3.4.1 获取奖励分类统计
```
GET /api/analysis/reward-category-stats
```

**Response:**
```json
{
  "total": 60,
  "max_reward": 1.0,
  "min_reward": -1.0,
  "avg_reward": 0.25,
  "categories": {
    "perfect_score": {"count": 20, "ratio": 0.333},
    "complete_failure": {"count": 15, "ratio": 0.25},
    "partial_success": {"count": 25, "ratio": 0.417}
  }
}
```

#### 3.4.2 筛选特殊奖励轨迹
扩展现有端点:
```
GET /api/trajectories?reward_category=perfect_score
GET /api/trajectories?reward_category=complete_failure
```

### 3.5 UI 组件需求

#### 3.5.1 奖励分类统计卡片
**组件:** `RewardCategoryStatsCard`

**显示内容:**
- 最大/最小/平均奖励
- 三种类别的分布图
- 特殊奖励轨迹可点击查看

---

## 4. 过程信息 - Process vs Trajectory Reward 相关性分析

### 4.1 功能描述
计算每个轨迹的"过程奖励平均值"与"最终轨迹奖励"之间的相关性，使用 Kendall 相关系数 (τ)，用于判断搜索策略的特征。

### 4.2 数据字段
**现有数据:**
- `reward` (float): 轨迹最终奖励 (Y轴)
- `steps_json[].reward` (float): 每步的过程奖励

### 4.3 计算逻辑

#### 4.3.1 过程奖励平均值
```python
def calculate_avg_process_reward(trajectory) -> float:
    """计算轨迹的平均过程奖励"""
    if not trajectory.steps:
        return 0.0
    return sum(step.reward for step in trajectory.steps) / len(trajectory.steps)
```

#### 4.3.2 Kendall 相关系数
使用 `scipy.stats.kendalltau`:

```python
from scipy.stats import kendalltau

def calculate_kendall_correlation(trajectories):
    """计算过程奖励与最终奖励的Kendall相关系数"""
    avg_process_rewards = []
    final_rewards = []

    for traj in trajectories:
        if traj.steps:  # 仅包含有步骤的轨迹
            avg_process = calculate_avg_process_reward(traj)
            avg_process_rewards.append(avg_process)
            final_rewards.append(traj.reward)

    # 计算 Kendall's tau
    correlation, p_value = kendalltau(avg_process_rewards, final_rewards)

    return {
        "kendall_tau": correlation,
        "p_value": p_value,
        "sample_size": len(avg_process_rewards)
    }
```

### 4.4 API 端点需求

#### 4.4.1 获取相关性分析结果
```
GET /api/analysis/process-reward-correlation
```

**Response:**
```json
{
  "kendall_tau": 0.45,
  "p_value": 0.001,
  "sample_size": 60,
  "interpretation": "moderate_positive_correlation",
  "suggested_strategy": "beam_search",
  "scatter_data": {
    "x": [0.1, 0.2, 0.15, ...],  // avg_process_reward
    "y": [1.0, 0.8, -0.5, ...],   // final_reward
    "trajectory_ids": ["traj_1", "traj_2", "traj_3", ...]
  }
}
```

#### 4.4.2 相关性解释规则
| Kendall Tau 范围 | 解释 | 建议策略 |
|-----------------|------|----------|
| `τ >= 0.7` | 强正相关 | `beam_search` - 过程奖励能可靠预测最终结果 |
| `0.3 <= τ < 0.7` | 中度正相关 | `beam_search` - 有一定预测价值 |
| `0.1 <= τ < 0.3` | 弱正相关 | `2.0` - 其他搜索策略可能更有效 |
| `τ < 0.1` | 无相关/负相关 | `2.0` - 需要探索性搜索 |

### 4.5 UI 组件需求

#### 4.5.1 相关性分析卡片
**组件:** `ProcessRewardCorrelationCard`

**显示内容:**
- Kendall Tau 系数值
- 相关性强度描述
- 建议的搜索策略
- 显著性水平 (p-value)
- 散点图:
  - X轴: 平均过程奖励
  - Y轴: 最终轨迹奖励
  - 每个点代表一个轨迹，hover 显示 trajectory_id

---

## 5. 实现计划

### 5.1 后端实现

#### 5.1.1 新增文件
- `backend/services/analysis_stats_service.py`: 统计分析服务

#### 5.1.2 新增路由
- `backend/routes/analysis_stats.py`: 统计分析路由

#### 5.1.3 修改文件
- `backend/main.py`: 注册新路由
- `backend/repositories/trajectory.py`: 添加统计查询方法（可选）

### 5.2 前端实现

#### 5.2.1 新增组件
- `frontend/src/components/analysis/TerminationStatsCard.tsx`
- `frontend/src/components/analysis/ToolReturnStatsCard.tsx`
- `frontend/src/components/analysis/RewardCategoryStatsCard.tsx`
- `frontend/src/components/analysis/ProcessRewardCorrelationCard.tsx`
- `frontend/src/components/analysis/UnexpectedToolContextsView.tsx`

#### 5.2.2 新增视图
- `frontend/src/views/AnalysisView.tsx`: 整合所有分析卡片

#### 5.2.3 修改文件
- `frontend/src/App.tsx`: 添加 Analysis 路由和导航
- `frontend/src/types.ts`: 添加新的类型定义

### 5.3 依赖项

#### 5.3.1 Python 后端
- `scipy`: 计算 Kendall 相关系数
  ```bash
  pip install scipy
  ```

#### 5.3.2 前端
- `recharts`: 散点图和统计图表（如果未安装）
  ```bash
  npm install recharts
  ```

---

## 6. 数据验证与测试

### 6.1 测试数据需求
现有测试数据需要增强:
- 添加更多 `termination_reason` 变体 (timeout, truncated, etc.)
- 在 `observation` 中添加异常返回示例
- 确保有足够的 `step.reward` 变化用于相关性分析

### 6.2 边界情况处理
- 空步骤列表的轨迹
- 缺失 observation 的步骤
- 零方差数据（所有 reward 相同）

---

## 7. API 总览

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/analysis/termination-stats` | GET | 终止原因统计 |
| `/api/analysis/tool-return-stats` | GET | 工具返回统计 |
| `/api/analysis/reward-category-stats` | GET | 奖励分类统计 |
| `/api/analysis/process-reward-correlation` | GET | 过程奖励相关性分析 |
| `/api/analysis/unexpected-tool-contexts` | GET | 异常工具上下文 |

---

## 8. 优先级建议

### P0 (高优先级)
1. 终止原因统计 (基础信息)
2. 奖励分类统计 (奖励信息)

### P1 (中优先级)
3. 过程奖励相关性分析 (过程信息)

### P2 (低优先级)
4. 工具返回统计 (工具信息) - 需要更复杂的数据解析
