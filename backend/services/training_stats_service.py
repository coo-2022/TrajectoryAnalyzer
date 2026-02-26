"""
Training 统计服务
提供 Epoch 维度和 Iteration 维度的训练统计数据
"""
from typing import Dict, List, Any, Optional
import pandas as pd
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import get_db_path


class TrainingStatsService:
    """Training 统计服务"""

    def __init__(self):
        self.repo = TrajectoryRepository(
            get_db_path(),
            create_default_vector_func()
        )

    def get_training_runs(self) -> List[str]:
        """获取所有 training_id 列表"""
        df = self.repo.tbl.search().limit(100000).to_pandas()
        if df.empty:
            return []

        training_ids = df['training_id'].dropna().unique().tolist()
        return sorted([tid for tid in training_ids if tid])

    def get_epoch_level_stats(
        self,
        training_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        获取 Epoch 维度统计数据

        Args:
            training_ids: 指定的 training_id 列表，None 则返回所有

        Returns:
            {
                "trainings": [
                    {
                        "training_id": str,
                        "epochs": [
                            {
                                "epoch": int,
                                "pass_at_1": float,
                                "pass_at_k": float,
                                "avg_reward": float,
                                "success_rate": float
                            }
                        ]
                    }
                ]
            }
        """
        df = self.repo.tbl.search().limit(100000).to_pandas()
        if df.empty:
            return {"trainings": []}

        # 过滤指定的 training_ids
        if training_ids:
            df = df[df['training_id'].isin(training_ids)]

        if df.empty:
            return {"trainings": []}

        trainings = []

        for training_id in df['training_id'].unique():
            if not training_id:
                continue

            training_df = df[df['training_id'] == training_id]

            epochs_data = []
            for epoch_id in sorted(training_df['epoch_id'].unique()):
                if epoch_id is None or epoch_id == 0:
                    continue

                epoch_df = training_df[training_df['epoch_id'] == epoch_id]

                # 计算指标
                total = len(epoch_df)
                if total == 0:
                    continue

                # Pass@1: 平均成功率
                pass_at_1 = epoch_df['reward'].apply(lambda r: 1.0 if r > 0 else 0.0).mean()

                # 按 data_id 分组计算 Pass@K
                data_ids = epoch_df['data_id'].unique()
                pass_at_k_count = 0
                for data_id in data_ids:
                    data_df = epoch_df[epoch_df['data_id'] == data_id]
                    if (data_df['reward'] > 0).any():
                        pass_at_k_count += 1
                pass_at_k = pass_at_k_count / len(data_ids) if data_ids.size > 0 else 0.0

                # 平均奖励
                avg_reward = epoch_df['reward'].mean()

                # 成功率
                success_rate = (epoch_df['reward'] > 0).sum() / total

                epochs_data.append({
                    "epoch": int(epoch_id),
                    "pass_at_1": round(pass_at_1, 4),
                    "pass_at_k": round(pass_at_k, 4),
                    "avg_reward": round(float(avg_reward), 4),
                    "success_rate": round(success_rate, 4)
                })

            if epochs_data:
                trainings.append({
                    "training_id": str(training_id),
                    "epochs": epochs_data
                })

        return {"trainings": trainings}

    def get_iteration_level_stats(
        self,
        training_id: str,
        epoch_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        获取 Iteration 维度统计数据

        Args:
            training_id: 指定的 training_id
            epoch_ids: 指定的 epoch_id 列表，None 则返回所有 epoch

        Returns:
            {
                "training_id": str,
                "epochs": [
                    {
                        "epoch_id": int,
                        "iterations": [
                            {
                                "iteration": int,
                                "pass_at_1": float,
                                "pass_at_k": float,
                                "avg_reward": float,
                                "success_rate": float
                            }
                        ]
                    }
                ]
            }
        """
        df = self.repo.tbl.search().limit(100000).to_pandas()
        if df.empty:
            return {"training_id": training_id, "epochs": []}

        # 过滤指定的 training_id
        df = df[df['training_id'] == training_id]

        if df.empty:
            return {"training_id": training_id, "epochs": []}

        # 过滤指定的 epoch_ids
        if epoch_ids:
            df = df[df['epoch_id'].isin(epoch_ids)]

        epochs_data = []

        for epoch_id in sorted(df['epoch_id'].unique()):
            if epoch_id is None or epoch_id == 0:
                continue

            epoch_df = df[df['epoch_id'] == epoch_id]

            iterations = []
            for iteration_id in sorted(epoch_df['iteration_id'].unique()):
                if iteration_id is None:
                    continue

                iter_df = epoch_df[epoch_df['iteration_id'] == iteration_id]
                total = len(iter_df)

                if total == 0:
                    continue

                # Pass@1
                pass_at_1 = iter_df['reward'].apply(lambda r: 1.0 if r > 0 else 0.0).mean()

                # Pass@K
                data_ids = iter_df['data_id'].unique()
                pass_at_k_count = 0
                for data_id in data_ids:
                    data_df = iter_df[iter_df['data_id'] == data_id]
                    if (data_df['reward'] > 0).any():
                        pass_at_k_count += 1
                pass_at_k = pass_at_k_count / len(data_ids) if data_ids.size > 0 else 0.0

                # 平均奖励和成功率
                avg_reward = iter_df['reward'].mean()
                success_rate = (iter_df['reward'] > 0).sum() / total

                iterations.append({
                    "iteration": int(iteration_id),
                    "pass_at_1": round(pass_at_1, 4),
                    "pass_at_k": round(pass_at_k, 4),
                    "avg_reward": round(float(avg_reward), 4),
                    "success_rate": round(success_rate, 4)
                })

            if iterations:
                epochs_data.append({
                    "epoch_id": int(epoch_id),
                    "iterations": iterations
                })

        return {
            "training_id": training_id,
            "epochs": epochs_data
        }
