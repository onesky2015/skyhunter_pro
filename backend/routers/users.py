from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from starlette.requests import Request as StarletteRequest
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import Optional
from db import engine
from models.database import User, PasswordReset, EmailVerification, TransactionHistory, MonitorTask, utc_iso_now
from schemas.api_models import *
from api.deps import get_current_user
from core.security import verify_password, hash_password, create_access_token, generate_reset_token
from services.email import send_reset_code_email, send_verification_code_email
from services.billing import _record_transaction, _refund_user_credits
from core.rate_limit import (
    _get_rate_limit_key, 
    _is_rate_limited, 
    _record_rate_limit_attempt, 
    _clear_rate_limit_attempts
)
from config import (
    logger, 
    FORGOT_PASSWORD_WINDOW_SECONDS, 
    FORGOT_PASSWORD_MAX_REQUESTS, 
    RESET_PASSWORD_WINDOW_SECONDS, 
    RESET_PASSWORD_MAX_ATTEMPTS, 
    LOGIN_WINDOW_SECONDS, 
    LOGIN_MAX_ATTEMPTS,
    EMAIL_VERIFY_WINDOW_SECONDS,
    EMAIL_VERIFY_MAX_ATTEMPTS,
    EMAIL_VERIFY_RESEND_WINDOW_SECONDS,
    EMAIL_VERIFY_RESEND_MAX,
    _login_attempts,
    _forgot_password_attempts,
    _reset_password_attempts,
    _email_verify_attempts,
    _email_verify_resend_attempts,
)
from datetime import datetime, timedelta

router = APIRouter()
# ============================================================================
# API 端点：用户认证
# ============================================================================


@router.post("/api/v1/auth/signup", response_model=SignupResponse, status_code=201, summary="用户注册", tags=["auth"])
async def signup(request: SignupRequest, http_request: StarletteRequest, background_tasks: BackgroundTasks):
    """
    注册新用户。

    成功后发送邮箱验证码，用户需完成验证后才能登录使用。
    """
    email = request.email.strip().lower()

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    # 获取客户端 IP 用于地理定位
    from core.middleware import _get_client_ip
    from services.geolocation import get_geo_from_ip
    client_ip = _get_client_ip(http_request)
    geo = get_geo_from_ip(client_ip)

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        if request.phone and request.phone.strip():
            phone_existing = session.exec(select(User).where(User.phone == request.phone.strip())).first()
            if phone_existing:
                raise HTTPException(status_code=409, detail="Phone number already registered")

        user = User(
            email=email,
            hashed_password=hash_password(request.password),
            full_name=request.full_name,
            phone=request.phone.strip() if request.phone else None,
            role="user",
            email_verified=False,
            created_at=utc_iso_now(),
            signup_ip=client_ip,
            country=geo.get("country"),
            region=geo.get("region"),
            city=geo.get("city"),
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
            description="Signup bonus credits",
            reference_type="signup",
            reference_id=str(user.id),
        )

        logger.info(f"🆕 新用户注册: {email} (ID: {user.id})，等待邮箱验证")

        code = generate_reset_token()
        expires_at = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
        verification = EmailVerification(
            email=email,
            token=code,
            expires_at=expires_at,
            used=False,
        )
        session.add(verification)
        session.commit()

    background_tasks.add_task(send_verification_code_email, to_email=email, code=code)

    return SignupResponse(
        message="Registration successful. Please check your email for verification code.",
        requires_verification=True,
        email=email,
    )


@router.post("/api/v1/auth/verify-email", response_model=TokenResponse, summary="邮箱验证", tags=["auth"])
async def verify_email(request: VerifyEmailRequest, http_request: StarletteRequest):
    """
    验证用户邮箱。

    使用注册时发送的 6 位验证码完成邮箱验证，成功后返回 JWT Token。
    """
    email = request.email.strip().lower()
    code = request.code.strip()
    rate_limit_key = _get_rate_limit_key(email, http_request)

    limited, retry_after = _is_rate_limited(
        _email_verify_attempts,
        rate_limit_key,
        EMAIL_VERIFY_MAX_ATTEMPTS,
        EMAIL_VERIFY_WINDOW_SECONDS,
    )
    if limited:
        raise HTTPException(
            status_code=429,
            detail=f"Too many verification attempts. Please try again in {retry_after} seconds.",
        )

    with Session(engine) as session:
        record = session.exec(
            select(EmailVerification).where(
                EmailVerification.email == email,
                EmailVerification.token == code,
                EmailVerification.used == False,
            )
        ).first()

        if not record:
            _record_rate_limit_attempt(_email_verify_attempts, rate_limit_key)
            raise HTTPException(status_code=400, detail="Invalid or expired verification code")

        try:
            expires_at = datetime.fromisoformat(record.expires_at)
            if datetime.utcnow() > expires_at:
                record.used = True
                session.add(record)
                session.commit()
                _record_rate_limit_attempt(_email_verify_attempts, rate_limit_key)
                raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
        except ValueError:
            _record_rate_limit_attempt(_email_verify_attempts, rate_limit_key)
            raise HTTPException(status_code=400, detail="Invalid verification record")

        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        user.email_verified = True
        user.email_verified_at = utc_iso_now()
        session.add(user)

        record.used = True
        session.add(record)

        session.commit()
        session.refresh(user)
        _clear_rate_limit_attempts(_email_verify_attempts, rate_limit_key)
        logger.info(f"✅ 邮箱验证成功: {email} (ID: {user.id})")

        access_token = create_access_token(data={"sub": user.email, "user_id": user.id, "role": user.role})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            credits=user.credits,
        )


@router.post("/api/v1/auth/resend-verification", summary="重发邮箱验证码", tags=["auth"])
async def resend_verification(request: ResendVerificationRequest, http_request: StarletteRequest, background_tasks: BackgroundTasks):
    """
    重新发送邮箱验证码。

    即使邮箱不存在也返回成功消息（防止邮箱枚举攻击）。
    """
    email = request.email.strip().lower()
    rate_limit_key = _get_rate_limit_key(email, http_request)

    success_msg = {"message": "If the email is registered, a new verification code has been sent."}

    limited, retry_after = _is_rate_limited(
        _email_verify_resend_attempts,
        rate_limit_key,
        EMAIL_VERIFY_RESEND_MAX,
        EMAIL_VERIFY_RESEND_WINDOW_SECONDS,
    )
    if limited:
        logger.warning(f"📧 重发验证码已限流: {email} (retry_after={retry_after}s)")
        return success_msg
    _record_rate_limit_attempt(_email_verify_resend_attempts, rate_limit_key)

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            logger.info(f"📧 重发验证码: {email} (用户不存在，静默返回)")
            return success_msg

        if user.email_verified:
            return {"message": "Email is already verified."}

        old_tokens = session.exec(
            select(EmailVerification).where(
                EmailVerification.email == email,
                EmailVerification.used == False,
            )
        ).all()
        for old in old_tokens:
            old.used = True
            session.add(old)

        code = generate_reset_token()
        expires_at = (datetime.utcnow() + timedelta(minutes=15)).isoformat()

        verification = EmailVerification(
            email=email,
            token=code,
            expires_at=expires_at,
            used=False,
        )
        session.add(verification)
        session.commit()

        logger.info(f"📧 邮箱验证码已重新生成: {email} (expires_in=15m)")

    background_tasks.add_task(send_verification_code_email, to_email=email, code=code)

    return success_msg


@router.post("/api/v1/auth/token", response_model=TokenResponse, summary="用户登录", tags=["auth"])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    http_request: StarletteRequest = None,
):
    """
    用户登录，返回 JWT Token。

    使用 OAuth2 标准表单格式 (username=email, password=password)。
    管理员启用 TOTP 后，需在请求头中附带 X-TOTP-Code 进行二次验证。
    """
    email = form_data.username.strip().lower()
    rate_limit_key = _get_rate_limit_key(email, http_request)

    login_limited, retry_after = _is_rate_limited(
        _login_attempts,
        rate_limit_key,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_WINDOW_SECONDS,
    )
    if login_limited:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
        )

    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            _record_rate_limit_attempt(_login_attempts, rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not verify_password(form_data.password, user.hashed_password):
            _record_rate_limit_attempt(_login_attempts, rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        _clear_rate_limit_attempts(_login_attempts, rate_limit_key)

        if not user.email_verified:
            logger.info(f"🔐 用户登录但邮箱未验证: {email} (ID: {user.id})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email not verified",
                headers={"X-Requires-Verification": "true"},
            )

        if user.totp_enabled and user.totp_secret:
            totp_code = http_request.headers.get("x-totp-code", "").strip() if http_request else ""
            if not totp_code:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="TOTP code required",
                    headers={"X-Requires-TOTP": "true"},
                )
            import pyotp
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(totp_code, valid_window=1):
                _record_rate_limit_attempt(_login_attempts, rate_limit_key)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid TOTP code",
                    headers={"X-Requires-TOTP": "true"},
                )

        from core.middleware import _get_client_ip
        login_ip = _get_client_ip(http_request) if http_request else None
        user.last_login_at = utc_iso_now()
        user.last_login_ip = login_ip
        session.add(user)
        session.commit()

        logger.info(f"🔐 用户登录: {email} (ID: {user.id})")

        access_token = create_access_token(data={"sub": user.email, "user_id": user.id, "role": user.role})
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            credits=user.credits,
        )


@router.get("/api/v1/users/me", response_model=UserResponse, summary="获取当前用户信息", tags=["auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前已认证用户的信息"""
    # 重新查询以获取最新 credits
    with Session(engine) as session:
        fresh_user = session.get(User, current_user.id)
        if not fresh_user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(
            id=fresh_user.id,
            email=fresh_user.email,
            phone=fresh_user.phone,
            full_name=fresh_user.full_name,
            role=fresh_user.role,
            credits=fresh_user.credits,
            created_at=fresh_user.created_at,
        )


@router.get(
    "/api/v1/users/transactions",
    response_model=List[TransactionHistoryResponse],
    summary="获取当前用户积分流水",
    tags=["auth"],
)
async def get_my_transactions(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    """按时间倒序返回当前用户的积分流水。"""
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    with Session(engine) as session:
        records = session.exec(
            select(TransactionHistory)
            .where(TransactionHistory.user_id == current_user.id)
            .order_by(TransactionHistory.id.desc())
            .offset(safe_offset)
            .limit(safe_limit)
        ).all()
        return [TransactionHistoryResponse(**record.model_dump()) for record in records]


class ForgotPasswordRequest(BaseModel):
    """忘记密码请求"""
    email: str = Field(..., description="注册邮箱地址")



@router.post("/api/v1/auth/forgot-password", summary="请求密码重置验证码", tags=["auth"])
async def forgot_password(request: ForgotPasswordRequest, http_request: StarletteRequest, background_tasks: BackgroundTasks):
    """
    发送密码重置验证码到用户邮箱。

    即使邮箱不存在也返回成功（防止邮箱枚举攻击）。
    验证码有效期 15 分钟。
    使用 BackgroundTasks 以免阻塞请求导致前端无响应。
    """
    email = request.email.strip().lower()
    rate_limit_key = _get_rate_limit_key(email, http_request)

    # 统一返回消息（防止邮箱枚举）
    success_msg = {"message": "If the email is registered, a reset code has been sent."}

    forgot_limited, retry_after = _is_rate_limited(
        _forgot_password_attempts,
        rate_limit_key,
        FORGOT_PASSWORD_MAX_REQUESTS,
        FORGOT_PASSWORD_WINDOW_SECONDS,
    )
    if forgot_limited:
        logger.warning(f"🔐 忘记密码请求已限流: {email} (retry_after={retry_after}s)")
        return success_msg
    _record_rate_limit_attempt(_forgot_password_attempts, rate_limit_key)

    with Session(engine) as session:
        # 检查用户是否存在
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            logger.info(f"🔐 忘记密码请求: {email} (用户不存在，静默返回)")
            return success_msg

        # 使该邮箱之前未使用的验证码全部失效
        old_tokens = session.exec(
            select(PasswordReset).where(
                PasswordReset.email == email,
                PasswordReset.used == False,
            )
        ).all()
        for old in old_tokens:
            old.used = True
            session.add(old)

        # 生成新验证码
        code = generate_reset_token()
        expires_at = (datetime.utcnow() + timedelta(minutes=15)).isoformat()

        reset_record = PasswordReset(
            email=email,
            token=code,
            expires_at=expires_at,
            used=False,
        )
        session.add(reset_record)
        session.commit()

        logger.info(f"🔐 密码重置码已生成: {email} (expires_in=15m)")

    # 发送邮件（非阻塞式）
    background_tasks.add_task(send_reset_code_email, to_email=email, code=code)

    return success_msg


@router.post("/api/v1/auth/reset-password", summary="验证码重置密码", tags=["auth"])
async def reset_password(request: ResetPasswordRequest, http_request: StarletteRequest):
    """
    使用验证码重置密码。

    验证: token 存在、匹配邮箱、未过期、未使用。
    成功后更新密码并标记 token 为已使用。
    """
    email = request.email.strip().lower()
    token = request.token.strip()
    rate_limit_key = _get_rate_limit_key(email, http_request)

    reset_limited, retry_after = _is_rate_limited(
        _reset_password_attempts,
        rate_limit_key,
        RESET_PASSWORD_MAX_ATTEMPTS,
        RESET_PASSWORD_WINDOW_SECONDS,
    )
    if reset_limited:
        raise HTTPException(
            status_code=429,
            detail=f"Too many reset attempts. Please try again in {retry_after} seconds.",
        )

    with Session(engine) as session:
        # 查找匹配的验证码记录
        reset_record = session.exec(
            select(PasswordReset).where(
                PasswordReset.email == email,
                PasswordReset.token == token,
                PasswordReset.used == False,
            )
        ).first()

        if not reset_record:
            _record_rate_limit_attempt(_reset_password_attempts, rate_limit_key)
            raise HTTPException(status_code=400, detail="Invalid or expired reset code")

        # 检查是否过期
        try:
            expires_at = datetime.fromisoformat(reset_record.expires_at)
            if datetime.utcnow() > expires_at:
                reset_record.used = True
                session.add(reset_record)
                session.commit()
                _record_rate_limit_attempt(_reset_password_attempts, rate_limit_key)
                raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")
        except ValueError:
            _record_rate_limit_attempt(_reset_password_attempts, rate_limit_key)
            raise HTTPException(status_code=400, detail="Invalid reset record")

        # 查找用户
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        # 更新密码
        user.hashed_password = hash_password(request.new_password)
        session.add(user)

        # 标记 token 为已使用
        reset_record.used = True
        session.add(reset_record)

        session.commit()
        _clear_rate_limit_attempts(_reset_password_attempts, rate_limit_key)
        logger.info(f"🔐 密码已重置: {email}")

    return {"message": "Password has been reset successfully. Please login with your new password."}



@router.post("/api/v1/auth/change-password", summary="修改密码", tags=["auth"])
async def change_password(request: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    """
    已登录用户修改密码。需提供当前密码验证。
    """
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if request.old_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.hashed_password = hash_password(request.new_password)
        session.add(user)
        session.commit()
        logger.info(f"🔐 用户 #{current_user.id} 已修改密码")
    return {"message": "Password has been updated successfully."}


@router.post("/api/v1/auth/delete-account", summary="删除账号", tags=["auth"])
async def delete_account(request: DeleteAccountRequest, current_user: User = Depends(get_current_user)):
    """
    永久删除用户账号及所有关联数据。

    Apple App Store 合规要求：用户必须能够删除自己的账号。
    需要输入当前密码进行二次确认。
    """
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    with Session(engine) as session:
        monitors = session.exec(
            select(MonitorTask).where(MonitorTask.user_id == current_user.id)
        ).all()
        for m in monitors:
            session.delete(m)

        transactions = session.exec(
            select(TransactionHistory).where(TransactionHistory.user_id == current_user.id)
        ).all()
        for t in transactions:
            session.delete(t)

        resets = session.exec(
            select(PasswordReset).where(PasswordReset.email == current_user.email)
        ).all()
        for r in resets:
            session.delete(r)

        verifications = session.exec(
            select(EmailVerification).where(EmailVerification.email == current_user.email)
        ).all()
        for v in verifications:
            session.delete(v)

        user = session.get(User, current_user.id)
        if user:
            session.delete(user)

        session.commit()
        logger.info(f"🗑️ 用户账号已永久删除: {current_user.email} (ID: {current_user.id})")

    return {"message": "Your account and all associated data have been permanently deleted."}


class TopupRequest(BaseModel):
    """充值请求"""
    amount: int = Field(default=50, ge=1, le=9999, description="充值积分数量")


class TopupResponse(BaseModel):
    """充值响应"""
    message: str
    credits_added: int
    credits_total: int


def _record_transaction(
    user_id: int,
    transaction_type: str,
    amount: int,
    credits_before: int,
    credits_after: int,
    description: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    operator_user_id: Optional[int] = None,
) -> None:
    """
    记录积分流水。

    这里使用独立事务，确保即使主业务已提交，也能尽量保留审计痕迹。
    """
    try:
        with Session(engine) as session:
            record = TransactionHistory(
                user_id=user_id,
                transaction_type=transaction_type,
                amount=amount,
                credits_before=credits_before,
                credits_after=credits_after,
                description=description,
                reference_type=reference_type,
                reference_id=reference_id,
                operator_user_id=operator_user_id,
            )
            session.add(record)
            session.commit()
    except Exception as tx_err:
        logger.error(
            f"❌ Transaction history write failed for user #{user_id}: "
            f"{tx_err} ({transaction_type}, amount={amount})"
        )


def _refund_user_credits(user_id: int, amount: int, reason: str) -> None:
    """
    最小补偿机制：在扣费后的关键失败场景下返还积分。
    """
    if amount <= 0:
        return
    try:
        with Session(engine) as session:
            user = session.get(User, user_id)
            if not user:
                logger.error(f"❌ Refund failed: user #{user_id} not found ({reason})")
                return
            credits_before = user.credits
            user.credits += amount
            session.add(user)
            session.commit()
            session.refresh(user)
            _record_transaction(
                user_id=user_id,
                transaction_type="refund",
                amount=amount,
                credits_before=credits_before,
                credits_after=user.credits,
                description=f"Refund for {reason}",
                reference_type="refund_reason",
                reference_id=reason,
            )
            logger.info(f"↩️ User #{user_id} 退款 {amount} 积分，原因: {reason}，余额: {user.credits}")
    except Exception as refund_err:
        logger.error(f"❌ Refund failed for user #{user_id}: {refund_err} ({reason})")


@router.post("/api/v1/users/topup", response_model=TopupResponse, summary="充值积分（Mock）", tags=["auth"])
async def topup_credits(request: TopupRequest = TopupRequest(), current_user: User = Depends(get_current_user)):
    """
    Mock 充值积分端点。

    生产环境中应接入支付网关（Stripe / 支付宝等），此处直接增加积分。
    """
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        credits_before = user.credits
        user.credits += request.amount
        session.add(user)
        session.commit()
        session.refresh(user)
        _record_transaction(
            user_id=user.id,
            transaction_type="recharge",
            amount=request.amount,
            credits_before=credits_before,
            credits_after=user.credits,
            description="Mock credits topup",
            reference_type="topup",
            reference_id=str(request.amount),
        )
        logger.info(f"💰 User #{user.id} 充值 {request.amount} 积分，余额: {user.credits}")
        return TopupResponse(
            message=f"Successfully added {request.amount} credits",
            credits_added=request.amount,
            credits_total=user.credits,
        )


