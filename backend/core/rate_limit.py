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
    import time
    now_ts = time.time()
    _prune_rate_limit_store(store, now_ts, window_seconds)
    attempts = store.get(key, [])
    if len(attempts) < max_attempts:
        return False, 0
    retry_after = max(1, int(window_seconds - (now_ts - attempts[0])))
    return True, retry_after

def _record_rate_limit_attempt(store: dict, key: str) -> None:
    import time
    now_ts = time.time()
    attempts = store.get(key, [])
    attempts.append(now_ts)
    store[key] = attempts

def _clear_rate_limit_attempts(store: dict, key: str) -> None:
    store.pop(key, None)
