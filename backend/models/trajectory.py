"""
Trajectory数据模型
"""
import json
import time
from typing import Dict, List, Any, Optional, Callable
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class Step(BaseModel):
    """轨迹步骤"""
    step_id: int = 0
    thought: str = ""
    model_response: str = ""
    chat_completions: List = []
    info: Dict = {}
    reward: float = 0.0
    done: bool = False
    mc_return: float = 0.0
    action: Optional[str] = None
    observation: Optional[str] = None


class Task(BaseModel):
    """任务信息"""
    question: str
    ground_truth: str = ""


class TrajectoryMetadata(BaseModel):
    """轨迹元数据（标签、收藏等）"""
    trajectory_id: str
    tags: List[str] = Field(default_factory=list)
    notes: str = ""
    is_bookmarked: bool = False
    source: str = "api"
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class Trajectory(BaseModel):
    """轨迹数据模型"""
    trajectory_id: str
    data_id: str
    task: Dict[str, Any]
    steps: List[Step] = Field(default_factory=list)
    chat_completions: List[Dict] = Field(default_factory=list)
    reward: float = 0.0
    toolcall_reward: float = 0.0
    res_reward: float = 0.0
    exec_time: float = 0.0
    epoch_id: int = 0
    iteration_id: int = 0
    sample_id: int = 0
    training_id: str = ""
    agent_name: str = ""
    termination_reason: str = ""

    # 可选的元数据字段
    tags: List[str] = Field(default_factory=list)
    notes: str = ""
    is_bookmarked: bool = False
    source: str = "api"
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    def get_question(self) -> str:
        """获取问题文本"""
        if isinstance(self.task, dict):
            return self.task.get("question", "")
        return str(self.task)

    def get_ground_truth(self) -> str:
        """获取标准答案"""
        if isinstance(self.task, dict):
            return self.task.get("ground_truth", "")
        return ""

    @field_validator("steps", mode="before")
    @classmethod
    def validate_steps(cls, v):
        """验证steps字段"""
        if v is None:
            return []
        if isinstance(v, list):
            validated_steps = []
            for step in v:
                if isinstance(step, dict):
                    validated_steps.append(Step(**step))
                elif isinstance(step, Step):
                    validated_steps.append(step)
            return validated_steps
        return v

    @field_validator("chat_completions", mode="before")
    @classmethod
    def validate_chat_completions(cls, v):
        """验证chat_completions字段"""
        if v is None:
            return []
        return v


class TrajectoryListResponse(BaseModel):
    """轨迹列表响应"""
    data: List[Trajectory]
    total: int
    page: int
    page_size: int


class TrajectoryFilter(BaseModel):
    """轨迹筛选条件"""
    agent_name: Optional[str] = None
    reward_min: Optional[float] = None
    reward_max: Optional[float] = None
    is_bookmarked: Optional[bool] = None
    tags: Optional[List[str]] = None
    question_id: Optional[str] = None
    search_keyword: Optional[str] = None
