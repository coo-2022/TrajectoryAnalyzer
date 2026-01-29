"""
基础功能测试 - 验证核心实现
"""
import pytest
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestBasicModels:
    """测试基础模型"""

    def test_trajectory_model_creation(self):
        """测试Trajectory模型创建"""
        from backend.models.trajectory import Trajectory

        data = {
            "trajectory_id": "test_001",
            "data_id": "q_001",
            "task": {"question": "Test question", "ground_truth": "Test answer"},
            "steps": [],
            "chat_completions": [],
            "reward": 1.0,
            "toolcall_reward": 0.8,
            "res_reward": 0.9,
            "exec_time": 5.0,
            "epoch_id": 1,
            "iteration_id": 1,
            "sample_id": 1,
            "training_id": "train_001",
            "agent_name": "TestAgent",
            "termination_reason": "success"
        }

        trajectory = Trajectory(**data)
        assert trajectory.trajectory_id == "test_001"
        assert trajectory.reward == 1.0
        assert trajectory.get_question() == "Test question"

    def test_analysis_result_model(self):
        """测试AnalysisResult模型"""
        from backend.models.analysis import AnalysisResult

        result = AnalysisResult(
            trajectory_id="test_001",
            is_success=True,
            category="Test",
            root_cause="Test cause",
            suggestion="Test suggestion"
        )

        assert result.trajectory_id == "test_001"
        assert result.is_success is True


class TestBasicRepository:
    """测试基础Repository功能"""

    def test_vector_func(self):
        """测试向量化函数"""
        from backend.repositories.trajectory import create_default_vector_func

        vector_func = create_default_vector_func()
        vector = vector_func("test question")

        assert len(vector) == 384
        assert all(isinstance(v, float) for v in vector)

    def test_repository_initialization(self, tmp_path):
        """测试Repository初始化"""
        from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func

        db_uri = str(tmp_path / "test_db")
        vector_func = create_default_vector_func()

        repo = TrajectoryRepository(db_uri, vector_func)

        assert repo.table_name == "trajectories"
        assert repo.analysis_table_name == "analysis_results"


class TestBasicServices:
    """测试基础Service功能"""

    def test_trajectory_service_init(self, tmp_path):
        """测试TrajectoryService初始化"""
        from backend.services.trajectory_service import TrajectoryService
        from backend.config import get_db_path

        # 使用临时数据库
        import tempfile
        temp_db = tempfile.mkdtemp()
        service = TrajectoryService(temp_db)

        assert service.repository is not None

    def test_import_service_init(self, tmp_path):
        """测试ImportService初始化"""
        from backend.services.import_service import ImportService
        import tempfile

        temp_db = tempfile.mkdtemp()
        service = ImportService(temp_db)

        assert service.repository is not None

    def test_validate_trajectory(self):
        """测试轨迹验证"""
        from backend.services.import_service import ImportService
        import tempfile

        temp_db = tempfile.mkdtemp()
        service = ImportService(temp_db)

        # 有效数据
        valid_data = {
            "trajectory_id": "test_001",
            "data_id": "q_001",
            "task": {"question": "Test", "ground_truth": "Test"},
            "steps": [],
            "chat_completions": [],
            "reward": 1.0,
            "exec_time": 1.0,
            "agent_name": "Test",
            "termination_reason": "success"
        }

        is_valid, errors = service.validate_trajectory(valid_data)
        assert is_valid is True
        assert len(errors) == 0

        # 无效数据（缺少字段）
        invalid_data = {"trajectory_id": "test_001"}
        is_valid, errors = service.validate_trajectory(invalid_data)
        assert is_valid is False
        assert len(errors) > 0


class TestBasicAPI:
    """测试基础API功能"""

    def test_app_creation(self):
        """测试FastAPI应用创建"""
        from backend.main import app

        assert app is not None
        assert app.title == "Trajectory Analysis API"

    def test_routes_registered(self):
        """测试路由注册"""
        from backend.main import app

        routes = [route.path for route in app.routes]

        # 检查主要路由是否注册
        assert "/" in routes
        assert "/health" in routes
        assert "/api/trajectories" in routes


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
