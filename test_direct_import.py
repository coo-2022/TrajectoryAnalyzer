"""
直接使用ImportService导入数据（异步版本）
"""
import asyncio
import sys
import time
sys.path.insert(0, '/home/coo/code/demo/trajectory_store')

from backend.services.import_service import ImportService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

async def main():
    print("=" * 60)
    print("直接使用ImportService导入数据")
    print("=" * 60)
    print()

    service = ImportService(get_db_path(), create_default_vector_func())

    print("开始导入...")
    start_time = time.time()

    result = await service.import_from_jsonl(
        "/home/coo/code/demo/trajectory_store/data/trajectory_stress_test.jsonl"
    )

    end_time = time.time()
    elapsed_time = end_time - start_time

    print()
    print("=" * 60)
    print("导入结果")
    print("=" * 60)
    print(f"导入状态: {result.status}")
    print(f"导入成功: {result.success}")
    print(f"导入轨迹数: {result.imported_count}")
    print(f"跳过轨迹数: {result.skipped_count}")
    print(f"失败轨迹数: {result.failed_count}")
    print()
    print("=" * 60)
    print("性能指标")
    print("=" * 60)
    print(f"总耗时: {elapsed_time:.2f} 秒")
    if result.imported_count > 0:
        print(f"吞吐量: {result.imported_count / elapsed_time:.2f} 条/秒")
        print(f"平均每条: {elapsed_time / result.imported_count * 1000:.2f} 毫秒")

    if result.errors:
        print()
        print("前5个错误:")
        for error in result.errors[:5]:
            print(f"  - {error}")

if __name__ == "__main__":
    asyncio.run(main())
