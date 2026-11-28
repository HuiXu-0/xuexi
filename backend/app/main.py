"""FastAPI 应用入口。

对应设计书 §11 的模块化单体结构 —— 一个进程内跑完，
但按领域分层，Agent 只能通过领域服务访问数据。
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import admin, auth, learning, llm_providers, moderation, resources, search
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import setup_logging

settings = get_settings()
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭。"""
    logger.info("后端启动 · env=%s", settings.app_env)
    yield
    logger.info("后端关闭")


app = FastAPI(
    title="校园学习资源共享与知识协作平台 · 后端",
    description=(
        "对应《校园学习资源共享平台_三大Agent可执行设计与领域本体_V1.0》。\n\n"
        "三个 Agent 通过共享领域服务访问数据，不互相调用；"
        "所有权限判定在服务端完成。"
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由 ──
app.include_router(auth.router)
app.include_router(resources.router)
app.include_router(search.router)
app.include_router(moderation.router)
app.include_router(learning.router)
app.include_router(learning.agent_router)
app.include_router(admin.router)
app.include_router(llm_providers.router)


# ── 统一错误处理（设计书 §3.4）──
@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    logger.warning(
        "[%s] %s %s -> %s: %s",
        exc.trace_id,
        request.method,
        request.url.path,
        exc.code,
        exc.message,
    )
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    trace_id = uuid.uuid4().hex[:16]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "请求数据不符合要求。",
                "retryable": False,
                "trace_id": trace_id,
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    trace_id = uuid.uuid4().hex[:16]
    logger.exception("[%s] 未处理异常 %s %s", trace_id, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "服务内部错误。",
                "retryable": True,
                "trace_id": trace_id,
            }
        },
    )


@app.get("/api/health")
def health() -> dict[str, object]:
    """健康检查。同时报告 LLM 与向量检索是否已配置 ——
    没配置时相关接口会走安全降级（设计书 §9.4）。

    **模型服务是否可用要从数据库判断** —— 它现在是管理员在界面上可切换的
    （llm_providers 表），不再是环境变量说了算。
    """
    llm_state: dict[str, object] = {"available": False, "provider": None, "model": None}
    try:
        from app.core.db import SessionLocal
        from app.services.llm_service import get_active_provider

        db = SessionLocal()
        try:
            provider = get_active_provider(db)
            if provider is not None:
                llm_state = {
                    "available": bool(provider.api_key_enc and provider.default_model),
                    "provider": provider.code,
                    "model": provider.default_model,
                }
        finally:
            db.close()
    except Exception:
        pass

    return {
        "status": "ok",
        "env": settings.app_env,
        "llm_enabled": bool(llm_state["available"]),
        "llm_provider": llm_state["provider"],
        "llm_model": llm_state["model"],
        "vector_search_enabled": settings.embedding_enabled,
    }
