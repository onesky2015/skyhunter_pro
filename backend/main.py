# filename: backend/main.py
import logging
import traceback
import os
from urllib.parse import urlparse
from typing import Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse, RedirectResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlmodel import Session, select

from config import (
    APP_VERSION, APP_DESCRIPTION, CORS_ALLOWED_ORIGINS, API_BASE_URL, SENTRY_DSN,
    USE_MOCK_DATA, logger
)

if SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment="production" if not __debug__ else "development",
        release=APP_VERSION,
    )
    logger.info(f"Sentry initialized (release={APP_VERSION})")
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
        ("ALTER TABLE airports ADD COLUMN name_zh VARCHAR", "airports.name_zh"),
        ("ALTER TABLE airports ADD COLUMN municipality_zh VARCHAR", "airports.municipality_zh"),
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
        ("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'email'", "users.auth_provider"),
        ("ALTER TABLE users ADD COLUMN apple_sub VARCHAR", "users.apple_sub"),
        ("ALTER TABLE users ADD COLUMN google_sub VARCHAR", "users.google_sub"),
    ]
    for sql, desc in migrations:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            logger.info(f"  📦 已添加 {desc} 列")
        except Exception:
            pass


def _seed_default_configs():
    """首次启动时写入默认 SystemConfig（已有 key 不覆盖，保护用户自定义值）。"""
    import json
    from sqlmodel import Session, select
    from models.database import SystemConfig

    defaults = {
        "airport_search_aliases": json.dumps(
            {
                "北京": ["PEK", "PKX"],
                "上海": ["PVG", "SHA"],
                "广州": ["CAN"],
                "深圳": ["SZX"],
                "成都": ["CTU", "TFU"],
                "重庆": ["CKG"],
                "杭州": ["HGH"],
                "南京": ["NKG"],
                "武汉": ["WUH"],
                "西安": ["XIY"],
                "昆明": ["KMG"],
                "长沙": ["CSX"],
                "厦门": ["XMN"],
                "青岛": ["TAO"],
                "大连": ["DLC"],
                "天津": ["TSN"],
                "沈阳": ["SHE"],
                "哈尔滨": ["HRB"],
                "海口": ["HAK"],
                "三亚": ["SYX"],
                "郑州": ["CGO"],
                "福州": ["FOC"],
                "珠海": ["ZUH"],
                "贵阳": ["KWE"],
                "南宁": ["NNG"],
                "乌鲁木齐": ["URC"],
                "兰州": ["LHW"],
                "银川": ["INC"],
                "拉萨": ["LXA"],
                "呼和浩特": ["HET"],
                "太原": ["TYN"],
                "石家庄": ["SJW"],
                "合肥": ["HFE"],
                "南昌": ["KHN"],
                "济南": ["TNA"],
                "长春": ["CGQ"],
                "温州": ["WNZ"],
                "宁波": ["NGB"],
                "无锡": ["WUX"],
                "烟台": ["YNT"],
                "东京": ["NRT", "HND"],
                "大阪": ["KIX", "ITM"],
                "首尔": ["ICN", "GMP"],
                "曼谷": ["BKK", "DMK"],
                "新加坡": ["SIN"],
                "吉隆坡": ["KUL"],
                "河内": ["HAN"],
                "胡志明": ["SGN"],
                "雅加达": ["CGK"],
                "马尼拉": ["MNL"],
                "台北": ["TPE", "TSA"],
                "香港": ["HKG"],
                "澳门": ["MFM"],
                "悉尼": ["SYD"],
                "墨尔本": ["MEL"],
                "伦敦": ["LHR", "LGW", "STN"],
                "巴黎": ["CDG", "ORY"],
                "纽约": ["JFK", "EWR", "LGA"],
                "洛杉矶": ["LAX"],
                "旧金山": ["SFO"],
                "芝加哥": ["ORD", "MDW"],
                "多伦多": ["YYZ"],
                "温哥华": ["YVR"],
                "迪拜": ["DXB"],
                "莫斯科": ["SVO", "DME"],
                "法兰克福": ["FRA"],
                "阿姆斯特丹": ["AMS"],
                "罗马": ["FCO"],
                "马德里": ["MAD"],
                "苏黎世": ["ZRH"],
                "伊斯坦布尔": ["IST"],
                "多哈": ["DOH"],
            },
            ensure_ascii=False,
        ),
    }

    with Session(engine) as session:
        for key, value in defaults.items():
            existing = session.exec(
                select(SystemConfig).where(SystemConfig.key == key)
            ).first()
            if existing is None:
                session.add(SystemConfig(key=key, value=value))
                logger.info(f"  🌱 已写入默认配置 {key}")
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import models.database
    from sqlmodel import SQLModel
    
    logger.info(f"🚀 初始化 SkyHunter API v{APP_VERSION}...")
    try:
        SQLModel.metadata.create_all(engine)
        _run_migrations()
        _seed_default_configs()
        logger.info("✅ 数据库表结构初始化成功")
    except Exception as e:
        logger.error(f"❌ 数据库初始化失败: {e}")

    start_scheduler()
    logger.info("✅ 调度器启动完成")
    
    yield
    
    logger.info("⏳ 正在关闭服务...")
    stop_scheduler()
    logger.info("✅ 调度器已关闭")


_is_dev = USE_MOCK_DATA or os.getenv("DB_MODE", "").strip().lower() == "local"

app = FastAPI(
    title="SkyHunter Pro API",
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs" if _is_dev else None,
    redoc_url="/api/redoc" if _is_dev else None,
    openapi_url="/api/openapi.json" if _is_dev else None,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not _is_dev:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
            response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-TOTP-Code", "X-Requested-With"],
    expose_headers=["X-Requires-Verification", "X-Requires-TOTP"],
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
    return {"status": "ok", "version": APP_VERSION}


BOOKING_DOMAIN_ALLOWLIST = {
    "google.com", "www.google.com", "google.co.jp", "google.co.uk",
    "flights.google.com",
    "skyscanner.com", "www.skyscanner.com", "skyscanner.net", "www.skyscanner.net",
    "trip.com", "www.trip.com",
    "booking.com", "www.booking.com",
    "expedia.com", "www.expedia.com",
    "kayak.com", "www.kayak.com",
    "airasia.com", "www.airasia.com",
    "ctrip.com", "www.ctrip.com",
    "ly.com", "www.ly.com",
    "qunar.com", "www.qunar.com",
}


def _is_safe_redirect(url: str) -> bool:
    """校验重定向目标域名是否在白名单内"""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = (parsed.hostname or "").lower()
        if host in BOOKING_DOMAIN_ALLOWLIST:
            return True
        for allowed in BOOKING_DOMAIN_ALLOWLIST:
            if host.endswith("." + allowed):
                return True
        return False
    except Exception:
        return False


@app.get("/api/v1/track/{monitor_id}", summary="预订链接点击追踪", tags=["track"])
async def track_booking_click(monitor_id: int):
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.booking_link:
            link = task.booking_link
            if not _is_safe_redirect(link):
                logger.warning(f"Blocked redirect to untrusted domain: {link} (monitor_id={monitor_id})")
                raise HTTPException(status_code=400, detail="Redirect target not allowed")
            task.click_count += 1
            task.last_clicked_at = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            session.add(task)
            session.commit()
            return RedirectResponse(url=link)
        raise HTTPException(status_code=400, detail="No booking link available")

# Import routers
from routers import users, flights, admin, admin_analytics, oauth, legal, payments
app.include_router(users.router)
app.include_router(flights.router)
app.include_router(admin.router)
app.include_router(admin_analytics.router)
app.include_router(oauth.router)
app.include_router(legal.router)
app.include_router(payments.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

