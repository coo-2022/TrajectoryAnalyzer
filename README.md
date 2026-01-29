# 轨迹管理和分析系统

AI Agent 轨迹分析和管理系统，支持轨迹存储、失效分析、可视化和JSON导入。

## 功能特性

- ✅ 轨迹CRUD操作（创建、查询、更新、删除）
- ✅ JSON文件导入
- ✅ 失效分析引擎（6种失效模式检测）
- ✅ 向量搜索（相似轨迹检索）
- ✅ 标签和收藏管理
- ✅ 统计分析和可视化数据
- ✅ RESTful API
- ✅ 108个测试用例

## 项目结构

```
trajectory_store/
├── backend/
│   ├── models/              # 数据模型
│   │   ├── trajectory.py    # Trajectory模型
│   │   ├── analysis.py      # AnalysisResult模型
│   │   └── import_result.py # ImportResult模型
│   ├── repositories/        # 数据访问层
│   │   └── trajectory.py    # TrajectoryRepository
│   ├── services/            # 业务服务层
│   │   ├── trajectory_service.py
│   │   ├── import_service.py
│   │   ├── analysis_service.py
│   │   └── visualization_service.py
│   ├── analyzers/           # 分析引擎
│   │   └── failure_analyzer.py
│   ├── routes/              # API路由
│   │   ├── trajectories.py
│   │   ├── import_route.py
│   │   ├── analysis.py
│   │   ├── visualization.py
│   │   └── export.py
│   ├── config.py            # 配置
│   └── main.py              # FastAPI应用
├── tests/                   # 测试用例
│   ├── conftest.py
│   ├── test_basic.py
│   ├── test_trajectory_service.py
│   ├── test_import_service.py
│   ├── test_analysis_service.py
│   ├── test_visualization_service.py
│   └── test_api.py
├── venv/                    # 虚拟环境
├── demo.py                  # 演示脚本
├── run_server.py            # 启动脚本
├── requirements.txt         # 依赖列表
└── README.md               # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行演示

```bash
python demo.py
```

### 3. 启动API服务器

```bash
# 方式1：使用启动脚本
python run_server.py

# 方式2：直接使用uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

访问 API 文档：http://localhost:8000/docs

### 4. 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行基础测试
pytest tests/test_basic.py -v

# 运行特定测试
pytest tests/test_trajectory_service.py -v

# 生成覆盖率报告
pytest tests/ --cov=backend --cov-report=html
```

## API端点

### 轨迹管理
- `GET /api/trajectories` - 获取轨迹列表
- `POST /api/trajectories` - 创建轨迹
- `GET /api/trajectories/{id}` - 获取轨迹详情
- `PUT /api/trajectories/{id}` - 更新轨迹
- `DELETE /api/trajectories/{id}` - 删除轨迹
- `GET /api/trajectories/search` - 搜索轨迹
- `PUT /api/trajectories/{id}/tags` - 添加标签
- `PUT /api/trajectories/{id}/bookmark` - 收藏轨迹

### 数据导入
- `POST /api/import/json` - 导入JSON文件
- `POST /api/import/dict` - 从字典导入
- `GET /api/import/status/{task_id}` - 查询导入状态
- `GET /api/import/history` - 导入历史

### 分析功能
- `POST /api/analysis/analyze` - 分析轨迹
- `GET /api/analysis/{id}` - 获取分析结果
- `GET /api/analysis/stats` - 获取统计数据
- `GET /api/analysis/failures/distribution` - 失败原因分布

### 可视化
- `GET /api/viz/timeline/{id}` - 时序图数据
- `GET /api/viz/flow/{id}` - 流程图数据
- `GET /api/viz/stats` - 统计图表
- `GET /api/viz/network` - 关系网络图

### 导出
- `GET /api/export/csv` - 导出CSV
- `GET /api/export/json` - 导出JSON
- `POST /api/export/pdf/{id}` - 导出PDF报告

## 使用示例

### 创建轨迹

```bash
curl -X POST http://localhost:8000/api/trajectories \
  -H "Content-Type: application/json" \
  -d '{
    "trajectory_id": "traj_001",
    "data_id": "q_001",
    "task": {
      "question": "如何使用Python读取CSV文件？",
      "ground_truth": "使用pandas.read_csv()"
    },
    "steps": [],
    "chat_completions": [],
    "reward": 1.0,
    "exec_time": 5.0,
    "agent_name": "Agent",
    "termination_reason": "success",
    "epoch_id": 1,
    "iteration_id": 1,
    "sample_id": 1,
    "toolcall_reward": 0.8,
    "res_reward": 0.9,
    "training_id": "train_001"
  }'
```

### 导入JSON文件

```bash
curl -X POST http://localhost:8000/api/import/json \
  -F "file=@trajectories.json"
```

支持的JSON格式：
```json
{
  "trajectories": [
    {
      "trajectory_id": "traj_001",
      "data_id": "q_001",
      "task": {"question": "...", "ground_truth": "..."},
      "steps": [],
      "chat_completions": [],
      "reward": 1.0,
      "exec_time": 5.0,
      "agent_name": "Agent",
      "termination_reason": "success",
      "epoch_id": 1,
      "iteration_id": 1,
      "sample_id": 1
    }
  ]
}
```

### 分析轨迹

```bash
curl -X POST http://localhost:8000/api/analysis/analyze \
  -H "Content-Type: application/json" \
  -d '{"trajectory_id": "traj_001"}'
```

## 失效分析引擎

系统支持以下失效模式检测：

1. **格式错误** - 工具调用标签不匹配
2. **重复工具错误** - 连续多次工具调用失败
3. **重复输出** - 相同内容重复输出
4. **挂起** - 助手没有action就停止
5. **过度自信** - 未验证就声称成功
6. **上下文超限** - 超过最大轮次限制

## 开发说明

### TDD开发

项目采用测试驱动开发（TDD），所有测试用例已提前编写完成。

1. 查看测试状态
```bash
pytest tests/ -v
```

2. 修复失败的测试

3. 运行测试验证

### 添加新功能

1. 在 `tests/` 中添加测试用例
2. 在 `backend/` 中实现功能
3. 运行测试验证
4. 更新API文档

## 配置

配置文件：`backend/config.py`

```python
class Settings(BaseSettings):
    db_path: str = "data/lancedb"           # 数据库路径
    vector_dimension: int = 384              # 向量维度
    api_host: str = "0.0.0.0"                # API主机
    api_port: int = 8000                     # API端口
    max_import_size: int = 100 * 1024 * 1024 # 最大导入大小
```

## 技术栈

- **后端**: FastAPI, Pydantic, Python 3.10+
- **数据库**: LanceDB (向量数据库)
- **向量处理**: sentence-transformers
- **测试**: pytest, pytest-asyncio, pytest-cov
- **开发工具**: uvicorn, black, flake8

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
