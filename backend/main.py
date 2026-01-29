"""
FastAPI主应用
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.config import settings, get_db_path
from backend.routes import trajectories, import_route, analysis, visualization, export, questions

# 创建FastAPI应用
app = FastAPI(
    title="Trajectory Analysis API",
    description="AI Agent Trajectory Analysis and Management System",
    version="1.0.0"
)

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
    """全局统计信息"""
    from backend.repositories.trajectory import create_default_vector_func, TrajectoryRepository

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())
    df = repo.get_lightweight_df()

    if df.empty:
        data = {
            "totalQuestions": 0,
            "totalTrajectories": 0,
            "passAt1": 0.0,
            "passAtK": 0.0,
            "simpleRatio": 0.0,
            "mediumRatio": 0.0,
            "hardRatio": 0.0
        }
    else:
        # 获取分析数据
        analysis_df = repo.get_analysis_df()

        # 统计
        total_trajectories = len(df)
        unique_questions = df['data_id'].nunique()

        # 计算成功率
        if not analysis_df.empty:
            merged = df.merge(analysis_df, on='trajectory_id', how='left')
            merged['is_success'] = merged['is_success'].fillna(False)

            # Pass@1: 平均成功率
            pass_at_1 = float(merged['is_success'].mean())

            # Pass@K: 至少一次成功
            pass_at_k = 1.0 if merged['is_success'].any() else 0.0
        else:
            # 简单用reward > 0判断
            pass_at_1 = float((df['reward'] > 0).mean())
            pass_at_k = 1.0 if (df['reward'] > 0).any() else 0.0

        # 计算难度分布
        question_stats = []
        for data_id in df['data_id'].unique():
            question_df = df[df['data_id'] == data_id]

            if not analysis_df.empty:
                merged = question_df.merge(analysis_df, on='trajectory_id', how='left')
                merged['is_success'] = merged['is_success'].fillna(False)
                success_rate = merged['is_success'].mean()
            else:
                success_rate = (question_df['reward'] > 0).mean()

            question_stats.append(success_rate)

        # 根据成功率分类
        simple_count = sum(1 for r in question_stats if r >= 0.7)
        medium_count = sum(1 for r in question_stats if 0.4 <= r < 0.7)
        hard_count = len(question_stats) - simple_count - medium_count

        total_q = len(question_stats)
        simple_ratio = simple_count / total_q if total_q > 0 else 0.0
        medium_ratio = medium_count / total_q if total_q > 0 else 0.0
        hard_ratio = hard_count / total_q if total_q > 0 else 0.0

        data = {
            "totalQuestions": unique_questions,
            "totalTrajectories": total_trajectories,
            "passAt1": pass_at_1,
            "passAtK": pass_at_k,
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
