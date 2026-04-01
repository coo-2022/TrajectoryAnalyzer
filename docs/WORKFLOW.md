# AI Agent 轨迹管理系统 - 工作流程说明

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI Agent 轨迹管理系统                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐             │
│  │  数据导入层   │      │  数据存储层   │      │  分析服务层   │             │
│  │              │      │              │      │              │             │
│  │ POST /api/   │─────▶│   LanceDB    │─────▶│   Analysis   │             │
│  │ import/json  │      │   Vector DB  │      │   Service    │             │
│  └──────────────┘      └──────────────┘      └──────────────┘             │
│                                │                       │                   │
│                                ▼                       ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                              API 路由层                               │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐ │  │
│  │  │ /api/        │ │ /api/        │ │ /api/analysis-stats/         │ │  │
│  │  │ trajectories │ │ import       │ │ (统计分析)                   │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                              前端展示层                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ Overview │ │Trajectory│ │  Detail  │ │ Analysis │ │ Import   │  │  │
│  │  │   页面   │ │   表格   │ │   页面   │ │  统计页  │ │   页面   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 详细工作流程

### 阶段 1: 轨迹导入 (Trajectory Import)

#### 数据格式要求
```json
{
  "trajectory_id": "traj_001",
  "session_id": "session_123",
  "task": {
    "question": "用户提出的问题",
    "category": "问题分类"
  },
  "reward": 1.0,
  "termination_reason": "success/env_done/timeout/truncation",
  "steps_json": [
    {
      "step_id": 1,
      "role": "assistant",
      "action": "tool_name",
      "observation": "工具执行结果",
      "reward": 0.5,
      "chat_history": "对话内容"
    }
  ],
  "training_metadata": {
    "epoch_id": 1,
    "iteration_id": 2,
    "sample_id": 3,
    "training_id": "train_001"
  }
}
```

#### 导入流程

```
用户上传 JSON 文件
       │
       ▼
POST /api/import/json
       │
       ▼
┌──────────────────────┐
│  ImportService       │
│  - 验证数据格式       │
│  - 提取特征向量       │
│  - 生成 embedding    │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│   LanceDB            │
│   trajectories 表    │
│   - 存储轨迹数据      │
│   - 创建向量索引      │
└──────────────────────┘
       │
       ▼
   导入成功
```

**关键代码**: `backend/services/import_service.py:import_from_json()`

---

### 阶段 2: 轨迹分析 (Trajectory Analysis)

#### 分析类型

**1. 基础统计分析** (自动计算，无需触发)
- 终止原因统计 (termination_stats)
- 工具返回统计 (tool_return_stats)
- 奖励分类统计 (reward_category_stats)
- 过程奖励相关性 (process_reward_correlation)

**2. 深度失败分析** (目前未自动触发)
- 调用失败分析器
- 分析 chat_history
- 生成分析报告

#### 统计分析流程

```
LanceDB 查询
      │
      ▼
┌─────────────────────────────┐
│  AnalysisStatsService       │
│                             │
│  ┌─────────────────────┐   │
│  │ 终止原因分类         │   │
│  │ - env_done          │   │
│  │ - truncation        │   │
│  │ - timeout           │   │
│  │ - finish            │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ 工具返回分类         │   │
│  │ - normal            │   │
│  │ - empty             │   │
│  │ - timeout           │   │
│  │ - connection_error  │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ 奖励分类             │   │
│  │ - perfect_score (≥1)│   │
│  │ - partial (0-1)     │   │
│  │ - failure (≤0)      │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────────────────────┐   │
│  │ 相关性分析           │   │
│  │ - Kendall's τ       │   │
│  │ - 策略建议           │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
      │
      ▼
返回 JSON (5个 API 端点)
```

**API 端点**:
- `GET /api/analysis-stats/termination-stats`
- `GET /api/analysis-stats/tool-return-stats`
- `GET /api/analysis-stats/reward-category-stats`
- `GET /api/analysis-stats/process-reward-correlation`
- `GET /api/analysis-stats/unexpected-tool-contexts`

---

### 阶段 3: 数据查询 (Data Query)

#### 查询功能

**14 个可筛选字段**:
```
基础信息:
  - trajectory_id (文本搜索)
  - session_id (文本搜索)
  - question (文本搜索)

训练信息:
  - epoch_id (数字范围)
  - iteration_id (数字范围)
  - sample_id (数字范围)
  - training_id (文本搜索)

评估信息:
  - reward (数字范围)
  - termination_reason (下拉选择)
  - created_at (日期范围)

其他:
  - task_category (文本搜索)
  - total_steps (数字范围)
  - has_analysis (布尔值)
```

#### 查询流程

```
前端请求 (带筛选条件)
       │
       ▼
GET /api/trajectories?reward_min=0.5&termination_reason=success
       │
       ▼
┌──────────────────────┐
│  TrajectoryService   │
│  - 构建查询过滤器     │
│  - 执行 LanceDB 查询 │
│  - 分页处理          │
└──────────────────────┘
       │
       ▼
    返回结果
```

**关键代码**: `backend/services/trajectory_service.py:get_trajectories()`

---

### 阶段 4: 前端展示 (Frontend Display)

#### 页面结构

```
http://localhost:5173
       │
       ├─── / (Overview)
       │     └─── 系统概览、统计卡片
       │
       ├─── /trajectories (Trajectory Table)
       │     └─── 14 列可筛选表格
       │     └─── 向量搜索
       │     └─── 详情链接
       │
       ├─── /trajectory/:id (Detail View)
       │     └─── 轨迹完整信息
       │     └─── 步骤时间线
       │     └─── 可视化图表
       │     └─── 失败分析
       │
       ├─── /analysis (Analysis Stats)
       │     └─── Overview Tab
       │         ├─── 终止原因饼图
       │         ├─── 奖励分类柱状图
       │         ├─── 工具返回饼图
       │         └─── 相关性散点图
       │     └─── Tool Contexts Tab
       │         └─── 异常工具调用表格
       │
       └─── /import (Import)
             └─── JSON 文件上传
```

#### 数据流向

```
前端组件加载
      │
      ▼
useEffect(() => {
  fetch('/api/analysis-stats/termination-stats')
    .then(res => res.json())
    .then(data => setStats(data));
}, []);
      │
      ▼
Vite 代理转发
      │
      ▼
http://localhost:8000/api/analysis-stats/termination-stats
      │
      ▼
FastAPI 处理
      │
      ▼
AnalysisStatsService.termination_stats()
      │
      ▼
LanceDB 查询
      │
      ▼
返回 JSON
      │
      ▼
前端渲染 (Recharts 图表)
```

---

## 数据库表结构

### LanceDB 表

#### trajectories 表
```python
{
  "trajectory_id": str,           # 轨迹唯一标识
  "session_id": str,              # 会话标识
  "task": dict,                   # 任务信息 {question, category}
  "reward": float,                # 最终奖励
  "termination_reason": str,      # 终止原因
  "steps_json": str,              # 步骤 JSON 字符串
  "created_at": str,              # 创建时间
  "total_steps": int,             # 总步骤数
  "has_analysis": bool,           # 是否有分析结果

  # 训练元数据
  "epoch_id": int,                # Epoch 编号
  "iteration_id": int,            # 迭代编号
  "sample_id": int,               # 样本编号
  "training_id": str,             # 训练 ID

  # 向量字段 (语义搜索)
  "vector": np.ndarray[1536],     # OpenAI embedding
}
```

#### analysis_results 表 (未激活)
```python
{
  "trajectory_id": str,
  "analysis_type": str,           # 分析类型
  "result": dict,                 # 分析结果
  "created_at": str,
}
```

---

## 当前系统状态

### 数据统计
- **轨迹总数**: 60
- **问题总数**: 20
- **数据库路径**: `data/lancedb/trajectories`
- **向量维度**: 1536 (OpenAI text-embedding-3-small)

### 服务状态
- **后端服务**: http://localhost:8000 ✅
- **前端服务**: http://localhost:5173 ✅
- **API 文档**: http://localhost:8000/docs ✅

### 功能状态
| 功能 | 状态 | 说明 |
|------|------|------|
| 轨迹导入 | ✅ 已实现 | POST /api/import/json |
| 向量搜索 | ✅ 已实现 | semantic_search |
| 多字段筛选 | ✅ 已实现 | 14 个可筛选字段 |
| 基础统计 | ✅ 已实现 | AnalysisStatsService |
| 失败分析 | ⚠️ 部分实现 | AnalysisService 存在但未自动触发 |
| 数据导出 | ✅ 已实现 | CSV/JSON 导出 |
| 可视化展示 | ✅ 已实现 | Recharts 图表 |

---

## 如何添加新轨迹

### 方法 1: 通过 API 上传

```bash
curl -X POST http://localhost:8000/api/import/json \
  -H "Content-Type: application/json" \
  -d @trajectory.json
```

### 方法 2: 通过前端界面

1. 访问 http://localhost:5173/import
2. 选择 JSON 文件
3. 点击上传

### 方法 3: 批量导入

```python
import json
import requests

with open('trajectories.jsonl', 'r') as f:
    for line in f:
        trajectory = json.loads(line)
        response = requests.post(
            'http://localhost:8000/api/import/json',
            json=trajectory
        )
        print(response.json())
```

---

## 分析指标说明

### 1. 终止原因分类
- **env_done**: 环境判定成功 (success/solved/correct)
- **truncation**: 达到最大步数限制 (max_steps/step_limit)
- **timeout**: 超时 (timed_out)
- **finish**: 主动完成 (finish/completed)
- **unknown**: 无法分类

**指标**: 非正常终止率 = (truncation + timeout + unknown) / total

### 2. 工具返回分类
- **normal**: 正常返回
- **empty**: 空返回
- **timeout**: 工具超时
- **connection_error**: 连接错误

**指标**: 异常返回率 = (empty + timeout + connection_error) / total_calls

### 3. 奖励分类
- **perfect_score**: 奖励 ≥ 1.0
- **partial_success**: 奖励 ∈ (0, 1)
- **complete_failure**: 奖励 ≤ 0

**指标**: 成功率 = perfect_score / total

### 4. 过程奖励相关性
- **Kendall's τ**: 相关系数 ∈ [-1, 1]
- **τ ≥ 0.7**: 强正相关 → 建议使用 beam_search
- **τ ≤ -0.7**: 强负相关 → 建议使用 2.0 算法
- **|τ| < 0.1**: 无相关性 → 建议使用 2.0 算法

---

## 技术栈

### 后端
- **FastAPI**: Web 框架
- **LanceDB**: 向量数据库
- **Pandas**: 数据处理
- **Scipy**: 统计分析 (Kendall 相关性)
- **Pydantic**: 数据验证
- **Uvicorn**: ASGI 服务器

### 前端
- **React 18**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **Tailwind CSS**: 样式
- **Recharts**: 图表库
- **React Router**: 路由

---

## 安装

### 1. 创建虚拟环境

```bash
cd /home/coo/code/demo/trajectory_store
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或 .venv\Scripts\activate  # Windows
```

### 2. 安装依赖

**推荐：只安装核心依赖（轻量，约50MB）**
```bash
pip install -r requirements-core.txt
```

**完整：包含测试和开发工具（约200MB）**
```bash
pip install -r requirements.txt
```

### 3. 国内镜像加速（可选）

```bash
pip install -r requirements-core.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 依赖说明

| 文件 | 大小 | 包含内容 | 适用场景 |
|------|------|---------|---------|
| `requirements-core.txt` | ~50MB | 核心运行依赖 | 生产环境、快速部署 |
| `requirements.txt` | ~200MB | +测试工具+代码质量工具 | 开发环境、需要测试 |

**已移除的依赖**：
- ❌ `sentence-transformers` - 不再需要，系统使用简单的hash向量模拟

---

## 启动命令

### 后端
```bash
cd /home/coo/code/demo/trajectory_store
source .venv/bin/activate
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端
```bash
cd /home/coo/code/demo/trajectory_store/frontend
npm run dev
```

---

## 未来改进方向

1. **自动分析触发**: 导入轨迹时自动调用 AnalysisService
2. **实时监控**: WebSocket 推送新数据
3. **更多可视化**: 添加时间序列、热力图等
4. **导出报告**: 生成 PDF/Excel 分析报告
5. **对比分析**: 多版本/多模型对比
6. **异常检测**: 自动识别异常轨迹
7. **性能优化**: 缓存、分页、懒加载
