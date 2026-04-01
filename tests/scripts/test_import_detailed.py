"""
详细的导入性能测试和瓶颈分析
记录各个阶段的时间消耗，分析性能瓶颈
"""
import asyncio
import time
import os
import sys
sys.path.insert(0, '/home/coo/code/demo/trajectory_store')

from backend.services.import_service import ImportService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

class PerformanceMonitor:
    def __init__(self):
        self.start_time = None
        self.last_check_time = None
        self.checkpoints = {}

    def start(self):
        self.start_time = time.time()
        self.last_check_time = time.time()
        print(f"[{self._elapsed():.2f}s] ✓ 开始导入测试")

    def checkpoint(self, name):
        current_time = time.time()
        elapsed_from_start = current_time - self.start_time
        elapsed_from_last = current_time - self.last_check_time

        self.checkpoints[name] = {
            'total_time': elapsed_from_start,
            'stage_time': elapsed_from_last
        }
        self.last_check_time = current_time

        print(f"[{elapsed_from_start:.2f}s] {name} (阶段耗时: {elapsed_from_last:.2f}s)")

    def _elapsed(self):
        return time.time() - self.start_time if self.start_time else 0

    def report(self):
        print()
        print("=" * 70)
        print("性能分析报告")
        print("=" * 70)

        if not self.start_time:
            print("没有性能数据")
            return

        total_time = time.time() - self.start_time

        print(f"\n总耗时: {total_time:.2f} 秒 ({total_time/60:.2f} 分钟)")
        print(f"\n阶段耗时分析:")
        print("-" * 70)
        print(f"{'阶段':<30} {'耗时':<12} {'占比':<10}")
        print("-" * 70)

        for name, data in self.checkpoints.items():
            percentage = (data['stage_time'] / total_time * 100) if total_time > 0 else 0
            print(f"{name:<30} {data['stage_time']:<12.2f} {percentage:<10.1f}%")

async def test_import_performance():
    """测试导入性能"""
    monitor = PerformanceMonitor()

    print()
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "导入性能测试 - 详细分析" + " " * 23 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    monitor.start()

    # 获取测试文件信息
    test_file = "/home/coo/code/demo/trajectory_store/data/trajectory_stress_test.jsonl"
    file_size = os.path.getsize(test_file)
    print(f"测试文件: {test_file}")
    print(f"文件大小: {file_size / 1024 / 1024:.2f} MB")
    print(f"预计轨迹数: 10,000 条")
    print()

    monitor.checkpoint("初始化完成")

    # 创建服务
    service = ImportService(get_db_path(), create_default_vector_func())

    monitor.checkpoint("ImportService 初始化")

    # 开始导入
    print()
    print("开始导入数据...")
    print("-" * 70)

    import_start = time.time()

    # 定期检查进度
    async def monitor_progress():
        last_count = 0
        while True:
            await asyncio.sleep(10)  # 每10秒检查一次
            # 检查数据库大小
            if os.path.exists("/home/coo/code/demo/trajectory_store/data/lancedb"):
                db_size = sum(
                    os.path.getsize(os.path.join(dirpath, filename))
                    for dirpath, _, filenames in os.walk("/home/coo/code/demo/trajectory_store/data/lancedb")
                    for filename in filenames
                ) / 1024 / 1024

                elapsed = time.time() - import_start
                print(f"[{elapsed:.1f}s] 数据库大小: {db_size:.0f} MB | 已运行时间: {elapsed:.0f}s")

    # 启动监控和导入任务
    import_task = asyncio.create_task(service.import_from_jsonl(test_file))
    monitor_task = asyncio.create_task(monitor_progress())

    # 等待导入完成
    result = await import_task
    monitor_task.cancel()

    import_end = time.time()

    monitor.checkpoint("导入完成")

    # 打印导入结果
    print()
    print("导入结果:")
    print("-" * 70)
    print(f"状态: {result.status}")
    print(f"成功: {result.success}")
    print(f"导入轨迹数: {result.imported_count}")
    print(f"跳过轨迹数: {result.skipped_count}")
    print(f"失败轨迹数: {result.failed_count}")
    print()

    # 计算性能指标
    import_time = import_end - import_start
    if result.imported_count > 0:
        throughput = result.imported_count / import_time
        avg_time = (import_time / result.imported_count) * 1000

        print(f"导入性能指标:")
        print("-" * 70)
        print(f"总导入时间: {import_time:.2f} 秒 ({import_time/60:.2f} 分钟)")
        print(f"吞吐量: {throughput:.2f} 条/秒")
        print(f"平均每条: {avg_time:.2f} 毫秒")
        print(f"数据处理速度: {file_size / 1024 / 1024 / import_time:.2f} MB/秒")
        print()

    # 显示错误（如果有）
    if result.errors and len(result.errors) > 0:
        print(f"错误摘要 (前10个):")
        for error in result.errors[:10]:
            print(f"  - {error}")
        if len(result.errors) > 10:
            print(f"  ... 还有 {len(result.errors) - 10} 个错误")

    monitor.checkpoint("测试完成")

    # 验证导入结果
    print()
    print("=" * 70)
    print("验证导入结果")
    print("=" * 70)

    # 统计数据库文件大小
    if os.path.exists("/home/coo/code/demo/trajectory_store/data/lancedb"):
        total_size = 0
        file_count = 0
        for dirpath, _, filenames in os.walk("/home/coo/code/demo/trajectory_store/data/lancedb"):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                total_size += os.path.getsize(filepath)
                file_count += 1

        print(f"数据库文件总数: {file_count}")
        print(f"数据库总大小: {total_size / 1024 / 1024:.2f} MB")
        print(f"平均每条轨迹: {total_size / result.imported_count / 1024:.2f} KB" if result.imported_count > 0 else "")

    monitor.report()

    return result

if __name__ == "__main__":
    asyncio.run(test_import_performance())
