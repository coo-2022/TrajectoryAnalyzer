"""
轨迹管理系统演示
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))


async def demo():
    """演示系统功能"""
    import tempfile
    from backend.services.trajectory_service import TrajectoryService
    from backend.services.import_service import ImportService
    from backend.services.analysis_service import AnalysisService
    from backend.repositories.trajectory import create_default_vector_func

    # 创建临时数据库
    temp_db = tempfile.mkdtemp()
    print(f"使用临时数据库: {temp_db}")

    # 初始化服务
    traj_service = TrajectoryService(temp_db)
    import_service = ImportService(temp_db)
    analysis_service = AnalysisService(temp_db)

    # 示例轨迹数据
    sample_trajectory = {
        "trajectory_id": "demo_001",
        "data_id": "question_001",
        "task": {
            "question": "如何使用Python读取CSV文件？",
            "ground_truth": "使用pandas.read_csv()方法"
        },
        "steps": [
            {
                "step_id": 1,
                "thought": "我需要使用pandas库来读取CSV文件",
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
            {"role": "user", "content": "如何使用Python读取CSV文件？"},
            {"role": "assistant", "content": "可以使用pandas.read_csv()方法"}
        ],
        "reward": 1.0,
        "toolcall_reward": 0.8,
        "res_reward": 0.9,
        "exec_time": 5.5,
        "epoch_id": 1,
        "iteration_id": 1,
        "sample_id": 1,
        "training_id": "demo_training",
        "agent_name": "DemoAgent",
        "termination_reason": "success"
    }

    print("\n" + "="*60)
    print("轨迹管理系统演示")
    print("="*60)

    # 1. 创建轨迹
    print("\n1. 创建轨迹...")
    trajectory = await traj_service.create(sample_trajectory)
    print(f"   ✓ 创建成功: {trajectory.trajectory_id}")
    print(f"   ✓ 问题: {trajectory.get_question()}")
    print(f"   ✓ Reward: {trajectory.reward}")

    # 2. 获取轨迹
    print("\n2. 查询轨迹...")
    fetched = await traj_service.get("demo_001")
    print(f"   ✓ 查询成功: {fetched.trajectory_id}")

    # 3. 列表查询
    print("\n3. 列表查询...")
    result = await traj_service.list(page=1, page_size=10)
    print(f"   ✓ 总数: {result.total}")
    print(f"   ✓ 当前页: {result.page}")

    # 4. 分析轨迹
    print("\n4. 分析轨迹...")
    analysis_result = await analysis_service.analyze_trajectory(sample_trajectory)
    print(f"   ✓ 是否成功: {analysis_result.is_success}")
    print(f"   ✓ 类别: {analysis_result.category}")
    print(f"   ✓ 根本原因: {analysis_result.root_cause}")
    print(f"   ✓ 建议: {analysis_result.suggestion}")

    # 5. 添加标签
    print("\n5. 添加标签...")
    await traj_service.add_tag("demo_001", "示例")
    await traj_service.add_tag("demo_001", "Python")
    tagged_traj = await traj_service.get("demo_001")
    print(f"   ✓ 标签: {tagged_traj.tags}")

    # 6. 收藏
    print("\n6. 收藏轨迹...")
    is_bookmarked = await traj_service.toggle_bookmark("demo_001")
    print(f"   ✓ 收藏状态: {is_bookmarked}")

    # 7. 导入JSON
    print("\n7. 导入JSON数据...")
    import_result = await import_service.import_from_dict(sample_trajectory)
    print(f"   ✓ 导入成功: {import_result.success}")
    print(f"   ✓ 任务ID: {import_result.task_id}")

    # 8. 获取统计
    print("\n8. 获取统计信息...")
    stats = await traj_service.get_statistics()
    print(f"   ✓ 总数: {stats.total_count}")
    print(f"   ✓ 成功数: {stats.success_count}")
    print(f"   ✓ Pass@1: {stats.pass_at_1:.2%}")

    # 9. 可视化数据
    print("\n9. 生成可视化数据...")
    from backend.services.visualization_service import VisualizationService
    viz_service = VisualizationService(temp_db)

    timeline = await viz_service.get_timeline_data("demo_001")
    print(f"   ✓ 时序图数据点: {len(timeline.get('data', []))}")

    flow = await viz_service.get_flow_data("demo_001")
    print(f"   ✓ 流程图节点数: {len(flow.get('nodes', []))}")

    overview = await viz_service.get_overview_stats()
    print(f"   ✓ 总轨迹数: {overview.get('total_trajectories', 0)}")
    print(f"   ✓ 成功率: {overview.get('success_rate', 0):.1f}%")

    print("\n" + "="*60)
    print("演示完成！")
    print("="*60)

    # 清理
    import shutil
    shutil.rmtree(temp_db, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(demo())
