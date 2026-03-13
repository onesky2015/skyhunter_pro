# filename: backend/main.py
import logging
import traceback
import os
import random
from typing import Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse, RedirectResponse
from sqlmodel import Session, select

from config import (
    APP_VERSION, APP_DESCRIPTION, CORS_ALLOWED_ORIGINS, API_BASE_URL, logger
)
from db import engine

# Import services
from services.scheduler import start_scheduler, stop_scheduler
from models.database import TransactionHistory, User, MonitorTask

def _run_migrations():
    """添加新列/表（兼容已有数据库）
    PostgreSQL 要求每条 ALTER TABLE 在独立事务中，否则一条失败会毒化整个事务。
    """
    from sqlalchemy import text

    migrations = [
        ("ALTER TABLE monitor_tasks ADD COLUMN email_notified_at VARCHAR", "monitor_tasks.email_notified_at"),
        ("ALTER TABLE airports ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE", "airports.is_disabled"),
        ("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT TRUE", "users.email_verified（已有用户默认 True）"),
        ("ALTER TABLE users ADD COLUMN email_verified_at VARCHAR", "users.email_verified_at"),
        ("ALTER TABLE users ADD COLUMN country VARCHAR", "users.country"),
        ("ALTER TABLE users ADD COLUMN region VARCHAR", "users.region"),
        ("ALTER TABLE users ADD COLUMN city VARCHAR", "users.city"),
        ("ALTER TABLE users ADD COLUMN signup_ip VARCHAR", "users.signup_ip"),
        ("ALTER TABLE users ADD COLUMN last_login_at VARCHAR", "users.last_login_at"),
        ("ALTER TABLE users ADD COLUMN last_login_ip VARCHAR", "users.last_login_ip"),
        ("ALTER TABLE users ADD COLUMN totp_secret VARCHAR", "users.totp_secret"),
        ("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE", "users.totp_enabled"),
    ]
    for sql, desc in migrations:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info(f"  📦 已添加 {desc} 列")
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    import models.database
    from sqlmodel import SQLModel
    
    logger.info(f"🚀 初始化 SkyHunter API v{APP_VERSION}...")
    try:
        SQLModel.metadata.create_all(engine)
        _run_migrations()
        logger.info("✅ 数据库表结构初始化成功")
    except Exception as e:
        logger.error(f"❌ 数据库初始化失败: {e}")

    start_scheduler()
    logger.info("✅ 调度器启动完成")
    
    yield
    
    logger.info("⏳ 正在关闭服务...")
    stop_scheduler()
    logger.info("✅ 调度器已关闭")


app = FastAPI(
    title="SkyHunter Pro API",
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

from core.middleware import ApiUsageLogMiddleware
app.add_middleware(ApiUsageLogMiddleware)

@app.exception_handler(HTTPException)
async def cors_http_exception_handler(request: StarletteRequest, exc: HTTPException):
    from starlette.responses import JSONResponse
    origin = request.headers.get("origin")
    headers = getattr(exc, "headers", None) or {}
    if origin in CORS_ALLOWED_ORIGINS or "*" in CORS_ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin or "*"
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=headers)

@app.get("/", tags=["health"])
async def root():
    return {"message": f"Welcome to SkyHunter Pro API {APP_VERSION}"}

@app.get("/api/v1/health", tags=["health"])
async def health_check():
    from config import USE_MOCK_DATA, DB_MODE, DB_MODE, SCHEDULER_INTERVAL_HOURS
    from services.scheduler import _scheduler
    scheduler_running = _scheduler is not None and _scheduler.running if _scheduler else False
    return {
        "status": "ok", "version": APP_VERSION,
        "database": DB_MODE, "mock_mode": USE_MOCK_DATA,
        "scheduler": {"running": scheduler_running, "interval_hours": SCHEDULER_INTERVAL_HOURS}
    }

@app.get("/api/v1/track/{monitor_id}", summary="预订链接点击追踪", tags=["track"])
async def track_booking_click(monitor_id: int):
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.booking_link:
            link = task.booking_link
            task.click_count += 1
            task.last_clicked_at = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            session.add(task)
            session.commit()
            return RedirectResponse(url=link)
        raise HTTPException(status_code=400, detail="No booking link available")

# Import routers
from routers import users, flights, admin, admin_analytics
app.include_router(users.router)
app.include_router(flights.router)
app.include_router(admin.router)
app.include_router(admin_analytics.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

