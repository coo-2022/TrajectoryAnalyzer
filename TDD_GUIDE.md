# TDD开发指南 - 轨迹管理系统

## 测试用例总览

本项目采用TDD（测试驱动开发）方式，共设计了 **5个测试文件**，覆盖所有核心功能：

| 测试文件 | 测试用例数 | 覆盖功能 |
|---------|-----------|----------|
| `test_trajectory_service.py` | 18个 | 轨迹CRUD、搜索、过滤、分页、元数据（标签/收藏） |
| `test_import_service.py` | 20个 | JSON导入、格式验证、批量处理、错误处理 |
| `test_analysis_service.py` | 18个 | 失效分析、规则检测、统计分析、报告生成 |
| `test_visualization_service.py` | 17个 | 时序图、流程图、统计图表、网络图 |
| `test_api.py` | 35个 | 所有REST API端点测试 |

**总计：108个测试用例**

---

## TDD开发流程

### 阶段1: 红色阶段 - 编写失败的测试

```bash
# 1. 创建测试文件（已完成✅）
tests/
├── conftest.py              # 测试配置和Fixtures
├── test_trajectory_service.py
├── test_import_service.py
├── test_analysis_service.py
├── test_visualization_service.py
└── test_api.py

# 2. 运行测试（预期全部失败）
pytest tests/ -v

# 输出类似:
# FAILED (errors=108)
```

### 阶段2: 绿色阶段 - 实现最小代码使测试通过

#### 模块1: 数据模型和Repository（优先级：P0）

**测试文件**: `test_trajectory_service.py`

**需要实现的文件**:
```
backend/
├── models/
│   ├── __init__.py
│   ├── trajectory.py          # Trajectory模型
│   └── analysis.py            # AnalysisResult模型
└── repositories/
    ├── __init__.py
    ├── trajectory.py          # TrajectoryRepository
    └── metadata.py            # MetadataRepository
```

**运行测试**:
```bash
# 只运行轨迹相关测试
pytest tests/test_trajectory_service.py::TestTrajectoryRepository -v
```

#### 模块2: JSON导入服务（优先级：P0）

**测试文件**: `test_import_service.py`

**需要实现的文件**:
```
backend/
└── services/
    └── import_service.py      # ImportService类
```

**运行测试**:
```bash
pytest tests/test_import_service.py -v
```

#### 模块3: 分析服务（优先级：P1）

**测试文件**: `test_analysis_service.py`

**需要实现的文件**:
```
backend/
├── analyzers/
│   ├── __init__.py
│   ├── base.py               # 分析器基类
│   ├── failure_analyzer.py   # FailureAnalysisEngine
│   └── rules.py              # 各种检测规则
└── services/
    └── analysis_service.py   # AnalysisService
```

**运行测试**:
```bash
pytest tests/test_analysis_service.py -v
```

#### 模块4: 可视化服务（优先级：P1）

**测试文件**: `test_visualization_service.py`

**需要实现的文件**:
```
backend/
└── services/
    └── visualization_service.py  # VisualizationService
```

**运行测试**:
```bash
pytest tests/test_visualization_service.py -v
```

#### 模块5: API路由（优先级：P1）

**测试文件**: `test_api.py`

**需要实现的文件**:
```
backend/
├── main.py                   # FastAPI应用
└── routes/
    ├── __init__.py
    ├── trajectories.py       # 轨迹路由
    ├── import.py             # 导入路由
    ├── analysis.py           # 分析路由
    ├── visualization.py      # 可视化路由
    └── export.py             # 导出路由
```

**运行测试**:
```bash
pytest tests/test_api.py -v
```

### 阶段3: 重构阶段 - 优化代码

```bash
# 确保所有测试通过
pytest tests/ -v

# 检查覆盖率
pytest tests/ --cov=backend --cov-report=html

# 查看覆盖率报告
open htmlcov/index.html
```

---

## 开发顺序建议

### Sprint 1: 基础设施（1-2天）

```
Day 1:
✅ 步骤1: 创建项目结构
  - mkdir -p backend/{models,repositories,services,analyzers,routes}
  - 创建__init__.py文件

✅ 步骤2: 实现Trajectory模型
  - backend/models/trajectory.py
  - 测试: pytest tests/test_trajectory_service.py::TestTrajectoryRepository::test_domain_model_conversion

Day 2:
✅ 步骤3: 实现TrajectoryRepository
  - backend/repositories/trajectory.py
  - 测试: pytest tests/test_trajectory_service.py::TestTrajectoryRepository
```

### Sprint 2: 核心服务（2-3天）

```
Day 3:
✅ 步骤4: 实现TrajectoryService
  - backend/services/trajectory_service.py
  - 测试: pytest tests/test_trajectory_service.py::TestTrajectoryService

Day 4:
✅ 步骤5: 实现ImportService
  - backend/services/import_service.py
  - 测试: pytest tests/test_import_service.py

Day 5:
✅ 步骤6: 实现FailureAnalysisEngine
  - backend/analyzers/failure_analyzer.py
  - backend/analyzers/rules.py
  - 测试: pytest tests/test_analysis_service.py::TestFailureAnalysisEngine
```

### Sprint 3: 业务服务（2-3天）

```
Day 6:
✅ 步骤7: 实现AnalysisService
  - backend/services/analysis_service.py
  - 测试: pytest tests/test_analysis_service.py::TestAnalysisService

Day 7:
✅ 步骤8: 实现VisualizationService
  - backend/services/visualization_service.py
  - 测试: pytest tests/test_visualization_service.py
```

### Sprint 4: API层（2-3天）

```
Day 8:
✅ 步骤9: 实现FastAPI主应用
  - backend/main.py
  - backend/config.py
  - 测试: pytest tests/test_api.py::TestTrajectoriesAPI

Day 9:
✅ 步骤10: 实现所有路由
  - backend/routes/trajectories.py
  - backend/routes/import.py
  - backend/routes/analysis.py
  - backend/routes/visualization.py
  - backend/routes/export.py
  - 测试: pytest tests/test_api.py

Day 10:
✅ 步骤11: 集成测试和修复
  - 运行所有测试
  - 修复发现的问题
  - 测试: pytest tests/ -v
```

---

## 运行测试的命令

```bash
# 安装依赖
pip install -r requirements.txt

# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_trajectory_service.py -v

# 运行特定测试类
pytest tests/test_trajectory_service.py::TestTrajectoryRepository -v

# 运行特定测试方法
pytest tests/test_trajectory_service.py::TestTrajectoryRepository::test_add_single_trajectory -v

# 显示详细输出
pytest tests/ -vv

# 显示打印输出
pytest tests/ -s

# 生成覆盖率报告
pytest tests/ --cov=backend --cov-report=term-missing

# 生成HTML覆盖率报告
pytest tests/ --cov=backend --cov-report=html

# 只运行失败的测试
pytest tests/ --lf

# 并行运行测试（需要pytest-xdist）
pytest tests/ -n auto

# 运行标记的测试
pytest tests/ -m "not slow"
```

---

## 测试覆盖率目标

| 模块 | 目标覆盖率 |
|------|-----------|
| TrajectoryRepository | 95%+ |
| ImportService | 90%+ |
| AnalysisService | 85%+ |
| VisualizationService | 80%+ |
| API Routes | 80%+ |
| **整体** | **85%+** |

---

## 快速开始TDD

```bash
# 1. 克隆/进入项目目录
cd /home/coo/code/demo/trajectory_store

# 2. 安装依赖
pip install -r requirements.txt

# 3. 查看当前测试状态（预期全部失败或跳过）
pytest tests/ -v

# 4. 选择一个模块开始实现，例如：
#    创建 backend/models/trajectory.py

# 5. 运行对应的测试
pytest tests/test_trajectory_service.py::TestTrajectoryRepository::test_add_single_trajectory -v

# 6. 实现功能直到测试通过

# 7. 重复步骤4-6直到所有测试通过
```

---

## 测试数据示例

测试fixtures提供了以下测试数据：

- `sample_trajectory_dict`: 单个轨迹示例
- `sample_trajectories_list`: 10个轨迹的列表
- `sample_json_file`: JSON导入文件
- `sample_json_single`: 单个轨迹的JSON文件
- `invalid_json_file`: 无效JSON文件（用于错误测试）
- `malformed_trajectory_json`: 格式错误的轨迹数据

这些数据位于 `tests/conftest.py`，可在任何测试中使用。

---

## 常见问题

### Q: 测试失败如何调试？
```bash
# 显示详细错误信息
pytest tests/test_xxx.py -vv -s

# 使用pdb调试
pytest tests/test_xxx.py --pdb

# 只运行失败的测试并进入pdb
pytest tests/ --pdb -x
```

### Q: 如何跳过某些测试？
```python
@pytest.mark.skip(reason="暂未实现")
async def test_something(self):
    pass

# 或使用skipif
@pytest.mark.skipif(condition, reason="条件不满足")
async def test_something(self):
    pass
```

### Q: 如何Mock外部依赖？
```python
from unittest.mock import Mock, patch

@patch('backend.services.import_service.lancedb.connect')
async def test_with_mock(self, mock_connect):
    mock_connect.return_value = Mock()
    # 测试代码
```

---

## 下一步行动

**选择以下任一方式开始：**

1. **从基础开始** - 实现Trajectory模型和Repository
2. **从核心功能开始** - 实现JSON导入服务
3. **从API开始** - 先实现FastAPI骨架，再填充业务逻辑

请告诉我您想从哪里开始，我将帮您实现代码！
