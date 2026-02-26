"""
生成模拟训练数据用于展示 Training Progress 图表
"""
import json
import random
import os

# 配置
OUTPUT_FILE = "training_mock_data.jsonl"
TRAININGS = ["train_v1_base", "train_v2_improved", "train_v3_final"]
EPOCHS_PER_TRAINING = 10
ITERATIONS_PER_EPOCH = 20
QUESTIONS_PER_ITERATION = 50

def generate_trajectory(training_id: str, epoch_id: int, iteration_id: int, question_id: str, sample_idx: int):
    """生成单条轨迹数据"""

    # 根据 epoch 和 iteration 计算成功率（模拟训练提升趋势）
    base_progress = (epoch_id - 1) / EPOCHS_PER_TRAINING
    iteration_progress = (iteration_id - 1) / ITERATIONS_PER_EPOCH

    # 不同 training 有不同的基础表现
    training_base = {
        "train_v1_base": 0.3,
        "train_v2_improved": 0.4,
        "train_v3_final": 0.5
    }[training_id]

    # 计算成功概率（随训练进行而提升）
    success_prob = training_base + base_progress * 0.3 + iteration_progress * 0.1
    success_prob = min(success_prob, 0.95)  # 最高95%

    is_success = random.random() < success_prob
    reward = 1.0 if is_success else random.uniform(0, 0.8)

    # 生成轨迹 ID
    trajectory_id = f"{training_id}_e{epoch_id}_i{iteration_id}_q{question_id}_s{sample_idx}"

    trajectory = {
        "trajectory_id": trajectory_id,
        "data_id": question_id,
        "task": {
            "question": f"Sample question {question_id}?",
            "ground_truth": f"Answer for {question_id}"
        },
        "steps": [],
        "reward": round(reward, 4),
        "epoch_id": epoch_id,
        "iteration_id": iteration_id,
        "sample_id": sample_idx,
        "training_id": training_id,
        "agent_name": training_id.split("_")[1],
        "termination_reason": "success" if is_success else random.choice(["timeout", "truncation", "other"]),
        "exec_time": random.uniform(1, 10),
        "tags": [],
        "notes": "",
        "is_bookmarked": False,
        "source": "mock_training"
    }

    return trajectory

def generate_training_data():
    """生成完整的训练数据集"""

    all_trajectories = []

    for training_id in TRAININGS:
        print(f"Generating data for {training_id}...")

        for epoch_id in range(1, EPOCHS_PER_TRAINING + 1):
            for iteration_id in range(1, ITERATIONS_PER_EPOCH + 1):

                # 每个 iteration 有 QUESTIONS_PER_ITERATION 个问题
                for q_idx in range(QUESTIONS_PER_ITERATION):
                    question_id = f"q{q_idx:03d}"

                    # 每个问题有 1-2 条轨迹（采样）
                    num_samples = random.randint(1, 2)
                    for sample_idx in range(num_samples):
                        traj = generate_trajectory(
                            training_id, epoch_id, iteration_id, question_id, sample_idx
                        )
                        all_trajectories.append(traj)

    print(f"\nTotal trajectories generated: {len(all_trajectories)}")
    return all_trajectories

def save_to_jsonl(trajectories, output_path):
    """保存为 JSONL 格式"""

    with open(output_path, 'w', encoding='utf-8') as f:
        for traj in trajectories:
            f.write(json.dumps(traj, ensure_ascii=False) + '\n')

    print(f"Data saved to: {output_path}")

if __name__ == "__main__":
    # 生成数据
    trajectories = generate_training_data()

    # 保存
    save_to_jsonl(trajectories, OUTPUT_FILE)

    # 统计信息
    print("\n=== Statistics ===")
    print(f"Trainings: {TRAININGS}")
    print(f"Epochs per training: {EPOCHS_PER_TRAINING}")
    print(f"Iterations per epoch: {ITERATIONS_PER_EPOCH}")
    print(f"Total trajectories: {len(trajectories)}")

    # 按 training 统计
    for training_id in TRAININGS:
        count = sum(1 for t in trajectories if t["training_id"] == training_id)
        print(f"  {training_id}: {count} trajectories")
