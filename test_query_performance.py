"""
查询性能测试脚本
测试不同类型查询的性能
"""
import time
import requests
import json
from typing import Dict, List

API_BASE = "http://localhost:8000/api"

def test_query_performance():
    """测试各种查询的性能"""

    results = {
        "queries": []
    }

    print("=" * 60)
    print("查询性能测试")
    print("=" * 60)

    # 测试1: 获取统计信息
    print("\n[测试1] 获取统计信息")
    start = time.time()
    response = requests.get("http://localhost:8000/stats")  # stats在根路径
    elapsed = time.time() - start
    stats = response.json()
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  总轨迹数: {stats['totalTrajectories']}")
    print(f"  总问题数: {stats['totalQuestions']}")
    results["queries"].append({
        "name": "获取统计信息",
        "time_ms": elapsed * 1000,
        "records": stats['totalTrajectories']
    })

    # 测试2: 获取轨迹列表（分页）
    print("\n[测试2] 获取轨迹列表（限制100条）")
    start = time.time()
    response = requests.get(f"{API_BASE}/trajectories", params={"limit": 100})
    elapsed = time.time() - start
    resp_json = response.json()
    data = resp_json.get("data", [])
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  返回记录数: {len(data)}")
    results["queries"].append({
        "name": "获取轨迹列表(limit=100)",
        "time_ms": elapsed * 1000,
        "records": len(data)
    })

    # 测试3: 获取轨迹列表（大分页）
    print("\n[测试3] 获取轨迹列表（限制1000条）")
    start = time.time()
    response = requests.get(f"{API_BASE}/trajectories", params={"limit": 1000})
    elapsed = time.time() - start
    resp_json = response.json()
    data = resp_json.get("data", [])
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  返回记录数: {len(data)}")
    results["queries"].append({
        "name": "获取轨迹列表(limit=1000)",
        "time_ms": elapsed * 1000,
        "records": len(data)
    })

    # 测试4: 根据ID查询单条轨迹
    print("\n[测试4] 根据ID查询轨迹")
    # 先获取一个轨迹ID
    response = requests.get(f"{API_BASE}/trajectories", params={"limit": 1})
    resp_json = response.json()
    data = resp_json.get("data", [])
    if data:
        trajectory_id = data[0]["trajectory_id"]
        print(f"  测试ID: {trajectory_id}")

        start = time.time()
        response = requests.get(f"{API_BASE}/trajectories/{trajectory_id}")
        elapsed = time.time() - start
        print(f"  耗时: {elapsed*1000:.2f}ms")
        results["queries"].append({
            "name": "根据ID查询轨迹",
            "time_ms": elapsed * 1000,
            "records": 1
        })

    # 测试5: 筛选查询 - 按data_id
    print("\n[测试5] 筛选查询（按data_id）")
    start = time.time()
    response = requests.get(f"{API_BASE}/trajectories/filter",
                          params={"data_id": "test_data_0"})
    elapsed = time.time() - start
    resp_json = response.json()
    data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  返回记录数: {len(data)}")
    results["queries"].append({
        "name": "筛选查询(按data_id)",
        "time_ms": elapsed * 1000,
        "records": len(data)
    })

    # 测试6: 筛选查询 - 按reward范围
    print("\n[测试6] 筛选查询（按reward范围）")
    start = time.time()
    response = requests.get(f"{API_BASE}/trajectories/filter",
                          params={"reward_min": 0.5, "reward_max": 1.0, "limit": 100})
    elapsed = time.time() - start
    resp_json = response.json()
    data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  返回记录数: {len(data)}")
    results["queries"].append({
        "name": "筛选查询(按reward范围)",
        "time_ms": elapsed * 1000,
        "records": len(data)
    })

    # 测试7: 筛选查询 - 组合条件
    print("\n[测试7] 筛选查询（组合条件）")
    start = time.time()
    response = requests.get(f"{API_BASE}/trajectories/filter",
                          params={
                              "agent_name": "AgentA",
                              "reward_min": 0.3,
                              "limit": 100
                          })
    elapsed = time.time() - start
    resp_json = response.json()
    data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
    print(f"  耗时: {elapsed*1000:.2f}ms")
    print(f"  返回记录数: {len(data)}")
    results["queries"].append({
        "name": "筛选查询(组合条件)",
        "time_ms": elapsed * 1000,
        "records": len(data)
    })

    # 测试8: 向量搜索相似轨迹
    print("\n[测试8] 向量搜索相似轨迹")
    test_question = "How to configure nginx server?"
    start = time.time()
    response = requests.post(f"{API_BASE}/search",
                           json={"question": test_question, "limit": 10})
    elapsed = time.time() - start
    if response.status_code == 200:
        resp_json = response.json()
        data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
        print(f"  耗时: {elapsed*1000:.2f}ms")
        print(f"  返回记录数: {len(data)}")
        results["queries"].append({
            "name": "向量搜索相似轨迹",
            "time_ms": elapsed * 1000,
            "records": len(data)
        })
    else:
        print(f"  搜索失败: {response.status_code}")

    # 测试9: 多次查询平均性能
    print("\n[测试9] 多次查询平均性能（10次）")
    times = []
    for i in range(10):
        start = time.time()
        response = requests.get(f"{API_BASE}/trajectories", params={"limit": 100})
        elapsed = time.time() - start
        times.append(elapsed)
        if (i + 1) % 5 == 0:
            print(f"  完成 {i+1}/10...")

    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)
    print(f"  平均耗时: {avg_time*1000:.2f}ms")
    print(f"  最小耗时: {min_time*1000:.2f}ms")
    print(f"  最大耗时: {max_time*1000:.2f}ms")
    results["queries"].append({
        "name": "多次查询平均(10次)",
        "time_ms": avg_time * 1000,
        "records": 100
    })

    # 测试10: 获取分析结果
    print("\n[测试10] 获取分析结果")
    start = time.time()
    response = requests.get(f"{API_BASE}/analysis", params={"limit": 10})
    elapsed = time.time() - start
    if response.status_code == 200:
        resp_json = response.json()
        data = resp_json if isinstance(resp_json, list) else resp_json.get("data", [])
        print(f"  耗时: {elapsed*1000:.2f}ms")
        print(f"  返回记录数: {len(data)}")
        results["queries"].append({
            "name": "获取分析结果",
            "time_ms": elapsed * 1000,
            "records": len(data)
        })
    else:
        print(f"  无分析结果")

    # 总结
    print("\n" + "=" * 60)
    print("性能总结")
    print("=" * 60)

    for query in results["queries"]:
        print(f"\n{query['name']}:")
        print(f"  耗时: {query['time_ms']:.2f}ms")
        print(f"  记录数: {query['records']}")
        if query['records'] > 0:
            throughput = query['records'] / (query['time_ms'] / 1000)
            print(f"  吞吐量: {throughput:.0f} 条/秒")

    return results


def test_concurrent_queries():
    """测试并发查询性能"""
    import concurrent.futures

    print("\n" + "=" * 60)
    print("并发查询测试")
    print("=" * 60)

    def query_task(task_id):
        """单个查询任务"""
        start = time.time()
        response = requests.get(f"{API_BASE}/trajectories", params={"limit": 100})
        elapsed = time.time() - start
        return {"task_id": task_id, "time_ms": elapsed * 1000, "success": response.status_code == 200}

    # 测试不同并发级别
    for concurrency in [1, 5, 10, 20]:
        print(f"\n[并发级别: {concurrency}]")

        start = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(query_task, i) for i in range(concurrency)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        total_elapsed = time.time() - start

        times = [r["time_ms"] for r in results]
        successful = sum(1 for r in results if r["success"])

        print(f"  总耗时: {total_elapsed*1000:.2f}ms")
        print(f"  平均响应时间: {sum(times)/len(times):.2f}ms")
        print(f"  成功请求: {successful}/{concurrency}")
        print(f"  吞吐量: {concurrency/total_elapsed:.0f} 请求/秒")


if __name__ == "__main__":
    # 基础查询测试
    results = test_query_performance()

    # 并发查询测试
    test_concurrent_queries()

    # 保存结果到文件
    with open("/tmp/query_performance_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n结果已保存到: /tmp/query_performance_results.json")
