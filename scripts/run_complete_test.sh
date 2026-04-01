#!/bin/bash
# 完整的导入性能测试

echo "========================================"
echo "清空数据库并重新导入"
echo "========================================"

# 1. 停止可能运行的进程
pkill -f "python.*test_direct_import" 2>/dev/null
pkill -f "python.*test_import" 2>/dev/null
sleep 2

# 2. 删除数据库
echo "删除现有数据库..."
rm -rf /home/coo/code/demo/trajectory_store/data/lancedb
echo "✓ 数据库已清空"
echo ""

# 3. 记录开始时间
START_TIME=$(date +%s)
echo "开始导入: $(date)"
echo ""

# 4. 运行导入测试
python test_import_detailed.py

# 5. 记录结束时间
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "========================================"
echo "总耗时: ${ELAPSED} 秒 ($(($ELAPSED / 60)) 分钟)"
echo "========================================"
