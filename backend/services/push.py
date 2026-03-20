# filename: services/push.py
import requests as http_requests
from typing import List, Optional
from sqlmodel import Session, select
from db import engine
from models.database import PushToken
from config import logger


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_notification(
    user_id: int,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """
    向指定用户的所有注册设备发送推送通知。
    使用 Expo Push Notification Service (无需 Firebase 服务端密钥)。

    Returns:
        成功发送的数量
    """
    with Session(engine) as session:
        tokens = session.exec(
            select(PushToken).where(PushToken.user_id == user_id)
        ).all()

    if not tokens:
        return 0

    messages = []
    for pt in tokens:
        msg = {
            "to": pt.token,
            "sound": "default",
            "title": title,
            "body": body,
        }
        if data:
            msg["data"] = data
        messages.append(msg)

    sent = 0
    try:
        for i in range(0, len(messages), 100):
            batch = messages[i:i + 100]
            resp = http_requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=15,
            )
            if resp.status_code == 200:
                result = resp.json()
                for ticket in result.get("data", []):
                    if ticket.get("status") == "ok":
                        sent += 1
            else:
                logger.warning(f"Push API returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.error(f"Push notification failed for user #{user_id}: {e}")

    logger.info(f"📱 Push: sent {sent}/{len(messages)} to user #{user_id}")
    return sent


def send_price_alert_push(
    user_id: int,
    origin: str,
    destination: str,
    price: float,
    target_price: float,
    monitor_id: int,
) -> int:
    """发送价格达标推送通知"""
    return send_push_notification(
        user_id=user_id,
        title=f"Price Alert: {origin} -> {destination}",
        body=f"Price dropped to ${price:.0f} (target: ${target_price:.0f})",
        data={"type": "price_alert", "monitor_id": monitor_id},
    )
