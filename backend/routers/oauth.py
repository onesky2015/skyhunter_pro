# filename: routers/oauth.py
import os
import time
import secrets
from fastapi import APIRouter, HTTPException, status
from starlette.requests import Request as StarletteRequest
from sqlmodel import Session, select
from jose import jwt as jose_jwt, JWTError
import requests as http_requests

from db import engine
from models.database import User, utc_iso_now
from schemas.api_models import OAuthAppleRequest, OAuthGoogleRequest, TokenResponse
from core.security import issue_token_pair, hash_password
from services.billing import _record_transaction
from config import logger, mask_email

router = APIRouter()

APPLE_BUNDLE_ID = os.getenv("APPLE_BUNDLE_ID", "app.skyhunter.flight")

_apple_keys_cache: dict | None = None
_apple_keys_fetched_at: float = 0.0
_APPLE_JWKS_TTL_SECONDS = 86400  # 24h


def _get_apple_public_keys() -> dict:
    """获取 Apple 的 JWKS 公钥集（带 TTL 缓存）"""
    global _apple_keys_cache, _apple_keys_fetched_at
    now = time.time()
    if _apple_keys_cache and (now - _apple_keys_fetched_at) < _APPLE_JWKS_TTL_SECONDS:
        return _apple_keys_cache
    resp = http_requests.get("https://appleid.apple.com/auth/keys", timeout=10)
    resp.raise_for_status()
    _apple_keys_cache = resp.json()
    _apple_keys_fetched_at = now
    return _apple_keys_cache


def _verify_apple_id_token(id_token: str) -> dict:
    """
    验证 Apple ID Token：签名 (RS256)、issuer、audience (Bundle ID)。
    """
    try:
        header = jose_jwt.get_unverified_header(id_token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid Apple ID token format")

    jwks = _get_apple_public_keys()
    key = None
    for k in jwks.get("keys", []):
        if k["kid"] == header.get("kid"):
            key = k
            break

    if not key:
        global _apple_keys_cache, _apple_keys_fetched_at
        _apple_keys_cache = None
        _apple_keys_fetched_at = 0.0
        jwks = _get_apple_public_keys()
        for k in jwks.get("keys", []):
            if k["kid"] == header.get("kid"):
                key = k
                break

    if not key:
        raise HTTPException(status_code=400, detail="Apple public key not found")

    try:
        from jose import jwk
        public_key = jwk.construct(key, algorithm="RS256")
        claims = jose_jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=APPLE_BUNDLE_ID,
            issuer="https://appleid.apple.com",
            options={"verify_aud": True},
        )
        return claims
    except JWTError:
        raise HTTPException(status_code=400, detail="Apple token verification failed")


GOOGLE_CLIENT_IDS = [
    os.getenv("GOOGLE_WEB_CLIENT_ID", "511232230562-brr7d7tg5ceqmtcjq0h1aldnijso1l8p.apps.googleusercontent.com"),
    os.getenv("GOOGLE_IOS_CLIENT_ID", "511232230562-v3omoau22ch04bpesqjs60atkqri39mt.apps.googleusercontent.com"),
    os.getenv("GOOGLE_ANDROID_CLIENT_ID", "511232230562-t7rt7ijcvir09cgs0uthgqlhh207tai3.apps.googleusercontent.com"),
]


def _verify_google_id_token(id_token: str) -> dict:
    """
    验证 Google ID Token：本地签名验证 + audience 校验。
    优先使用 google-auth 库，降级到 tokeninfo 端点。
    """
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        claims = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            clock_skew_in_seconds=10,
        )
        if claims.get("aud") not in GOOGLE_CLIENT_IDS:
            raise HTTPException(status_code=400, detail="Google token audience mismatch")
        if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(status_code=400, detail="Google token issuer mismatch")
    except ImportError:
        logger.warning("google-auth library not installed, falling back to tokeninfo endpoint")
        resp = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google ID token")
        claims = resp.json()
        if "error" in claims:
            logger.warning(f"Google token validation error: {claims.get('error')}")
            raise HTTPException(status_code=400, detail="Google token verification failed")
        if claims.get("aud") not in GOOGLE_CLIENT_IDS:
            raise HTTPException(status_code=400, detail="Google token audience mismatch")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Google token verification failed")

    if "sub" not in claims or "email" not in claims:
        raise HTTPException(status_code=400, detail="Incomplete Google token claims")

    return claims


def _oauth_login_or_create(
    email: str,
    provider: str,
    provider_sub: str,
    full_name: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> TokenResponse:
    """OAuth 登录或自动注册用户，签发 token 对"""
    with Session(engine) as session:
        sub_field = User.apple_sub if provider == "apple" else User.google_sub
        user = session.exec(select(User).where(sub_field == provider_sub)).first()

        if not user:
            user = session.exec(select(User).where(User.email == email)).first()

        if user:
            if provider == "apple" and not user.apple_sub:
                user.apple_sub = provider_sub
            elif provider == "google" and not user.google_sub:
                user.google_sub = provider_sub
            user.last_login_at = utc_iso_now()
            user.last_login_ip = ip_address
            if not user.email_verified:
                user.email_verified = True
                user.email_verified_at = utc_iso_now()
            session.add(user)
            session.commit()
            session.refresh(user)
        else:
            random_pw = secrets.token_urlsafe(32)
            user = User(
                email=email,
                hashed_password=hash_password(random_pw),
                full_name=full_name,
                role="user",
                email_verified=True,
                email_verified_at=utc_iso_now(),
                created_at=utc_iso_now(),
                auth_provider=provider,
                apple_sub=provider_sub if provider == "apple" else None,
                google_sub=provider_sub if provider == "google" else None,
                signup_ip=ip_address,
                last_login_at=utc_iso_now(),
                last_login_ip=ip_address,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            _record_transaction(
                user_id=user.id,
                transaction_type="system_adjustment",
                amount=user.credits,
                credits_before=0,
                credits_after=user.credits,
                description=f"Signup bonus ({provider} OAuth)",
                reference_type="signup",
                reference_id=str(user.id),
            )
            logger.info(f"🆕 OAuth 新用户: {mask_email(email)} via {provider} (ID: {user.id})")

    tokens = issue_token_pair(user, ip_address=ip_address, user_agent=user_agent)
    logger.info(f"🔐 OAuth 登录: {mask_email(email)} via {provider} (ID: {user.id})")

    return TokenResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type="bearer",
        expires_in=tokens["expires_in"],
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        credits=user.credits,
    )


@router.post(
    "/api/v1/auth/oauth/apple",
    response_model=TokenResponse,
    summary="Apple Sign-In",
    tags=["auth"],
)
async def oauth_apple(request: OAuthAppleRequest, http_request: StarletteRequest):
    """
    Apple Sign-In：验证 Apple ID Token，自动登录或注册。
    App Store 审核强制要求支持。
    """
    from core.middleware import _get_client_ip

    claims = _verify_apple_id_token(request.id_token)
    apple_sub = claims.get("sub")
    email = claims.get("email")
    if not apple_sub or not email:
        raise HTTPException(status_code=400, detail="Apple token missing sub or email")

    return _oauth_login_or_create(
        email=email,
        provider="apple",
        provider_sub=apple_sub,
        full_name=request.full_name,
        ip_address=_get_client_ip(http_request),
        user_agent=http_request.headers.get("user-agent", ""),
    )


@router.post(
    "/api/v1/auth/oauth/google",
    response_model=TokenResponse,
    summary="Google Sign-In",
    tags=["auth"],
)
async def oauth_google(request: OAuthGoogleRequest, http_request: StarletteRequest):
    """
    Google Sign-In：验证 Google ID Token，自动登录或注册。
    """
    from core.middleware import _get_client_ip

    claims = _verify_google_id_token(request.id_token)
    google_sub = claims.get("sub")
    email = claims.get("email")
    if not google_sub or not email:
        raise HTTPException(status_code=400, detail="Google token missing sub or email")

    full_name = claims.get("name")

    return _oauth_login_or_create(
        email=email,
        provider="google",
        provider_sub=google_sub,
        full_name=full_name,
        ip_address=_get_client_ip(http_request),
        user_agent=http_request.headers.get("user-agent", ""),
    )
