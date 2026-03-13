import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlmodel import Session
from db import engine
from models.database import ApiUsageLog, utc_iso_now
from config import logger


def _extract_user_id_from_request(request: Request) -> int | None:
    """从 JWT token 中提取 user_id（不验证，仅解码）。"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        from jose import jwt
        from config import JWT_SECRET_KEY, JWT_ALGORITHM
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("user_id")
    except Exception:
        return None


def _get_client_ip(request: Request) -> str:
    """提取客户端真实 IP（支持反向代理）。"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


_SKIP_PREFIXES = ("/api/docs", "/api/redoc", "/api/openapi.json", "/favicon.ico")


class ApiUsageLogMiddleware(BaseHTTPMiddleware):
    """记录每次 API 请求到 api_usage_log 表。"""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES) or path == "/":
            return await call_next(request)

        start_time = time.monotonic()
        response = await call_next(request)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)

        try:
            user_id = _extract_user_id_from_request(request)
            ip = _get_client_ip(request)
            ua = request.headers.get("user-agent", "")[:200]

            log_entry = ApiUsageLog(
                user_id=user_id,
                endpoint=path,
                method=request.method,
                status_code=response.status_code,
                response_time_ms=elapsed_ms,
                ip_address=ip,
                user_agent=ua,
                created_at=utc_iso_now(),
            )
            with Session(engine) as session:
                session.add(log_entry)
                session.commit()
        except Exception as e:
            logger.warning(f"ApiUsageLog write error: {e}")

        return response
