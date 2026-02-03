"""
FastAPI主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.config import settings, get_db_path
from backend.routes import trajectories, import_route, analysis, visualization, export, questions, analysis_stats

# ==========================================
# 全局Service实例（复用缓存）
# ==========================================
from backend.services.trajectory_service import TrajectoryService
from backend.repositories.trajectory import create_default_vector_func

# 创建全局service实例
_trajectory_service = None

def get_trajectory_service():
    """获取全局TrajectoryService实例"""
    global _trajectory_service
    if _trajectory_service is None:
        _trajectory_service = TrajectoryService(vector_func=create_default_vector_func())
    return _trajectory_service

# 创建FastAPI应用
app = FastAPI(
    title="Trajectory Analysis API",
    description="AI Agent Trajectory Analysis and Management System",
    version="1.0.0"
)

# 增加上传大小限制到 10GB (支持大轨迹文件)
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class MaxSizeMiddleware(BaseHTTPMiddleware):
    """增加请求体大小限制"""
    async def dispatch(self, request: Request, call_next):
        # 不限制上传大小，让应用自己处理
        return await call_next(request)

app.add_middleware(MaxSizeMiddleware)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(trajectories.router)
app.include_router(import_route.router)
app.include_router(analysis.router)
app.include_router(analysis_stats.router)
app.include_router(visualization.router)
app.include_router(export.router)
app.include_router(questions.router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Trajectory Analysis API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "trajectories": "/api/trajectories",
            "import": "/api/import",
            "analysis": "/api/analysis",
            "visualization": "/api/viz",
            "export": "/api/export",
            "questions": "/api/questions",
            "stats": "/stats"
        }
    }


@app.get("/stats")
async def get_global_stats():
    """全局统计信息 - 使用全局缓存service"""
    # 使用全局service实例（有60秒缓存）
    service = get_trajectory_service()
    stats = await service.get_statistics()

    # 转换为前端期望的格式
    data = {
        "totalQuestions": stats.total_count,
        "totalTrajectories": stats.total_count,
        "passAt1": stats.pass_at_1,
        "passAtK": stats.pass_at_k,
        "simpleRatio": 0.0,  # 暂时设为0，需要从questions计算
        "mediumRatio": 0.0,
        "hardRatio": 0.0
    }

    # TODO: 从service层获取难度分布统计
    # 这需要额外的计算，暂时简化处理

    # 添加禁用缓存的响应头
    return JSONResponse(
        content=data,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理"""
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload
    )
