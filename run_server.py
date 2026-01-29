"""
启动API服务器
"""
import uvicorn
from backend.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )
