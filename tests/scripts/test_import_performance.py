"""
压力测试：导入10000条轨迹的性能测试
测试步骤：
1. 清空现有数据
2. 导入压力测试数据
3. 记录各项性能指标
"""
import os
import shutil
import time
import requests
import json
from datetime import datetime

API_BASE = "http://localhost:8000/api"
DB_PATH = "/home/coo/code/demo/trajectory_store/data/lancedb"
TEST_DATA_FILE = "/home/coo/code/demo/trajectory_store/data/trajectory_stress_test.jsonl"

def clear_database():
    """清空数据库"""
    print("=" * 60)
    print("步骤 1: 清空现有数据库")
    print("=" * 60)

    if os.path.exists(DB_PATH):
        print(f"删除数据库目录: {DB_PATH}")
        shutil.rmtree(DB_PATH)
        print("✓ 数据库已清空")
    else:
        print("数据库目录不存在，跳过清空步骤")
    print()

def test_import_performance():
    """测试导入性能"""
    print("=" * 60)
    print("步骤 2: 导入压力测试数据")
    print("=" * 60)
    print(f"测试数据文件: {TEST_DATA_FILE}")

    # 获取文件大小
    file_size = os.path.getsize(TEST_DATA_FILE)
    file_size_mb = file_size / 1024 / 1024
    print(f"文件大小: {file_size_mb:.2f} MB")
    print()

    # 开始导入
    print("开始导入...")
    start_time = time.time()

    response = requests.post(
        f"{API_BASE}/import/from-path",
        json={
            "file_path": TEST_DATA_FILE,
            "file_type": "jsonl"
        }
    )

    end_time = time.time()
    elapsed_time = end_time - start_time

    # 解析响应
    if response.status_code == 200:
        result = response.json()
        print("✓ 导入成功")
        print()
        print("导入结果:")
        print(f"  - 导入轨迹数: {result.get('imported_count', 0)}")
        print(f"  - 跳过轨迹数: {result.get('skipped_count', 0)}")
        print(f"  - 失败轨迹数: {result.get('failed_count', 0)}")
        print(f"  - 任务ID: {result.get('task_id', 'N/A')}")
        print(f"  - 状态: {result.get('status', 'N/A')}")
        print()
        print("=" * 60)
        print("性能指标")
        print("=" * 60)
        print(f"总耗时: {elapsed_time:.2f} 秒")
        print(f"吞吐量: {result.get('imported_count', 0) / elapsed_time:.2f} 条/秒")
        print(f"平均每条: {elapsed_time / result.get('imported_count', 1) * 1000:.2f} 毫秒")
        print(f"数据大小: {file_size_mb:.2f} MB")
        print(f"处理速度: {file_size_mb / elapsed_time:.2f} MB/秒")
        print()

        # 等待一下确保数据写入完成
        time.sleep(2)

        # 验证导入结果
        print("=" * 60)
        print("步骤 3: 验证导入结果")
        print("=" * 60)
        verify_import()
    else:
        print(f"✗ 导入失败: {response.status_code}")
        print(response.text)

def verify_import():
    """验证导入结果"""
    response = requests.get(f"{API_BASE}/stats")
    if response.status_code == 200:
        stats = response.json()
        print("系统统计:")
        print(f"  - 总问题数: {stats.get('totalQuestions', 0)}")
        print(f"  - 总轨迹数: {stats.get('totalTrajectories', 0)}")
        print(f"  - Pass@1: {stats.get('passAt1', 0):.2%}")
        print(f"  - Pass@k: {stats.get('passAtK', 0):.2%}")
        print()

        # 测试查询性能
        print("测试查询性能...")
        query_start = time.time()
        response = requests.get(f"{API_BASE}/trajectories", params={"page": 1, "pageSize": 20})
        query_time = time.time() - query_start

        if response.status_code == 200:
            data = response.json()
            print(f"✓ 查询成功 (前20条轨迹)")
            print(f"  - 查询耗时: {query_time * 1000:.2f} 毫秒")
            print(f"  - 返回轨迹数: {len(data.get('data', []))}")
            print(f"  - 总轨迹数: {data.get('total', 0)}")
        else:
            print(f"✗ 查询失败: {response.status_code}")
    else:
        print(f"✗ 获取统计失败: {response.status_code}")

def main():
    """主函数"""
    print()
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "压力测试：导入10000条轨迹" + " " * 18 + "║")
    print("╚" + "=" * 58 + "╝")
    print()

    # 清空数据库
    clear_database()

    # 导入测试
    test_import_performance()

    print()
    print("=" * 60)
    print("测试完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()
