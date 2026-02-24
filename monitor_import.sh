#!/bin/bash
# 监控导入进度

echo "监控导入进度..."
echo "按 Ctrl+C 停止监控"
echo ""

while true; do
    # 检查数据库大小
    if [ -d "/home/coo/code/demo/trajectory_store/data/lancedb" ]; then
        db_size=$(du -sh /home/coo/code/demo/trajectory_store/data/lancedb/ | cut -f1)
        file_count=$(find /home/coo/code/demo/trajectory_store/data/lancedb -type f | wc -l)

        # 检查API统计
        stats=$(curl -s http://localhost:8000/stats 2>/dev/null)
        if [ -n "$stats" ]; then
            trajectories=$(echo "$stats" | jq -r '.totalTrajectories // 0')
            questions=$(echo "$stats" | jq -r '.totalQuestions // 0')

            elapsed=$(ps -p $(pgrep -f "python.*test_import" | head -1) -o etimes= 2>/dev/null | tr -d ' ' || echo "N/A")

            echo "[$(date +%H:%M:%S)] 数据库: ${db_size} | 文件数: ${file_count} | 轨迹: ${trajectories} | 问题: ${questions} | 运行时间: ${elapsed}s"
        else
            echo "[$(date +%H:%M:%S)] 数据库: ${db_size} | 文件数: ${file_count} | API未响应"
        fi
    else
        echo "[$(date +%H:%M:%S)] 数据库目录不存在"
    fi

    sleep 10
done
