"""
测试配置和Fixtures
"""
import os
import sys
import tempfile
import pytest
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


# 创建临时测试数据库
@pytest.fixture
def temp_db_path(tmp_path):
    """创建临时数据库路径"""
    db_path = tmp_path / "test_lancedb"
    db_path.mkdir(exist_ok=True)
    return str(db_path)


@pytest.fixture
def mock_vector_func():
    """Mock向量化函数"""
    def vector_func(text: str) -> List[float]:
        # 简单的hash模拟向量
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        # 生成384维向量
        base = int(hash_obj.hexdigest()[:8], 16)
        return [(base + i) % 100 / 100.0 for i in range(384)]
    return vector_func


@pytest.fixture
def sample_trajectory_dict() -> Dict[str, Any]:
    """示例轨迹数据"""
    return {
        "trajectory_id": "test_traj_001",
        "data_id": "question_001",
        "task": {
            "question": "如何使用Python读取CSV文件？",
            "ground_truth": "使用pandas.read_csv()方法"
        },
        "steps": [
            {
                "step_id": 1,
                "thought": "我需要使用pandas库",
                "action": "read_csv",
                "observation": "成功读取文件",
                "reward": 0.5,
                "done": False
            },
            {
                "step_id": 2,
                "thought": "任务完成",
                "action": "finish",
                "observation": "任务成功",
                "reward": 1.0,
                "done": True
            }
        ],
        "chat_completions": [
            {
                "role": "user",
                "content": "如何使用Python读取CSV文件？"
            },
            {
                "role": "assistant",
                "content": "可以使用pandas.read_csv()方法"
            }
        ],
        "reward": 1.0,
        "toolcall_reward": 0.8,
        "res_reward": 0.9,
        "exec_time": 5.5,
        "epoch_id": 1,
        "iteration_id": 1,
        "sample_id": 1,
        "training_id": "train_001",
        "agent_name": "TestAgent",
        "termination_reason": "success"
    }


@pytest.fixture
def sample_trajectories_list() -> List[Dict[str, Any]]:
    """示例轨迹列表"""
    return [
        {
            "trajectory_id": f"test_traj_{i:03d}",
            "data_id": f"question_{i:03d}",
            "task": {
                "question": f"测试问题 {i}",
                "ground_truth": f"测试答案 {i}"
            },
            "steps": [
                {
                    "step_id": 1,
                    "thought": "思考过程",
                    "action": "test_action",
                    "observation": "观察结果",
                    "reward": 0.5,
                    "done": False
                }
            ],
            "chat_completions": [
                {"role": "user", "content": f"问题 {i}"},
                {"role": "assistant", "content": f"答案 {i}"}
            ],
            "reward": 1.0 if i % 2 == 0 else 0.0,  # 一半成功一半失败
            "toolcall_reward": 0.8,
            "res_reward": 0.9,
            "exec_time": 3.0 + i,
            "epoch_id": 1,
            "iteration_id": i,
            "sample_id": i,
            "training_id": "train_001",
            "agent_name": "TestAgent",
            "termination_reason": "success" if i % 2 == 0 else "failed"
        }
        for i in range(1, 11)  # 生成10条测试数据
    ]


@pytest.fixture
def sample_json_file(tmp_path, sample_trajectories_list):
    """创建示例JSON导入文件"""
    import json
    json_file = tmp_path / "import_data.json"
    data = {
        "trajectories": sample_trajectories_list
    }
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return json_file


@pytest.fixture
def sample_json_single(tmp_path, sample_trajectory_dict):
    """单个轨迹的JSON文件"""
    import json
    json_file = tmp_path / "single_trajectory.json"
    data = {
        "trajectory": sample_trajectory_dict
    }
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return json_file


@pytest.fixture
def invalid_json_file(tmp_path):
    """无效的JSON文件"""
    json_file = tmp_path / "invalid.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        f.write("{ invalid json content")
    return json_file


@pytest.fixture
def malformed_trajectory_json(tmp_path):
    """格式错误的轨迹JSON（缺少必需字段）"""
    import json
    json_file = tmp_path / "malformed.json"
    data = {
        "trajectories": [
            {
                "trajectory_id": "bad_traj_001",
                # 缺少必需字段 task, steps等
            }
        ]
    }
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return json_file


@pytest.fixture
def sample_analysis_result():
    """示例分析结果"""
    return {
        "trajectory_id": "test_traj_001",
        "is_success": True,
        "category": "4. Model Capability Issue",
        "root_cause": "4.0 Unknown Error",
        "suggestion": "建议增加重试机制",
        "analyzed_at": 1234567890.0
    }


class TestHelper:
    """测试辅助类"""
    @staticmethod
    def count_files_in_dir(directory: str) -> int:
        """统计目录下文件数量"""
        return len([f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))])

    @staticmethod
    def create_large_json_file(path: str, count: int = 1000):
        """创建大型JSON文件（测试性能）"""
        import json
        data = {
            "trajectories": [
                {
                    "trajectory_id": f"large_traj_{i:06d}",
                    "data_id": f"q_{i:06d}",
                    "task": {"question": f"问题 {i}", "ground_truth": f"答案 {i}"},
                    "steps": [],
                    "chat_completions": [],
                    "reward": 1.0,
                    "toolcall_reward": 0.8,
                    "res_reward": 0.9,
                    "exec_time": 1.0,
                    "epoch_id": 1,
                    "iteration_id": 1,
                    "sample_id": i,
                    "training_id": "train_001",
                    "agent_name": "TestAgent",
                    "termination_reason": "success"
                }
                for i in range(count)
            ]
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)


@pytest.fixture
def test_helper():
    """测试辅助实例"""
    return TestHelper
