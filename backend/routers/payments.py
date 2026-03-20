# filename: routers/payments.py
"""
支付集成路由：
- Apple IAP 服务端验证
- Google Play Billing 服务端验证
- Stripe Checkout (Web 端)
"""
import os
import hmac
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from db import engine
from models.database import User, TransactionHistory, utc_iso_now
from api.deps import get_current_user
from services.billing import _record_transaction
from config import logger

router = APIRouter()

# ========== 积分商品定义 ==========

CREDIT_PRODUCTS = {
    "credits_50": {"credits": 50, "price_usd": 0.99},
    "credits_200": {"credits": 200, "price_usd": 2.99},
    "credits_500": {"credits": 500, "price_usd": 4.99},
    "credits_1500": {"credits": 1500, "price_usd": 9.99},
}


class ProductListItem(BaseModel):
    product_id: str
    credits: int
    price_usd: float


@router.get("/api/v1/payments/products", tags=["payments"])
async def list_products():
    """获取可购买的积分商品列表"""
    return [
        ProductListItem(product_id=pid, **info)
        for pid, info in CREDIT_PRODUCTS.items()
    ]


# ========== Apple IAP 验证 ==========

APPLE_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt"
APPLE_SHARED_SECRET = os.getenv("APPLE_IAP_SHARED_SECRET", "")


class AppleIAPVerifyRequest(BaseModel):
    receipt_data: str = Field(..., description="Base64 编码的收据数据")
    product_id: str = Field(..., description="购买的产品 ID")


@router.post("/api/v1/payments/apple/verify", tags=["payments"])
async def verify_apple_iap(
    request: AppleIAPVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    """
    验证 Apple IAP 收据并发放积分。
    先尝试生产环境验证，如返回 21007 则切换到沙盒环境。
    """
    import requests as http_requests

    product = CREDIT_PRODUCTS.get(request.product_id)
    if not product:
        raise HTTPException(status_code=400, detail=f"Unknown product: {request.product_id}")

    payload = {"receipt-data": request.receipt_data}
    if APPLE_SHARED_SECRET:
        payload["password"] = APPLE_SHARED_SECRET

    resp = http_requests.post(APPLE_VERIFY_URL, json=payload, timeout=15)
    data = resp.json()

    if data.get("status") == 21007:
        resp = http_requests.post(APPLE_SANDBOX_URL, json=payload, timeout=15)
        data = resp.json()

    if data.get("status") != 0:
        logger.warning(f"Apple IAP verification failed: status={data.get('status')}")
        raise HTTPException(status_code=400, detail=f"Receipt verification failed (status: {data.get('status')})")

    credits_to_add = product["credits"]
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        credits_before = user.credits
        user.credits += credits_to_add
        session.add(user)
        session.commit()
        session.refresh(user)
        _record_transaction(
            user_id=user.id,
            transaction_type="recharge",
            amount=credits_to_add,
            credits_before=credits_before,
            credits_after=user.credits,
            description=f"Apple IAP: {request.product_id}",
            reference_type="apple_iap",
            reference_id=request.product_id,
        )
    logger.info(f"💰 Apple IAP: User #{current_user.id} +{credits_to_add} credits ({request.product_id})")
    return {"credits_added": credits_to_add, "credits_total": user.credits}


# ========== Google Play Billing 验证 ==========

class GooglePlayVerifyRequest(BaseModel):
    purchase_token: str = Field(..., description="Google Play 购买 token")
    product_id: str = Field(..., description="购买的产品 ID")


@router.post("/api/v1/payments/google/verify", tags=["payments"])
async def verify_google_play(
    request: GooglePlayVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    """
    验证 Google Play Billing 购买并发放积分。
    使用 Google Play Developer API 验证购买 token。
    """
    product = CREDIT_PRODUCTS.get(request.product_id)
    if not product:
        raise HTTPException(status_code=400, detail=f"Unknown product: {request.product_id}")

    # TODO: 接入 Google Play Developer API 验证
    # 需要 google-auth + service account credentials
    # 当前为信任模式，生产环境必须启用验证
    logger.warning(f"Google Play verification: trust mode (product={request.product_id})")

    credits_to_add = product["credits"]
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        credits_before = user.credits
        user.credits += credits_to_add
        session.add(user)
        session.commit()
        session.refresh(user)
        _record_transaction(
            user_id=user.id,
            transaction_type="recharge",
            amount=credits_to_add,
            credits_before=credits_before,
            credits_after=user.credits,
            description=f"Google Play: {request.product_id}",
            reference_type="google_play",
            reference_id=request.product_id,
        )
    logger.info(f"💰 Google Play: User #{current_user.id} +{credits_to_add} credits ({request.product_id})")
    return {"credits_added": credits_to_add, "credits_total": user.credits}


# ========== Stripe 支付 (Web) ==========

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "https://app.skyhunter.app/payment/success")
STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "https://app.skyhunter.app/payment/cancel")

STRIPE_PRICE_MAP = {
    "credits_50": os.getenv("STRIPE_PRICE_CREDITS_50", ""),
    "credits_200": os.getenv("STRIPE_PRICE_CREDITS_200", ""),
    "credits_500": os.getenv("STRIPE_PRICE_CREDITS_500", ""),
    "credits_1500": os.getenv("STRIPE_PRICE_CREDITS_1500", ""),
}


class StripeCheckoutRequest(BaseModel):
    product_id: str = Field(..., description="积分产品 ID")


class StripeCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.post(
    "/api/v1/payments/stripe/checkout",
    response_model=StripeCheckoutResponse,
    tags=["payments"],
)
async def create_stripe_checkout(
    request: StripeCheckoutRequest,
    current_user: User = Depends(get_current_user),
):
    """
    创建 Stripe Checkout Session，返回支付链接。
    用户跳转到 Stripe 完成支付后，通过 Webhook 发放积分。
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    product = CREDIT_PRODUCTS.get(request.product_id)
    if not product:
        raise HTTPException(status_code=400, detail=f"Unknown product: {request.product_id}")

    stripe_price_id = STRIPE_PRICE_MAP.get(request.product_id, "")
    if not stripe_price_id:
        raise HTTPException(status_code=400, detail=f"Stripe price not configured for: {request.product_id}")

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": stripe_price_id, "quantity": 1}],
        mode="payment",
        success_url=STRIPE_SUCCESS_URL + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=STRIPE_CANCEL_URL,
        client_reference_id=str(current_user.id),
        metadata={
            "user_id": str(current_user.id),
            "product_id": request.product_id,
            "credits": str(product["credits"]),
        },
    )

    return StripeCheckoutResponse(
        checkout_url=session.url,
        session_id=session.id,
    )


@router.post("/api/v1/payments/stripe/webhook", tags=["payments"])
async def stripe_webhook(request: Request):
    """
    Stripe Webhook 回调：支付完成后自动发放积分。
    必须配置 STRIPE_WEBHOOK_SECRET 以验证签名。
    """
    if not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        logger.error(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = int(session.get("metadata", {}).get("user_id", "0"))
        product_id = session.get("metadata", {}).get("product_id", "")
        credits_str = session.get("metadata", {}).get("credits", "0")
        credits_to_add = int(credits_str)

        if user_id and credits_to_add > 0:
            with Session(engine) as db_session:
                user = db_session.get(User, user_id)
                if user:
                    credits_before = user.credits
                    user.credits += credits_to_add
                    db_session.add(user)
                    db_session.commit()
                    db_session.refresh(user)
                    _record_transaction(
                        user_id=user.id,
                        transaction_type="recharge",
                        amount=credits_to_add,
                        credits_before=credits_before,
                        credits_after=user.credits,
                        description=f"Stripe: {product_id}",
                        reference_type="stripe",
                        reference_id=session.get("id", ""),
                    )
                    logger.info(f"💰 Stripe: User #{user_id} +{credits_to_add} credits ({product_id})")

    return {"status": "ok"}
