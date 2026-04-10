from fastapi.security import OAuth2PasswordBearer
from datetime import timedelta, datetime
from typing import Optional
from sqlmodel import Session
from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_REFRESH_EXPIRE_DAYS
from db import engine

import uuid
import secrets
from passlib.context import CryptContext
from jose import jwt

# ============================================================================
# 安全工具
# ============================================================================

def generate_reset_token() -> str:
    """生成密码学安全的 6 位数字验证码"""
    return str(secrets.randbelow(900000) + 100000)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def hash_password(password: str) -> str:
    """使用 bcrypt 哈希密码 (自动截断至72字节以符合 bcrypt 限制)"""
    # 修复 ValueError: password cannot be longer than 72 bytes
    return pwd_context.hash(password.encode("utf-8")[:72])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 修复验证时的 72 字节限制
    return pwd_context.verify(plain_password.encode("utf-8")[:72], hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建 JWT Access Token (短期，默认 1 小时)
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token_value() -> str:
    """生成唯一的 refresh token 字符串"""
    return str(uuid.uuid4())


def issue_token_pair(
    user,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:
    """
    为用户签发 access_token + refresh_token 对。
    refresh_token 会持久化到数据库。

    Returns:
        {"access_token": ..., "refresh_token": ..., "expires_in": seconds}
    """
    from models.database import RefreshToken, utc_iso_now

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )

    refresh_value = create_refresh_token_value()
    expires_at = (datetime.utcnow() + timedelta(days=JWT_REFRESH_EXPIRE_DAYS)).isoformat() + "Z"

    with Session(engine) as session:
        rt = RefreshToken(
            user_id=user.id,
            token=refresh_value,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(rt)
        session.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_value,
        "expires_in": JWT_EXPIRE_HOURS * 3600,
    }



# ============================================================================
# 认证依赖统一入口：请使用 api.deps.get_current_user / get_current_admin
# 此模块不再提供认证依赖，避免多处实现导致校验遗漏
# ============================================================================


