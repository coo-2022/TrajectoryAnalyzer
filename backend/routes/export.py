"""
导出相关API路由
"""
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
import pandas as pd
import json
import io

from backend.services.trajectory_service import TrajectoryService
from backend.repositories.trajectory import create_default_vector_func
from backend.config import get_db_path

router = APIRouter(prefix="/api/export", tags=["export"])

# 初始化服务
service = TrajectoryService(get_db_path(), create_default_vector_func())


@router.get("/csv")
async def export_csv():
    """导出CSV文件"""
    try:
        # 获取所有轨迹数据
        result = await service.list(page=1, page_size=10000)

        # 转换为DataFrame
        data = []
        for traj in result.data:
            data.append({
                "trajectory_id": traj.trajectory_id,
                "data_id": traj.data_id,
                "question": traj.get_question(),
                "ground_truth": traj.get_ground_truth(),
                "reward": traj.reward,
                "toolcall_reward": traj.toolcall_reward,
                "res_reward": traj.res_reward,
                "exec_time": traj.exec_time,
                "agent_name": traj.agent_name,
                "termination_reason": traj.termination_reason,
                "step_count": len(traj.steps),
                "tags": ",".join(traj.tags),
                "is_bookmarked": traj.is_bookmarked,
                "notes": traj.notes
            })

        df = pd.DataFrame(data)

        # 转换为CSV
        output = io.StringIO()
        df.to_csv(output, index=False)

        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=trajectories.csv"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/json")
async def export_json():
    """导出JSON文件"""
    try:
        # 获取所有轨迹数据
        result = await service.list(page=1, page_size=10000)

        # 转换为字典列表
        data = [t.model_dump() for t in result.data]

        return Response(
            content=json.dumps(data, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=trajectories.json"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf/{trajectory_id}")
async def export_pdf_report(trajectory_id: str):
    """导出单个轨迹的PDF报告"""
    try:
        # 获取轨迹详情
        trajectory = await service.get(trajectory_id)
        if not trajectory:
            raise HTTPException(status_code=404, detail="Trajectory not found")

        # 生成简单的文本报告（PDF生成需要reportlab，这里简化实现）
        report_lines = [
            f"Trajectory Report: {trajectory_id}",
            "=" * 50,
            f"Question: {trajectory.get_question()}",
            f"Agent: {trajectory.agent_name}",
            f"Reward: {trajectory.reward}",
            f"Execution Time: {trajectory.exec_time}s",
            f"Steps: {len(trajectory.steps)}",
            "",
            "Steps Detail:",
        ]

        for i, step in enumerate(trajectory.steps, 1):
            report_lines.append(f"\nStep {i}:")
            report_lines.append(f"  Thought: {step.thought[:100]}...")
            report_lines.append(f"  Action: {step.action}")
            report_lines.append(f"  Reward: {step.reward}")

        report_text = "\n".join(report_lines)

        return Response(
            content=report_text,
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={trajectory_id}_report.txt"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
