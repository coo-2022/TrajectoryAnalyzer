"""
导入日志服务
"""
import time
import threading
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ImportLog:
    """单条导入日志"""
    timestamp: float
    level: str  # info, warning, error
    message: str
    task_id: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "datetime": datetime.fromtimestamp(self.timestamp).strftime("%Y-%m-%d %H:%M:%S"),
            "level": self.level,
            "message": self.message,
            "task_id": self.task_id,
            "details": self.details
        }


class ImportLogger:
    """导入日志记录器"""

    def __init__(self, max_logs: int = 1000):
        self.logs: List[ImportLog] = []
        self.max_logs = max_logs
        self.lock = threading.Lock()

    def log(self, task_id: str, level: str, message: str, **details):
        """记录日志"""
        with self.lock:
            log = ImportLog(
                timestamp=time.time(),
                level=level,
                message=message,
                task_id=task_id,
                details=details
            )
            self.logs.append(log)

            # 限制日志数量
            if len(self.logs) > self.max_logs:
                self.logs.pop(0)

    def info(self, task_id: str, message: str, **details):
        """记录信息日志"""
        self.log(task_id, "info", message, **details)

    def warning(self, task_id: str, message: str, **details):
        """记录警告日志"""
        self.log(task_id, "warning", message, **details)

    def error(self, task_id: str, message: str, **details):
        """记录错误日志"""
        self.log(task_id, "error", message, **details)

    def get_logs(self, task_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """获取日志"""
        with self.lock:
            if task_id:
                filtered = [log for log in self.logs if log.task_id == task_id]
                return [log.to_dict() for log in filtered[-limit:]]
            else:
                return [log.to_dict() for log in self.logs[-limit:]]

    def get_task_logs(self, task_id: str) -> List[Dict[str, Any]]:
        """获取指定任务的所有日志"""
        return self.get_logs(task_id, limit=10000)

    def clear_old_logs(self, max_age_seconds: int = 86400):
        """清理旧日志（默认24小时）"""
        with self.lock:
            current_time = time.time()
            self.logs = [
                log for log in self.logs
                if current_time - log.timestamp < max_age_seconds
            ]


# 全局日志记录器实例
logger = ImportLogger()
