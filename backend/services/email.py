import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from config import EMAIL_PROVIDER, BREVO_API_KEY, EMAIL_SENDER, EMAIL_PASSWORD, SMTP_HOST, SMTP_PORT, API_BASE_URL, logger
# ============================================================================
# 通知服务
# ============================================================================


def _send_email_core(to_email: str, subject: str, html_content: str, sender_name: str = "SkyHunter Bot") -> bool:
    """
    核心邮件发送函数：根据 EMAIL_PROVIDER 切换 SMTP / Brevo 双通道。

    Args:
        to_email: 收件人邮箱
        subject: 邮件主题
        html_content: HTML 邮件正文
        sender_name: 发件人显示名称

    Returns:
        是否发送成功
    """
    if not to_email:
        logger.warning("📧 收件人邮箱为空，跳过发送")
        return False

    if EMAIL_PROVIDER == "brevo":
        # ── Brevo HTTP API 通道 ──
        import requests as _requests
        if not BREVO_API_KEY:
            logger.warning("📧 BREVO_API_KEY 未配置，跳过邮件通知")
            return False
        payload = {
            "sender": {"name": sender_name, "email": EMAIL_SENDER},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        try:
            resp = _requests.post(
                "https://api.brevo.com/v3/smtp/email", json=payload,
                headers={"accept": "application/json", "api-key": BREVO_API_KEY, "content-type": "application/json"},
                timeout=10,
            )
            if resp.status_code == 201:
                logger.info(f"📧 [Brevo] 邮件已发送至 {to_email}")
                return True
            else:
                logger.error(f"📧 [Brevo] 发送失败: HTTP {resp.status_code} - {resp.text}")
                return False
        except Exception as e:
            logger.error(f"❌ [Brevo] 邮件网络错误: {e}")
            return False
    else:
        # ── 原生 SMTP 通道（默认，适用于 QQ 邮箱等免费邮箱） ──
        if not EMAIL_PASSWORD:
            logger.warning("📧 EMAIL_PASSWORD 未配置，跳过 SMTP 邮件发送")
            return False
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{sender_name} <{EMAIL_SENDER}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        try:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.login(EMAIL_SENDER, EMAIL_PASSWORD)
                server.sendmail(EMAIL_SENDER, [to_email], msg.as_string())
            logger.info(f"📧 [SMTP] 邮件已发送至 {to_email} (via {SMTP_HOST})")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ [SMTP] 认证失败（请检查 EMAIL_SENDER / EMAIL_PASSWORD）: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"❌ [SMTP] 发送异常: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ [SMTP] 网络错误: {e}")
            return False


def send_alert_email(
    to_email: str, origin: str, destination: str, price: float,
    target_price: float, departure_date: str, link: str = "#",
    adults: int = 1, children: int = 0,
    airline: Optional[str] = None, flight_number: Optional[str] = None,
    monitor_id: Optional[int] = None,
    recipient_name: Optional[str] = None,
) -> bool:
    """
    发送降价提醒邮件（支持多人价格与航司信息，通过 _send_email_core 统一派发）
    若 API_BASE_URL 已配置且传入 monitor_id，邮件中的链接将使用追踪 URL 以统计点击。
    """
    if not to_email:
        logger.warning("📧 send_alert_email: 收件人为空，跳过")
        return False
    logger.info(f"📧 send_alert_email: {origin}→{destination} ${price:.2f}≤${target_price:.2f} → {to_email}")
    # 优先使用追踪链接（便于统计点击转化）
    final_link = link
    if API_BASE_URL and monitor_id and link and link != "#":
        final_link = f"{API_BASE_URL}/api/v1/track/{monitor_id}"
    total_pax = adults + children
    per_person = (price / total_pax) if total_pax > 0 else price
    target_per_person = (target_price / total_pax) if total_pax > 0 else target_price
    savings = target_price - price
    savings_pct = (savings / target_price) * 100 if target_price > 0 else 0
    savings_per_person = target_per_person - per_person
    total_savings = savings

    greeting = f"你好, {recipient_name}!" if recipient_name else "你好!"

    # 多人时：全程总价、人均价、目标人均、人均节省、总节省
    if total_pax > 1:
        price_label = f"全程总价 ({adults}成人)"
        if children > 0:
            price_label = f"全程总价 ({adults}成人{children}童)"
        price_line = f"""<div style="font-size: 14px; color: #558B2F; font-weight: bold;">{price_label}</div>
        <div style="font-size: 48px; color: #00C853; font-weight: 800; margin: 10px 0;">${price:.2f}</div>
        <div style="color: #90A4AE; font-size: 14px;">您的目标人均价: ${target_per_person:.2f}</div>
        <div style="font-size: 13px; color: #558B2F; margin-top: 12px;">{adults}成人{f' · {children}童' if children else ''} · 人均 ${per_person:.2f} · 目标人均 ${target_per_person:.2f}</div>"""
        savings_line = f"<div style=\"background: #00C853; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: bold; margin-top: 16px; display: inline-block;\">🔥 人均节省 ${savings_per_person:.2f}, 共省 ${total_savings:.2f} ({savings_pct:.0f}%)</div>" if savings > 0 else ""
    else:
        price_line = f"""<div style="font-size: 12px; color: #558B2F; font-weight: bold;">当前最低价</div>
        <div style="font-size: 48px; color: #00C853; font-weight: 800; margin: 10px 0;">${price:.2f}</div>
        <div style="color: #90A4AE; font-size: 14px; text-decoration: line-through;">您的目标价: ${target_price:.2f}</div>"""
        savings_line = f"<div style='background: #00C853; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: bold; margin-top: 12px; display: inline-block;'>🔥 节省 ${savings:.2f} ({savings_pct:.0f}%)</div>" if savings > 0 else ""

    # 优选航空公司（承运航司）
    airline_block = ""
    if airline or flight_number:
        airline_block = f"<div style=\"background: #E3F2FD; padding: 10px 20px; border-radius: 50px; margin-bottom: 20px; font-size: 14px; display: inline-block;\">✈️ 承运航司: {airline or '—'}{(' · ' + flight_number) if flight_number else ''}</div>"

    # 免责说明
    disclaimer = """<p style="font-size: 12px; color: #90A4AE; margin-top: 24px; line-height: 1.6;">
        ⚠️ 请自行前往 Google Flights 或航司官网完成购买。<br>
        本通知仅提示价格变化，SkyHunter 不参与任何购票交易，不对最终票价负责。
    </p>"""

    html_content = f"""
    <html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1E88E5 0%, #1565C0 100%); color: #fff; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">✈️ 航班降价提醒</h1>
            <p style="margin-top: 10px; opacity: 0.9;">{greeting}</p>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #37474F; margin-bottom: 16px;">{origin} → {destination}</div>
            <div style="background: #ECEFF1; padding: 8px 20px; border-radius: 50px; display: inline-block; margin-bottom: 16px; font-size: 14px;">📅 出发日期: {departure_date}</div>
            {airline_block}
            <div style="background: #F1F8E9; border: 2px solid #00C853; border-radius: 12px; padding: 28px; margin-bottom: 24px;">
                {price_line}
                {savings_line}
            </div>
            <p style="font-size: 14px; color: #546E7A; margin-bottom: 24px;">SkyHunter 已为您监控到符合预算的机票，价格随时可能变动，建议尽快确认。</p>
            <a href="{final_link}" style="background: #1E88E5; color: #fff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block;">立即查看详情 →</a>
            {disclaimer}
        </div>
        <div style="background: #CFD8DC; padding: 15px; text-align: center; color: #546E7A; font-size: 12px;">SkyHunter 自动监控服务，如需退订请回复本邮件</div>
    </div></body></html>
    """
    subject = f"✈️ 航班降价提醒 {origin} → {destination} 现价 ${price:.2f}"
    return _send_email_core(to_email, subject, html_content, sender_name="SkyHunter Bot")


def send_verification_code_email(to_email: str, code: str) -> bool:
    """
    发送邮箱验证码邮件（注册后验证邮箱所有权）

    Args:
        to_email: 收件人邮箱
        code: 6位数字验证码

    Returns:
        是否发送成功
    """
    if not to_email:
        return False
    html_content = f"""
    <html><body style="font-family: -apple-system, sans-serif; background-color: #0a0a0b; margin: 0; padding: 0;">
    <div style="max-width: 500px; margin: 30px auto; background: #18181b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,255,0,0.3);">
        <div style="background: linear-gradient(135deg, #09090b 0%, #18181b 100%); color: #00FF00; padding: 30px 20px; text-align: center; border-bottom: 1px solid rgba(0,255,0,0.2);">
            <h1 style="margin: 0; font-size: 22px; font-family: 'Courier New', monospace; letter-spacing: 4px;">&#9993; EMAIL VERIFICATION</h1>
            <p style="margin-top: 8px; color: #a1a1aa; font-size: 12px; letter-spacing: 2px;">SKYHUNTER PRO SECURITY</p>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
            <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 8px;">Welcome to SkyHunter!</p>
            <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Use the verification code below to confirm your email address:</p>
            <div style="background: #09090b; border: 2px solid #00FF00; border-radius: 12px; padding: 20px; margin-bottom: 24px; display: inline-block;">
                <div style="font-size: 42px; color: #00FF00; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', monospace;">{code}</div>
            </div>
            <p style="color: #666; font-size: 12px;">This code will expire in <strong style="color: #FFD700;">15 minutes</strong>.</p>
            <p style="color: #555; font-size: 11px; margin-top: 16px;">If you didn't create an account, please ignore this email.</p>
        </div>
        <div style="background: #09090b; padding: 15px; text-align: center; color: #333; font-size: 11px; border-top: 1px solid rgba(0,255,0,0.1);">SkyHunter Pro &middot; Secure Authentication System</div>
    </div></body></html>
    """
    subject = f"✉️ SkyHunter Email Verification Code: {code}"
    return _send_email_core(to_email, subject, html_content, sender_name="SkyHunter Security")


def send_reset_code_email(to_email: str, code: str) -> bool:
    """
    发送密码重置验证码邮件（通过 _send_email_core 统一派发）

    Args:
        to_email: 收件人邮箱
        code: 6位数字验证码

    Returns:
        是否发送成功
    """
    if not to_email:
        return False
    html_content = f"""
    <html><body style="font-family: -apple-system, sans-serif; background-color: #0a0a0b; margin: 0; padding: 0;">
    <div style="max-width: 500px; margin: 30px auto; background: #18181b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,255,0,0.3);">
        <div style="background: linear-gradient(135deg, #09090b 0%, #18181b 100%); color: #00FF00; padding: 30px 20px; text-align: center; border-bottom: 1px solid rgba(0,255,0,0.2);">
            <h1 style="margin: 0; font-size: 22px; font-family: 'Courier New', monospace; letter-spacing: 4px;">🔐 PASSWORD RESET</h1>
            <p style="margin-top: 8px; color: #a1a1aa; font-size: 12px; letter-spacing: 2px;">SKYHUNTER PRO SECURITY</p>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
            <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Use the verification code below to reset your password:</p>
            <div style="background: #09090b; border: 2px solid #00FF00; border-radius: 12px; padding: 20px; margin-bottom: 24px; display: inline-block;">
                <div style="font-size: 42px; color: #00FF00; font-weight: 800; letter-spacing: 12px; font-family: 'Courier New', monospace;">{code}</div>
            </div>
            <p style="color: #666; font-size: 12px;">This code will expire in <strong style="color: #FFD700;">15 minutes</strong>.</p>
            <p style="color: #555; font-size: 11px; margin-top: 16px;">If you didn't request this, please ignore this email.</p>
        </div>
        <div style="background: #09090b; padding: 15px; text-align: center; color: #333; font-size: 11px; border-top: 1px solid rgba(0,255,0,0.1);">SkyHunter Pro · Secure Authentication System</div>
    </div></body></html>
    """
    subject = f"🔐 SkyHunter Password Reset Code: {code}"
    return _send_email_core(to_email, subject, html_content, sender_name="SkyHunter Security")


