#!/usr/bin/env python3
"""
持续监控导入进度
"""
import time
import json
import requests
import subprocess
import os

API_BASE = "http://localhost:8000/api"
DB_PATH = "/home/coo/code/demo/trajectory_store/data/lancedb"

def get_db_size():
    """获取数据库大小"""
    if os.path.exists(DB_PATH):
        total_size = 0
        for dirpath, _, filenames in os.walk(DB_PATH):
            for filename in filenames:
                total_size += os.path.getsize(os.path.join(dirpath, filename))
        return total_size / 1024 / 1024  # MB
    return 0

def get_file_count():
    """获取数据库文件数"""
    if os.path.exists(DB_PATH):
        return sum([len(filenames) for _, _, filenames in os.walk(DB_PATH)])
    return 0

def get_import_stats():
    """获取导入统计"""
    try:
        response = requests.get(f"{API_BASE}/stats", timeout=5)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def get_process_info():
    """获取进程信息"""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "python.*test_import_detailed"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            pid = result.stdout.strip().split('\n')[0]
            # 获取进程运行时间
            stat_file = f"/proc/{pid}/stat"
            if os.path.exists(stat_file):
                with open(stat_file) as f:
                    fields = f.read().split()
                    elapsed = int(fields[14]) / 100  # 转换为秒
                    return {"pid": pid, "elapsed_seconds": elapsed}
    except:
        pass
    return None

def monitor(interval=10):
    """监控导入进度"""
    print("=" * 80)
    print("导入进度监控")
    print("=" * 80)
    print(f"{'时间':<12} {'数据库大小':<12} {'文件数':<8} {'轨迹数':<8} {'问题数':<8} {'运行时间':<10}")
    print("-" * 80)

    start_time = time.time()
    last_count = 0

    try:
        while True:
            # 获取当前时间
            current_time = time.strftime("%H:%M:%S")

            # 获取各项数据
            db_size_mb = get_db_size()
            file_count = get_file_count()
            stats = get_import_stats()
            proc_info = get_process_info()

            if stats:
                trajectories = stats.get('totalTrajectories', 0)
                questions = stats.get('totalQuestions', 0)

                # 计算吞吐量
                elapsed_total = time.time() - start_time
                if proc_info:
                    elapsed_proc = proc_info.get('elapsed_seconds', 0)
                else:
                    elapsed_proc = elapsed_total

                throughput = trajectories / elapsed_total if elapsed_total > 0 else 0

                # 计算进度
                progress = (trajectories / 10000) * 100
                remaining = (10000 - trajectories) / throughput if throughput > 0 else 0

                print(f"{current_time:<12} {db_size_mb:>8.1f}MB {file_count:>6} {trajectories:>6} {questions:>6} {elapsed_proc:>6.0f}s 进度:{progress:>5.1f}%")

                # 估算剩余时间
                if progress > 10 and throughput > 0:
                    print(f"{'':>12} 吞吐量: {throughput:.1f} 条/秒 | 预计剩余: {remaining:>6.0f}秒 ({remaining/60:>5.1f}分钟)")

                last_count = trajectories

                # 如果导入完成，退出
                if trajectories >= 10000:
                    print("\n" + "=" * 80)
                    print("✓ 导入完成！")
                    print("=" * 80)
                    break
            else:
                print(f"{current_time:<12} 等待API响应...")

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n监控已停止")

if __name__ == "__main__":
    monitor()
