"""
统计分析服务
提供轨迹终止原因、工具返回、奖励分类、过程相关性等统计分析
"""
import json
from typing import Dict, List, Any, Optional
import pandas as pd
from scipy.stats import kendalltau

from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import settings, get_db_path


class AnalysisStatsService:
    """统计分析服务"""

    def __init__(self):
        self.repo = TrajectoryRepository(
            get_db_path(),
            create_default_vector_func()
        )

    # ==================== 1. 终止原因统计 ====================

    def _classify_termination(self, termination_reason: str) -> str:
        """分类终止原因"""
        if not termination_reason:
            return "unknown"

        reason_lower = termination_reason.lower()

        # 优先级: finish > timeout > truncation > env_done
        if any(kw in reason_lower for kw in ["finish", "completed", "done"]):
            return "finish"
        if any(kw in reason_lower for kw in ["timeout", "timed_out", "time out"]):
            return "timeout"
        if any(kw in reason_lower for kw in ["truncated", "max_steps", "step_limit", "limit"]):
            return "truncation"
        if any(kw in reason_lower for kw in ["success", "env_done", "solved", "correct"]):
            return "env_done"

        # 其他情况归为 unknown
        return "unknown"

    def get_termination_stats(self) -> Dict[str, Any]:
        """获取终止原因统计"""
        df = self.repo.tbl.search().limit(100000).to_pandas()

        if df.empty:
            return {
                "total": 0,
                "categories": {
                    "env_done": {"count": 0, "ratio": 0.0},
                    "truncation": {"count": 0, "ratio": 0.0},
                    "timeout": {"count": 0, "ratio": 0.0},
                    "finish": {"count": 0, "ratio": 0.0}
                },
                "unexpected": {"count": 0, "ratio": 0.0}
            }

        total = len(df)

        # 分类统计
        categories = {
            "env_done": 0,
            "truncation": 0,
            "timeout": 0,
            "finish": 0,
            "unknown": 0
        }

        for termination_reason in df['termination_reason']:
            cat = self._classify_termination(str(termination_reason))
            categories[cat] = categories.get(cat, 0) + 1

        # 计算比例
        result_categories = {}
        for cat, count in categories.items():
            if cat != "unknown":
                result_categories[cat] = {
                    "count": count,
                    "ratio": round(count / total, 3) if total > 0 else 0.0
                }

        # 非正常终止 = truncation + timeout + unknown
        unexpected_count = categories.get("truncation", 0) + categories.get("timeout", 0) + categories.get("unknown", 0)

        return {
            "total": total,
            "categories": result_categories,
            "unexpected": {
                "count": unexpected_count,
                "ratio": round(unexpected_count / total, 3) if total > 0 else 0.0
            }
        }

    # ==================== 2. 工具返回统计 ====================

    def _classify_tool_return(self, observation: str) -> str:
        """分类工具返回结果"""
        if not observation or not str(observation).strip():
            return "empty"

        obs_lower = str(observation).lower()

        # 优先级: timeout > connection_error > normal
        if any(kw in obs_lower for kw in ["timeout", "timed out", "time out"]):
            return "timeout"
        if any(kw in obs_lower for kw in ["connection", "network error", "connect failed", "connection refused"]):
            return "connection_error"

        return "normal"

    def get_tool_return_stats(self, limit: int = 10000) -> Dict[str, Any]:
        """获取工具返回统计"""
        df = self.repo.tbl.search().limit(limit).to_pandas()

        if df.empty:
            return {
                "total_tool_calls": 0,
                "categories": {
                    "normal": {"count": 0, "ratio": 0.0},
                    "empty": {"count": 0, "ratio": 0.0},
                    "timeout": {"count": 0, "ratio": 0.0},
                    "connection_error": {"count": 0, "ratio": 0.0}
                },
                "unexpected": {
                    "count": 0,
                    "ratio": 0.0
                }
            }

        # 统计所有工具调用
        categories = {
            "normal": 0,
            "empty": 0,
            "timeout": 0,
            "connection_error": 0
        }

        total_tool_calls = 0

        for steps_json in df['steps_json']:
            try:
                steps = json.loads(steps_json)
                for step in steps:
                    observation = step.get('observation', '')
                    cat = self._classify_tool_return(observation)
                    categories[cat] = categories.get(cat, 0) + 1
                    total_tool_calls += 1
            except (json.JSONDecodeError, TypeError):
                continue

        # 计算比例
        result_categories = {}
        for cat, count in categories.items():
            result_categories[cat] = {
                "count": count,
                "ratio": round(count / total_tool_calls, 3) if total_tool_calls > 0 else 0.0
            }

        # 异常返回 = empty + timeout + connection_error
        unexpected_count = categories.get("empty", 0) + categories.get("timeout", 0) + categories.get("connection_error", 0)

        return {
            "total_tool_calls": total_tool_calls,
            "categories": result_categories,
            "unexpected": {
                "count": unexpected_count,
                "ratio": round(unexpected_count / total_tool_calls, 3) if total_tool_calls > 0 else 0.0
            }
        }

    def get_unexpected_tool_contexts(
        self,
        category: Optional[str] = None,
        limit: int = 50
    ) -> Dict[str, Any]:
        """获取异常工具返回的上下文"""
        df = self.repo.tbl.search().limit(limit * 10).to_pandas()  # 获取更多数据以筛选

        unexpected_contexts = []

        for _, row in df.iterrows():
            trajectory_id = row['trajectory_id']
            task = row['task']
            question = task.get('question', '') if isinstance(task, dict) else ''

            try:
                steps = json.loads(row['steps_json'])
                for step in steps:
                    observation = step.get('observation', '')
                    cat = self._classify_tool_return(observation)

                    # 如果指定了category，只返回该类别
                    if category and cat != category:
                        continue

                    # 只返回异常的
                    if cat in ["empty", "timeout", "connection_error"]:
                        unexpected_contexts.append({
                            "trajectory_id": trajectory_id,
                            "step_id": step.get('step_id', 0),
                            "action": step.get('action', ''),
                            "observation": observation,
                            "category": cat,
                            "context": {
                                "question": question[:100] + "..." if len(question) > 100 else question,
                                "step_number": step.get('step_id', 0)
                            }
                        })
            except (json.JSONDecodeError, TypeError):
                continue

            if len(unexpected_contexts) >= limit:
                break

        return {
            "total": len(unexpected_contexts),
            "data": unexpected_contexts[:limit]
        }

    # ==================== 3. 奖励分类统计 ====================

    def get_reward_category_stats(self) -> Dict[str, Any]:
        """获取奖励分类统计"""
        df = self.repo.tbl.search().limit(100000).to_pandas()

        if df.empty:
            return {
                "total": 0,
                "max_reward": 0.0,
                "min_reward": 0.0,
                "avg_reward": 0.0,
                "categories": {
                    "perfect_score": {"count": 0, "ratio": 0.0},
                    "complete_failure": {"count": 0, "ratio": 0.0},
                    "partial_success": {"count": 0, "ratio": 0.0}
                }
            }

        total = len(df)
        rewards = df['reward'].tolist()

        max_reward = float(max(rewards)) if rewards else 0.0
        min_reward = float(min(rewards)) if rewards else 0.0
        avg_reward = float(sum(rewards) / len(rewards)) if rewards else 0.0

        # 分类统计
        perfect_score = sum(1 for r in rewards if r >= 1.0)
        complete_failure = sum(1 for r in rewards if r <= 0)
        partial_success = total - perfect_score - complete_failure

        return {
            "total": total,
            "max_reward": round(max_reward, 3),
            "min_reward": round(min_reward, 3),
            "avg_reward": round(avg_reward, 3),
            "categories": {
                "perfect_score": {
                    "count": perfect_score,
                    "ratio": round(perfect_score / total, 3) if total > 0 else 0.0
                },
                "complete_failure": {
                    "count": complete_failure,
                    "ratio": round(complete_failure / total, 3) if total > 0 else 0.0
                },
                "partial_success": {
                    "count": partial_success,
                    "ratio": round(partial_success / total, 3) if total > 0 else 0.0
                }
            }
        }

    # ==================== 4. 过程奖励相关性分析 ====================

    def get_process_reward_correlation(self, limit: int = 10000) -> Dict[str, Any]:
        """获取过程奖励与最终奖励的相关性分析"""
        df = self.repo.tbl.search().limit(limit).to_pandas()

        if df.empty:
            return {
                "kendall_tau": 0.0,
                "p_value": 1.0,
                "sample_size": 0,
                "interpretation": "no_data",
                "suggested_strategy": "insufficient_data",
                "scatter_data": {"x": [], "y": [], "trajectory_ids": []}
            }

        avg_process_rewards = []
        final_rewards = []
        trajectory_ids = []

        for _, row in df.iterrows():
            try:
                steps = json.loads(row['steps_json'])
                if steps:  # 只包含有步骤的轨迹
                    # 计算平均过程奖励
                    process_rewards = [step.get('reward', 0.0) for step in steps]
                    avg_process = sum(process_rewards) / len(process_rewards) if process_rewards else 0.0

                    avg_process_rewards.append(avg_process)
                    final_rewards.append(float(row['reward']))
                    trajectory_ids.append(row['trajectory_id'])
            except (json.JSONDecodeError, TypeError):
                continue

        if len(avg_process_rewards) < 2:
            return {
                "kendall_tau": 0.0,
                "p_value": 1.0,
                "sample_size": len(avg_process_rewards),
                "interpretation": "insufficient_data",
                "suggested_strategy": "need_more_samples",
                "scatter_data": {"x": [], "y": [], "trajectory_ids": []}
            }

        # 计算 Kendall's tau
        try:
            correlation, p_value = kendalltau(avg_process_rewards, final_rewards)
            # 处理 nan 和 inf
            if not (correlation >= -1 or correlation <= 1):  # 检查是否为 nan
                correlation = 0.0
                p_value = 1.0
            elif not isinstance(correlation, (int, float)):
                correlation = 0.0
                p_value = 1.0
            else:
                correlation = float(correlation)
                p_value = float(p_value)
        except Exception as e:
            # 处理计算错误（如常数值）
            correlation = 0.0
            p_value = 1.0

        # 解释相关性
        interpretation, suggested_strategy = self._interpret_correlation(correlation)

        return {
            "kendall_tau": round(correlation, 3),
            "p_value": round(p_value, 4),
            "sample_size": len(avg_process_rewards),
            "interpretation": interpretation,
            "suggested_strategy": suggested_strategy,
            "scatter_data": {
                "x": [round(x, 3) for x in avg_process_rewards],
                "y": [round(y, 3) for y in final_rewards],
                "trajectory_ids": trajectory_ids
            }
        }

    def _interpret_correlation(self, tau: float) -> tuple:
        """解释相关系数并建议策略"""
        abs_tau = abs(tau)

        if abs_tau >= 0.7:
            if tau > 0:
                return "strong_positive_correlation", "beam_search"
            else:
                return "strong_negative_correlation", "2.0"
        elif abs_tau >= 0.3:
            if tau > 0:
                return "moderate_positive_correlation", "beam_search"
            else:
                return "moderate_negative_correlation", "2.0"
        elif abs_tau >= 0.1:
            if tau > 0:
                return "weak_positive_correlation", "2.0"
            else:
                return "weak_negative_correlation", "2.0"
        else:
            return "no_correlation", "2.0"
