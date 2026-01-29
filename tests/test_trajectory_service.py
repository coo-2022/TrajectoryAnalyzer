"""
轨迹服务测试用例
测试TrajectoryRepository和TrajectoryService的所有功能
"""
import pytest
import pandas as pd
from pathlib import Path

# 导入将被实现的模块
# from backend.repositories.trajectory import TrajectoryRepository
# from backend.services.trajectory_service import TrajectoryService


class TestTrajectoryRepository:
    """TrajectoryRepository 测试"""

    @pytest.mark.asyncio
    async def test_add_single_trajectory(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 添加单个轨迹
        期望: 成功添加，可以通过ID查询到
        """
        # TODO: 实现代码后取消注释
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # traj = Trajectory(**sample_trajectory_dict)
        # repo.add(traj)
        #
        # result = repo.get("test_traj_001")
        # assert result is not None
        # assert result.trajectory_id == "test_traj_001"
        # assert result.reward == 1.0
        pass

    @pytest.mark.asyncio
    async def test_add_batch_trajectories(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 批量添加轨迹
        期望: 成功添加所有轨迹，数量正确
        """
        # TODO: 实现代码后取消注释
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # trajectories = [Trajectory(**t) for t in sample_trajectories_list]
        # repo.add_batch(trajectories)
        #
        # all_trajs = repo.get_all(limit=100)
        # assert len(all_trajs) == 10
        pass

    @pytest.mark.asyncio
    async def test_get_trajectory_by_id(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 根据ID查询轨迹
        期望: 返回正确的轨迹数据
        """
        # TODO: 实现代码后取消注释
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # traj = Trajectory(**sample_trajectory_dict)
        # repo.add(traj)
        #
        # result = repo.get("test_traj_001")
        # assert result is not None
        # assert result.data_id == "question_001"
        # assert result.agent_name == "TestAgent"
        pass

    @pytest.mark.asyncio
    async def test_get_non_existent_trajectory(self, temp_db_path, mock_vector_func):
        """
        测试: 查询不存在的轨迹
        期望: 返回None
        """
        # TODO: 实现代码后取消注释
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # result = repo.get("non_existent_id")
        # assert result is None
        pass

    @pytest.mark.asyncio
    async def test_get_lightweight_dataframe(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 获取轻量级DataFrame（不含steps等大字段）
        期望: 返回包含关键字段的DataFrame，不包含heavy字段
        """
        # TODO: 实现代码后取消注释
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # trajectories = [Trajectory(**t) for t in sample_trajectories_list]
        # repo.add_batch(trajectories)
        #
        # df = repo.get_lightweight_df()
        # assert isinstance(df, pd.DataFrame)
        # assert len(df) == 10
        # assert 'trajectory_id' in df.columns
        # assert 'reward' in df.columns
        # assert 'step_count' in df.columns
        pass

    @pytest.mark.asyncio
    async def test_domain_model_conversion(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 域模型与数据库模型互相转换
        期望: 转换后数据一致
        """
        # TODO: 实现代码后取消注释
        # from backend.models import DbTrajectory
        #
        # repo = TrajectoryRepository(temp_db_path, mock_vector_func)
        # traj = Trajectory(**sample_trajectory_dict)
        #
        # # 转换为数据库模型
        # db_traj = DbTrajectory.from_domain(traj, mock_vector_func)
        # assert db_traj.trajectory_id == traj.trajectory_id
        #
        # # 转换回域模型
        # result = db_traj.to_domain()
        # assert result.trajectory_id == traj.trajectory_id
        # assert result.reward == traj.reward
        # assert len(result.steps) == len(traj.steps)
        pass


class TestTrajectoryService:
    """TrajectoryService 业务逻辑测试"""

    @pytest.mark.asyncio
    async def test_create_trajectory(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 创建新轨迹
        期望: 返回创建的轨迹，包含自动生成的元数据
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # result = await service.create(sample_trajectory_dict)
        #
        # assert result.trajectory_id == "test_traj_001"
        # assert result.created_at is not None
        pass

    @pytest.mark.asyncio
    async def test_list_trajectories_with_pagination(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 分页查询轨迹列表
        期望: 返回正确页的数据和总数
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # for traj_data in sample_trajectories_list:
        #     await service.create(traj_data)
        #
        # page1 = await service.list(page=1, page_size=5)
        # assert len(page1.data) == 5
        # assert page1.total == 10
        #
        # page2 = await service.list(page=2, page_size=5)
        # assert len(page2.data) == 5
        pass

    @pytest.mark.asyncio
    async def test_filter_trajectories_by_agent(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 按agent名称过滤
        期望: 只返回指定agent的轨迹
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # for traj_data in sample_trajectories_list:
        #     await service.create(traj_data)
        #
        # filtered = await service.list(filters={"agent_name": "TestAgent"})
        # assert len(filtered.data) == 10
        #
        # filtered2 = await service.list(filters={"agent_name": "NonExistent"})
        # assert len(filtered2.data) == 0
        pass

    @pytest.mark.asyncio
    async def test_search_trajectories_by_keyword(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 关键词搜索
        期望: 返回问题或答案中包含关键词的轨迹
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # for traj_data in sample_trajectories_list:
        #     await service.create(traj_data)
        #
        # results = await service.search("测试问题")
        # assert len(results) > 0
        #
        # empty = await service.search("不存在的内容xyz")
        # assert len(empty) == 0
        pass

    @pytest.mark.asyncio
    async def test_get_trajectory_statistics(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 获取轨迹统计信息
        期望: 返回正确的统计数据
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # for traj_data in sample_trajectories_list:
        #     await service.create(traj_data)
        #
        # stats = await service.get_statistics()
        # assert stats.total_count == 10
        # assert stats.success_count == 5  # 根据测试数据，一半成功
        # assert stats.avg_reward >= 0.0
        pass

    @pytest.mark.asyncio
    async def test_delete_trajectory(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 删除轨迹
        期望: 轨迹被删除，无法再查询到
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # await service.create(sample_trajectory_dict)
        #
        # await service.delete("test_traj_001")
        #
        # result = await service.get("test_traj_001")
        # assert result is None
        pass

    @pytest.mark.asyncio
    async def test_delete_non_existent_trajectory(self, temp_db_path, mock_vector_func):
        """
        测试: 删除不存在的轨迹
        期望: 不抛出异常，优雅处理
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # await service.delete("non_existent")  # 不应抛出异常
        pass


class TestTrajectoryMetadata:
    """轨迹元数据功能测试（标签、收藏等）"""

    @pytest.mark.asyncio
    async def test_add_tag_to_trajectory(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 为轨迹添加标签
        期望: 标签成功添加
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # await service.create(sample_trajectory_dict)
        #
        # await service.add_tag("test_traj_001", "bug")
        #
        # traj = await service.get("test_traj_001")
        # assert "bug" in traj.tags
        pass

    @pytest.mark.asyncio
    async def test_get_trajectories_by_tag(self, temp_db_path, mock_vector_func, sample_trajectories_list):
        """
        测试: 按标签查询轨迹
        期望: 返回带有该标签的所有轨迹
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # for traj_data in sample_trajectories_list:
        #     await service.create(traj_data)
        #
        # await service.add_tag("test_traj_001", "important")
        # await service.add_tag("test_traj_002", "important")
        #
        # results = await service.list(filters={"tags": ["important"]})
        # assert len(results.data) >= 2
        pass

    @pytest.mark.asyncio
    async def test_toggle_bookmark(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 收藏/取消收藏轨迹
        期望: 书签状态正确切换
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # await service.create(sample_trajectory_dict)
        #
        # # 收藏
        # await service.toggle_bookmark("test_traj_001")
        # traj = await service.get("test_traj_001")
        # assert traj.is_bookmarked == True
        #
        # # 取消收藏
        # await service.toggle_bookmark("test_traj_001")
        # traj = await service.get("test_traj_001")
        # assert traj.is_bookmarked == False
        pass

    @pytest.mark.asyncio
    async def test_add_notes_to_trajectory(self, temp_db_path, mock_vector_func, sample_trajectory_dict):
        """
        测试: 为轨迹添加备注
        期望: 备注成功保存
        """
        # TODO: 实现代码后取消注释
        # service = TrajectoryService(temp_db_path, mock_vector_func)
        # await service.create(sample_trajectory_dict)
        #
        # await service.update_notes("test_traj_001", "这是一个重要的测试案例")
        #
        # traj = await service.get("test_traj_001")
        # assert "重要的测试案例" in traj.notes
        pass
