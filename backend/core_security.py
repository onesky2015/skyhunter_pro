from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from typing import Optional
from sqlmodel import Session, select
from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_HOURS
from db import engine
from models.database import User
# ============================================================================
# 认证依赖（passlib + python-jose）
# ============================================================================

from passlib.context import CryptContext
from jose import JWTError, jwt

# ============================================================================
# 安全工具
# ============================================================================

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
    创建 JWT Access Token

    Args:
        data: 载荷数据，必须包含 "sub" (subject, 即 user email)
        expires_delta: 过期时间增量

    Returns:
        编码后的 JWT 字符串
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)



# ============================================================================
# 认证依赖：获取当前用户
# ============================================================================


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    FastAPI 依赖：从 JWT Token 解析当前用户

    如果 Token 无效或用户不存在，抛出 401 Unauthorized。

    Args:
        token: Bearer Token (由 OAuth2PasswordBearer 自动提取)

    Returns:
        User: 当前已认证的用户对象
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with Session(engine) as session:
        statement = select(User).where(User.email == email)
        user = session.exec(statement).first()
        if user is None:
            raise credentials_exception
        return user


# ============================================================================
# Admin 依赖：要求当前用户为 admin 角色
# ============================================================================


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    FastAPI 依赖：确保当前用户具有 admin 角色。

    如果用户不是 admin，抛出 403 Forbidden。

    Args:
        current_user: 已通过 JWT 认证的用户对象

    Returns:
        User: 当前已认证的 admin 用户对象
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


