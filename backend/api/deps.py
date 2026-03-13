from fastapi import Depends, HTTPException, status
from jose import jwt, JWTError
from sqlmodel import Session, select
from config import JWT_SECRET_KEY, JWT_ALGORITHM
from db import engine
from models.database import User
from core.security import oauth2_scheme

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
        if not user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified",
            )
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


