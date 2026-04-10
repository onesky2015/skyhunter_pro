import time
from typing import Optional
from starlette.requests import Request as StarletteRequest

def _get_client_identifier(http_request: Optional[StarletteRequest]) -> str:
    if http_request and http_request.client and http_request.client.host:
        return http_request.client.host
    return "unknown"

def _get_rate_limit_key(email: str, http_request: Optional[StarletteRequest]) -> str:
    return f"{email}|{_get_client_identifier(http_request)}"

def _prune_rate_limit_store(store: dict, now_ts: float, window_seconds: int) -> None:
    stale_keys = []
    for key, attempts in store.items():
        recent_attempts = [ts for ts in attempts if now_ts - ts < window_seconds]
        if recent_attempts:
            store[key] = recent_attempts
        else:
            stale_keys.append(key)
    for key in stale_keys:
        store.pop(key, None)

def _is_rate_limited(store: dict, key: str, max_attempts: int, window_seconds: int) -> tuple[bool, int]:
    now_ts = time.time()
    _prune_rate_limit_store(store, now_ts, window_seconds)
    attempts = store.get(key, [])
    if len(attempts) < max_attempts:
        return False, 0
    retry_after = max(1, int(window_seconds - (now_ts - attempts[0])))
    return True, retry_after

def _record_rate_limit_attempt(store: dict, key: str) -> None:
    now_ts = time.time()
    attempts = store.get(key, [])
    attempts.append(now_ts)
    store[key] = attempts

def _clear_rate_limit_attempts(store: dict, key: str) -> None:
    store.pop(key, None)


# ============================================================================
# 通用 IP 限流器（用于公开端点防 DoS）
# ============================================================================

_ip_rate_stores: dict[str, dict[str, list[float]]] = {}

IP_RATE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/airports/search": (60, 60),      # 60 req / 60s per IP
    "/api/v1/flights/popular": (20, 60),       # 20 req / 60s per IP
    "/api/v1/payments/products": (30, 60),     # 30 req / 60s per IP
}


def check_ip_rate_limit(path: str, ip: str) -> Optional[int]:
    """
    检查 IP 限流。返回 None 表示通过，返回 int 表示需等待秒数。
    """
    config = IP_RATE_LIMITS.get(path)
    if not config:
        return None

    max_requests, window_seconds = config
    if path not in _ip_rate_stores:
        _ip_rate_stores[path] = {}
    store = _ip_rate_stores[path]

    limited, retry_after = _is_rate_limited(store, ip, max_requests, window_seconds)
    if limited:
        return retry_after
    _record_rate_limit_attempt(store, ip)
    return None
