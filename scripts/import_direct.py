"""
直接导入训练数据到 LanceDB
"""
import sys
import os
sys.path.insert(0, '/home/coo/code/demo/trajectory_store')

import json
import time
from backend.config import get_db_path
import lancedb
from backend.repositories.trajectory import DbTrajectory, DbTask
from pydantic import BaseModel

DATA_FILE = "/home/coo/code/demo/trajectory_store/scripts/training_mock_data.jsonl"

class ImportTrajectory(BaseModel):
    """用于导入的数据模型"""
    trajectory_id: str
    data_id: str
    question_vector: list
    task: DbTask
    steps_json: str
    chat_completions_json: str
    reward: float
    toolcall_reward: float = 0.0
    res_reward: float = 0.0
    exec_time: float
    epoch_id: int
    iteration_id: int
    sample_id: int
    training_id: str
    agent_name: str
    termination_reason: str
    step_count: int = 0
    is_analyzed: bool = False
    tags_json: str = "[]"
    notes: str = ""
    is_bookmarked: bool = False
    source: str = "mock_training"
    created_at: float
    updated_at: float = 0.0

def import_data():
    """导入 JSONL 数据到 LanceDB"""

    db_path = os.path.abspath(get_db_path())
    print(f"Connecting to database: {db_path}")

    # 连接数据库
    db = lancedb.connect(db_path)

    # 检查表是否存在
    table_name = "trajectories"
    try:
        tables_result = db.list_tables()
        print(f"Raw tables result: {tables_result}")
        # list_tables 返回 dict-like object with 'tables' key
        table_list = tables_result.tables if hasattr(tables_result, 'tables') else list(tables_result)
        print(f"Table list: {table_list}")
        if table_name not in table_list:
            print(f"Table {table_name} not found in {table_list}!")
            return
    except Exception as e:
        print(f"Warning: Could not list tables: {e}")
        # 直接尝试打开表
        pass

    try:
        tbl = db.open_table(table_name)
        print(f"Opened table: {table_name}")
    except Exception as e:
        print(f"Error opening table {table_name}: {e}")
        return

    # 读取数据
    print(f"Reading {DATA_FILE}...")
    trajectories = []
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    data = json.loads(line)
                    # 转换为 DbTrajectory 格式
                    traj = ImportTrajectory(
                        trajectory_id=data['trajectory_id'],
                        data_id=data['data_id'],
                        question_vector=[0.0] * 384,  # 使用零向量
                        task=DbTask(
                            question=data['task'].get('question', ''),
                            ground_truth=data['task'].get('ground_truth', '')
                        ),
                        steps_json=json.dumps(data.get('steps', [])),
                        chat_completions_json="[]",
                        reward=float(data.get('reward', 0)),
                        exec_time=float(data.get('exec_time', 0)),
                        epoch_id=int(data.get('epoch_id', 0)),
                        iteration_id=int(data.get('iteration_id', 0)),
                        sample_id=int(data.get('sample_id', 0)),
                        training_id=str(data.get('training_id', '')),
                        agent_name=data.get('agent_name', ''),
                        termination_reason=data.get('termination_reason', ''),
                        tags_json=json.dumps(data.get('tags', [])),
                        notes=data.get('notes', ''),
                        is_bookmarked=bool(data.get('is_bookmarked', False)),
                        source=data.get('source', 'mock_training'),
                        created_at=float(data.get('created_at', time.time()))
                    )
                    trajectories.append(traj.model_dump())
                except Exception as e:
                    print(f"Error parsing line: {e}")
                    continue

    print(f"Loaded {len(trajectories)} trajectories")

    if len(trajectories) == 0:
        print("No data to import")
        return

    # 分批插入数据
    batch_size = 500
    total = len(trajectories)
    imported = 0

    print(f"Importing in batches of {batch_size}...")

    for i in range(0, total, batch_size):
        batch = trajectories[i:i+batch_size]
        try:
            tbl.add(batch)
            imported += len(batch)
            print(f"  Imported {imported}/{total} ({imported/total*100:.1f}%)")
        except Exception as e:
            print(f"Error importing batch {i}: {e}")

    print(f"\n=== Import Complete ===")
    print(f"Total: {total}")
    print(f"Imported: {imported}")

if __name__ == "__main__":
    import_data()
