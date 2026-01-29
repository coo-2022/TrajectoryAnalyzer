"""
应用配置
"""
import os
from pathlib import Path
from typing import Callable, List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    # 数据库配置
    db_path: str = "data/lancedb"

    # 向量配置
    vector_dimension: int = 384

    # API配置
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True

    # 导入配置
    max_import_size: int = 100 * 1024 * 1024  # 100MB
    import_chunk_size: int = 100

    # 分析配置
    max_turn_limit: int = 8
    context_char_limit: int = 32000

    # CORS配置
    cors_origins: List[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = False


# 全局配置实例
settings = Settings()


def get_db_path() -> str:
    """获取数据库路径，确保目录存在"""
    db_path = settings.db_path
    Path(db_path).mkdir(parents=True, exist_ok=True)
    return db_path
