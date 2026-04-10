import os
import logging
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

APP_VERSION: str = "3.3.0 (Pro-Phase2)"
APP_DESCRIPTION: str = "航班价格监控 SaaS 后端 v3.3.0 (Pro-Phase2) - 用户认证 + 数据隔离 + 持久化监控"

_mock_env = os.getenv("USE_MOCK_DATA", "").strip().lower()
if _mock_env not in ("true", "false", "1", "0"):
    raise RuntimeError(
        "USE_MOCK_DATA 环境变量未配置或无效。"
    )
USE_MOCK_DATA: bool = _mock_env in ("true", "1")

# 为 false 时跳过写入 predictive_search_records（合规关闭训练集采集）
_PRED_LOG = os.getenv("PREDICTIVE_SEARCH_LOG_ENABLED", "true").strip().lower()
PREDICTIVE_SEARCH_LOG_ENABLED: bool = _PRED_LOG in ("true", "1", "yes")

SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "")
CACHE_HOURS: int = int(os.getenv("CACHE_HOURS", "4"))
SCHEDULER_INTERVAL_HOURS: int = int(os.getenv("SCHEDULER_INTERVAL_HOURS", "4"))
EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "smtp").lower()
BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
EMAIL_SENDER: str = os.getenv("EMAIL_SENDER", "noreply@skyhunter.app")
EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.qq.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "")
API_BASE_URL: str = os.getenv("API_BASE_URL", "").rstrip("/")

JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY 环境变量未配置。")
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_HOURS: int = int(os.getenv("JWT_EXPIRE_HOURS", "1"))
JWT_REFRESH_EXPIRE_DAYS: int = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "30"))

CORS_ALLOWED_ORIGINS_ENV: str = os.getenv("CORS_ALLOWED_ORIGINS", "")

SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

try:
    from loguru import logger as _loguru_logger
    import sys

    _loguru_logger.remove()
    _loguru_logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <7}</level> | <cyan>{name}</cyan> | <level>{message}</level>",
        level="INFO",
        colorize=True,
    )
    _loguru_logger.add(
        "logs/skyhunter_{time:YYYY-MM-DD}.log",
        rotation="00:00",
        retention="30 days",
        compression="gz",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <7} | {name} | {message}",
    )
    logger = _loguru_logger
except ImportError:
    logger = logging.getLogger("SkyHunter")

def mask_email(email: str) -> str:
    """脱敏邮箱地址：u***@gmail.com"""
    if not email or "@" not in email:
        return "***"
    local, domain = email.rsplit("@", 1)
    if len(local) <= 1:
        return f"*@{domain}"
    return f"{local[0]}***@{domain}"


FORGOT_PASSWORD_WINDOW_SECONDS: int = 15 * 60
FORGOT_PASSWORD_MAX_REQUESTS: int = 5
RESET_PASSWORD_WINDOW_SECONDS: int = 15 * 60
RESET_PASSWORD_MAX_ATTEMPTS: int = 5
LOGIN_WINDOW_SECONDS: int = 15 * 60
LOGIN_MAX_ATTEMPTS: int = 5

DATABASE_URL: str = os.getenv("DATABASE_URL", "")
DB_MODE: str = os.getenv("DB_MODE", "auto").strip().lower()

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./skyhunter_local.db"
    DB_MODE = "local"
    logger.warning("⚠️ DATABASE_URL 未配置，自动使用本地 SQLite: skyhunter_local.db")

if DB_MODE == "auto":
    if DATABASE_URL.startswith("sqlite"):
        DB_MODE = "local"
    else:
        DB_MODE = "remote"

if CORS_ALLOWED_ORIGINS_ENV:
    CORS_ALLOWED_ORIGINS: List[str] = [origin.strip() for origin in CORS_ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
else:
    if USE_MOCK_DATA or DB_MODE == "local":
        CORS_ALLOWED_ORIGINS: List[str] = ["*"]
    else:
        raise RuntimeError("生产环境必须设置 CORS_ALLOWED_ORIGINS")

_is_sqlite = DATABASE_URL.startswith("sqlite")
DATABASE_FILE = DATABASE_URL.replace("sqlite:///", "") if _is_sqlite else ""

EMAIL_VERIFY_WINDOW_SECONDS: int = 15 * 60
EMAIL_VERIFY_MAX_ATTEMPTS: int = 5
EMAIL_VERIFY_RESEND_WINDOW_SECONDS: int = 15 * 60
EMAIL_VERIFY_RESEND_MAX: int = 10

# NOTE: 内存限流存储 — 多 worker 不共享，重启后丢失。
# 生产环境水平扩展时应迁移到 Redis，单实例部署 (workers=1) 下可用。
_login_attempts: dict[str, list[float]] = {}
_forgot_password_attempts: dict[str, list[float]] = {}
_reset_password_attempts: dict[str, list[float]] = {}
_email_verify_attempts: dict[str, list[float]] = {}
_email_verify_resend_attempts: dict[str, list[float]] = {}
