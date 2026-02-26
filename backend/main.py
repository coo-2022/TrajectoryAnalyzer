"""
FastAPI主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.config import settings, get_db_path
from backend.routes import trajectories, import_route, analysis, visualization, export, questions, analysis_stats, training_stats

# ==========================================
# 初始化缓存管理器
# ==========================================
from backend.infrastructure import init_caches
init_caches()

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
app.include_router(training_stats.router)
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

    # 获取轻量级数据计算问题总数和难度分布（使用向量化操作）
    from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())
    df = repo.get_lightweight_df()

    if df.empty:
        return JSONResponse(
            content={
                "totalQuestions": 0,
                "totalTrajectories": 0,
                "passAt1": 0.0,
                "passAtK": 0.0,
                "simpleRatio": 0.0,
                "mediumRatio": 0.0,
                "hardRatio": 0.0
            },
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    # 计算唯一问题数量
    total_questions = df['data_id'].nunique()

    # 使用向量化操作计算每个问题的成功率
    analysis_df = repo.get_analysis_df()

    if not analysis_df.empty:
        # 合并分析结果
        merged = df.merge(analysis_df, on='trajectory_id', how='left')
        merged['is_success'] = merged['is_success'].fillna(False)

        # 按data_id分组计算成功率
        question_stats = merged.groupby('data_id').agg({
            'is_success': ['sum', 'count']
        }).reset_index()
        question_stats.columns = ['data_id', 'success_count', 'total_count']
        question_stats['success_rate'] = question_stats['success_count'] / question_stats['total_count']
    else:
        # 如果没有分析结果，使用reward>0作为成功标准
        question_stats = df.groupby('data_id').agg({
            'reward': [('success_count', lambda x: (x > 0).sum()), ('total_count', 'count')]
        }).reset_index()
        question_stats.columns = ['data_id', 'success_count', 'total_count']
        question_stats['success_rate'] = question_stats['success_count'] / question_stats['total_count']

    # 计算难度分布（向量化）
    import numpy as np
    conditions = [
        question_stats['success_rate'] >= 0.7,
        question_stats['success_rate'] >= 0.4
    ]
    choices = ['easy', 'medium']
    question_stats['difficulty'] = np.select(conditions, choices, default='hard')

    easy_count = int((question_stats['difficulty'] == 'easy').sum())
    medium_count = int((question_stats['difficulty'] == 'medium').sum())
    hard_count = int((question_stats['difficulty'] == 'hard').sum())

    # 计算难度比例
    total_diff = easy_count + medium_count + hard_count
    simple_ratio = float(easy_count / total_diff) if total_diff > 0 else 0.0
    medium_ratio = float(medium_count / total_diff) if total_diff > 0 else 0.0
    hard_ratio = float(hard_count / total_diff) if total_diff > 0 else 0.0

    # 转换为前端期望的格式
    data = {
        "totalQuestions": total_questions,
        "totalTrajectories": stats.total_count,
        "passAt1": stats.pass_at_1,
        "passAtK": stats.pass_at_k,
        "simpleRatio": simple_ratio,
        "mediumRatio": medium_ratio,
        "hardRatio": hard_ratio
    }

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
