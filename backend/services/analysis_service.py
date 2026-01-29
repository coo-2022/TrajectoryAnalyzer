"""
分析服务
"""
import time
from typing import List, Dict, Any, Optional
from collections import defaultdict

from backend.models.analysis import AnalysisResult, AnalysisStatistics, AnalysisReport, FailureDistribution
from backend.models.trajectory import Trajectory
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.analyzers.failure_analyzer import setup_engine, is_success_or_failed
from backend.config import settings, get_db_path


class AnalysisService:
    """分析服务"""

    def __init__(self, db_uri: Optional[str] = None, vector_func=None, engine=None):
        self.db_uri = db_uri or get_db_path()
        self.vector_func = vector_func or create_default_vector_func()
        self.repository = TrajectoryRepository(self.db_uri, self.vector_func)
        self.engine = engine or setup_engine()

    async def analyze_trajectory(self, traj_data: Dict[str, Any]) -> AnalysisResult:
        """分析单个轨迹"""
        trajectory_id = traj_data.get("trajectory_id", "unknown")

        # 获取chat_completions用于分析
        chat_completions = traj_data.get("chat_completions", [])

        # 构建统计上下文
        stats_context = {
            "reward": traj_data.get("reward", 0.0),
            "exec_time": traj_data.get("exec_time", 0.0),
            "step_count": len(traj_data.get("steps", []))
        }

        # 执行分析
        category, root_cause = self.engine.analyze(chat_completions, stats_context)

        # 判断是否成功
        is_success = is_success_or_failed(traj_data.get("reward", 0.0))

        # 生成建议
        suggestion = self._generate_suggestion(category, root_cause, stats_context)

        result = AnalysisResult(
            trajectory_id=trajectory_id,
            is_success=is_success,
            category=category,
            root_cause=root_cause,
            suggestion=suggestion,
            analyzed_at=time.time()
        )

        # 保存分析结果
        self.repository.save_analysis(result)

        return result

    async def batch_analyze(self, trajectories: List[Dict[str, Any]]) -> List[AnalysisResult]:
        """批量分析轨迹"""
        results = []

        for traj_data in trajectories:
            try:
                result = await self.analyze_trajectory(traj_data)
                results.append(result)
            except Exception as e:
                # 创建失败结果
                results.append(AnalysisResult(
                    trajectory_id=traj_data.get("trajectory_id", "unknown"),
                    is_success=False,
                    category="Analysis Error",
                    root_cause=str(e),
                    suggestion="分析过程中发生错误"
                ))

        return results

    async def get_analysis(self, trajectory_id: str) -> Optional[AnalysisResult]:
        """获取分析结果"""
        return self.repository.get_analysis(trajectory_id)

    async def get_statistics(self) -> AnalysisStatistics:
        """获取全局统计"""
        df = self.repository.get_lightweight_df()
        analysis_df = self.repository.get_analysis_df()

        if df.empty:
            return AnalysisStatistics()

        total_count = len(df)

        # 合并数据
        merged_df = df.merge(analysis_df, on='trajectory_id', how='left')
        merged_df['is_success'] = merged_df['is_success'].fillna(False)

        success_count = int(merged_df['is_success'].sum())
        failure_count = total_count - success_count

        # 计算Pass@1和Pass@K
        # Pass@1: 平均成功率
        pass_at_1 = float(merged_df['is_success'].mean())

        # Pass@K: 至少一次成功的比例
        pass_at_k = float(merged_df['is_success'].max()) if total_count > 0 else 0.0

        # 平均值
        avg_reward = float(df['reward'].mean()) if 'reward' in df.columns else 0.0
        avg_exec_time = float(df['exec_time'].mean()) if 'exec_time' in df.columns else 0.0

        return AnalysisStatistics(
            total_count=total_count,
            success_count=success_count,
            failure_count=failure_count,
            pass_at_1=pass_at_1,
            pass_at_k=pass_at_k,
            avg_reward=avg_reward,
            avg_exec_time=avg_exec_time
        )

    async def get_failure_distribution(self) -> List[FailureDistribution]:
        """获取失败原因分布"""
        analysis_df = self.repository.get_analysis_df()

        if analysis_df.empty:
            return []

        # 统计各失败类别的数量
        failure_df = analysis_df[analysis_df['is_success'] == False]
        if failure_df.empty:
            return []

        category_counts = failure_df['category'].value_counts()
        total = len(failure_df)

        distribution = []
        for category, count in category_counts.items():
            distribution.append(FailureDistribution(
                category=category,
                count=int(count),
                percentage=float(count) / total * 100
            ))

        # 按数量排序
        distribution.sort(key=lambda x: x.count, reverse=True)
        return distribution

    async def filter_by_category(self, category: str) -> List[Trajectory]:
        """按失败类别筛选轨迹"""
        analysis_df = self.repository.get_analysis_df()

        # 获取该类别的trajectory_id
        filtered = analysis_df[analysis_df['category'] == category]
        trajectory_ids = filtered['trajectory_id'].tolist()

        # 获取轨迹详情
        trajectories = []
        for traj_id in trajectory_ids:
            traj = self.repository.get(traj_id)
            if traj:
                trajectories.append(traj)

        return trajectories

    async def generate_report(self) -> Dict[str, Any]:
        """生成分析报告"""
        stats = await self.get_statistics()
        failures = await self.get_failure_distribution()

        # 获取Top失败原因
        top_failures = [
            {"category": f.category, "count": f.count, "suggestion": self._generate_suggestion(f.category, "", {})}
            for f in failures[:5]
        ]

        return {
            "total_count": stats.total_count,
            "pass_at_1": stats.pass_at_1,
            "pass_at_k": stats.pass_at_k,
            "failures": [f.model_dump() for f in failures],
            "top_failure_reasons": top_failures
        }

    def _generate_suggestion(self, category: str, root_cause: str, stats: Dict) -> str:
        """生成改进建议"""
        suggestions = {
            "1. Trajectory Anomaly (Format)": "建议检查工具调用格式，确保开始和结束标签匹配",
            "1. Trajectory Anomaly (Loop)": "建议添加重试限制或循环检测机制",
            "1. Trajectory Anomaly (Truncated)": "建议增加上下文长度限制检查",
            "2. Trajectory Error (Logic)": "建议改进推理逻辑，增加验证步骤",
            "4. Model Capability Issue": "建议增加更多示例或提供更清晰的提示"
        }

        # 根据类别返回建议
        for key, suggestion in suggestions.items():
            if key in category:
                return suggestion

        # 根据root_cause返回建议
        if "repeated" in root_cause.lower():
            return "检测到重复错误，建议添加错误处理和重试机制"
        elif "format" in root_cause.lower():
            return "建议检查和修复工具调用格式"
        elif "limit" in root_cause.lower():
            return "建议优化上下文使用或增加长度限制"

        return "建议查看完整轨迹日志以获取更多信息"
