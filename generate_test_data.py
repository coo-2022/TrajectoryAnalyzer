"""
生成压力测试数据
- 1000个问题
- 每个问题10条轨迹（不同的tree_id）
- 总共10000条轨迹
"""
import json
import uuid
import hashlib
import random
import string
from datetime import datetime

def generate_uuid():
    """生成UUID"""
    return str(uuid.uuid4())

def generate_data_id(question_idx):
    """生成data_id（问题ID）"""
    # 使用问题的索引生成唯一的data_id
    raw = f"question_{question_idx:04d}"
    return hashlib.md5(raw.encode()).hexdigest()

def generate_trajectory_id(data_id, training_id, epoch_id, iteration_id, sample_id, tree_id):
    """生成trajectory_id"""
    return f"{data_id}-{training_id}-{epoch_id}-{iteration_id}-{sample_id}-{tree_id}"

def generate_random_question():
    """生成随机问题"""
    question_templates = [
        "如何在华为{device}交换机上配置{feature}？",
        "如何使用{tool}工具来{action}？",
        "在华为S6730-H交换机的{scenario}场景中，需要{requirement}。请问如何配置？",
        "我们正在部署{service}服务，要求使用{protocol}协议实现{function}功能。",
        "华为{device}设备的{feature}功能配置方法是什么？",
    ]

    devices = ["S6730-H", "S6750-H", "S6780-H", "S5732-H"]
    features = ["MPLS", "VXLAN", "BGP", "OSPF", "NQA", "BFD", "VRRP", "ACL"]
    tools = ["read_content", "read_catalogue", "search", "query"]
    actions = ["查看文档", "搜索配置", "查找路径", "验证配置"]
    scenarios = ["开局部署", "网络扩容", "设备升级", "故障排查", "性能优化"]
    requirements = ["监控网络状态", "优化转发路径", "提高可靠性", "增强安全性"]
    services = ["VPN", "MPLS L3VPN", "MPLS L2VPN", "VXLAN EVPN"]
    protocols = ["BGP", "OSPF", "IS-IS", "MPLS", "Segment Routing"]
    functions = ["负载均衡", "快速倒换", "流量调度", "路径监控"]

    template = random.choice(question_templates)

    question = template.format(
        device=random.choice(devices),
        feature=random.choice(features),
        tool=random.choice(tools),
        action=random.choice(actions),
        scenario=random.choice(scenarios),
        requirement=random.choice(requirements),
        service=random.choice(services),
        protocol=random.choice(protocols),
        function=random.choice(functions)
    )

    return question + "请提供详细的配置步骤和命令示例。"

def generate_random_step(step_id, parent_uuid=None):
    """生成随机步骤"""
    step = {
        "reward": str(random.uniform(0.0, 1.0)),
        "mc_return": str(random.uniform(0.0, 2.0)),
        "done": str(random.choice([True, False])),
        "step_id": str(step_id),
        "uuid": generate_uuid(),
        "parent_uuid": parent_uuid or "None"
    }
    return step

def generate_random_steps():
    """生成随机步骤序列"""
    steps = []
    num_steps = random.randint(5, 15)

    parent_uuid = None
    for i in range(num_steps):
        step = generate_random_step(i, parent_uuid)
        steps.append(step)
        parent_uuid = step["uuid"]

    return steps

def generate_chat_completion(question):
    """生成聊天完成记录"""
    system_prompt = f"""你是一个华为工程师，需要仔细分析问题中需要配置的功能，借助工具找到文档。
用户问题是：{question}

请使用read_catalogue或read_content工具查找相关配置文档。"""

    completions = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"用户问题是：{question}\n目前已知的文档信息是: []"}
    ]

    # 添加assistant的思考和工具调用
    num_turns = random.randint(3, 8)
    for i in range(num_turns):
        if i % 2 == 0:
            completions.append({
                "role": "assistant",
                "content": f"让我查找相关文档来解决这个问题... 步骤 {i//2 + 1}"
            })
        else:
            completions.append({
                "role": "tool",
                "content": json.dumps({"result": f"查找结果 {i//2 + 1}", "documents": []})
            })

    completions.append({
        "role": "assistant",
        "content": "根据文档说明，配置步骤如下..."
    })

    return completions

def generate_single_trajectory(data_id, training_id, epoch_id, iteration_id, sample_id, tree_id, question):
    """生成单条轨迹"""
    trajectory_id = generate_trajectory_id(
        data_id, training_id, epoch_id, iteration_id, sample_id, tree_id
    )

    # 添加task字段（必需）
    task = {
        "question": question,
        "category": random.choice(["general", "configuration", "troubleshooting", "optimization"])
    }

    trajectory = {
        "trajectory_id": trajectory_id,
        "data_id": data_id,
        "task": task,
        "steps": generate_random_steps(),
        "chat_completions": generate_chat_completion(question),
        "reward": random.uniform(0.0, 1.0),
        "toolcall_reward": random.uniform(0.0, 0.5),
        "res_reward": random.uniform(0.0, 0.5),
        "exec_time": random.uniform(5.0, 60.0),
        "epoch_id": int(epoch_id),
        "iteration_id": int(iteration_id),
        "sample_id": int(sample_id),
        "training_id": training_id,
        "tree_id": tree_id,
        "agent_name": random.choice(["AgentA", "AgentB", "AgentC"]),
        "termination_reason": random.choice(["success", "failed", "timeout", "error"])
    }

    return trajectory

def main():
    """主函数"""
    print("开始生成压力测试数据...")
    print("配置:")
    print("  - 问题数量: 1000")
    print("  - 每个问题的轨迹数: 10")
    print("  - 总轨迹数: 10000")
    print()

    output_file = "/home/coo/code/demo/trajectory_store/data/trajectory_stress_test.jsonl"
    training_id = "20260201_stress_test"

    total_questions = 1000
    trajectories_per_question = 10

    generated_count = 0

    with open(output_file, 'w', encoding='utf-8') as f:
        for question_idx in range(total_questions):
            data_id = generate_data_id(question_idx)
            question = generate_random_question()

            # 每个问题生成10条轨迹（不同的tree_id）
            trajectories = []
            for tree_id in range(trajectories_per_question):
                epoch_id = str(random.randint(0, 10))
                iteration_id = str(random.randint(0, 20))
                sample_id = str(random.randint(0, 5))

                trajectory = generate_single_trajectory(
                    data_id=data_id,
                    training_id=training_id,
                    epoch_id=epoch_id,
                    iteration_id=iteration_id,
                    sample_id=sample_id,
                    tree_id=str(tree_id),
                    question=question
                )

                trajectories.append(trajectory)
                generated_count += 1

            # 写入JSONL文件（每行一个iteration，包含trajectories数组）
            iteration = str(question_idx)
            line = json.dumps({"iteration": iteration, "trajectories": trajectories}, ensure_ascii=False)
            f.write(line + '\n')

            # 进度显示
            if (question_idx + 1) % 100 == 0:
                print(f"已生成 {question_idx + 1} 个问题, {generated_count} 条轨迹...")

    print()
    print(f"✓ 数据生成完成！")
    print(f"  - 总问题数: {total_questions}")
    print(f"  - 总轨迹数: {generated_count}")
    print(f"  - 输出文件: {output_file}")
    print()
    print("文件格式：JSONL（每行一个iteration，包含trajectories数组）")

if __name__ == "__main__":
    main()
