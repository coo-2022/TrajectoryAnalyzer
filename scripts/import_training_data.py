"""
导入训练数据到数据库
"""
import sys
import os
import asyncio

# 添加项目根目录到路径
sys.path.insert(0, '/home/coo/code/demo/trajectory_store')

from backend.services.import_service import ImportService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path
import json

DATA_FILE = "/home/coo/code/demo/trajectory_store/scripts/training_mock_data.jsonl"

async def import_data():
    """导入 JSONL 数据"""
    service = ImportService(get_db_path(), create_default_vector_func())

    # 读取 JSONL 文件
    trajectories = []
    print(f"Reading {DATA_FILE}...")

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    data = json.loads(line)
                    trajectories.append(data)
                except json.JSONDecodeError as e:
                    print(f"Error parsing line: {e}")
                    continue

    print(f"Loaded {len(trajectories)} trajectories")

    if len(trajectories) == 0:
        print("No data to import")
        return

    # 使用导入服务导入数据
    print("Importing data...")
    result = await service.import_from_dict(trajectories)

    print(f"\n=== Import Result ===")
    print(f"Success: {result.success}")
    print(f"Imported: {result.imported_count}")
    print(f"Failed: {result.failed_count}")
    print(f"Skipped: {result.skipped_count}")
    print(f"Status: {result.status}")
    print(f"Errors: {len(result.errors)}")

    if result.errors:
        print(f"\nFirst 5 errors:")
        for i, error in enumerate(result.errors[:5]):
            print(f"  {i+1}. {error}")

if __name__ == "__main__":
    asyncio.run(import_data())
