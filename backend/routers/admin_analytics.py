from fastapi import APIRouter, Depends, HTTPException, Query as FastQuery, status
from starlette.requests import Request as StarletteRequest
from sqlmodel import Session, select
from sqlalchemy import func, text, case, distinct
from datetime import datetime, timedelta, timezone
from typing import List
import pyotp
import qrcode
import qrcode.constants
import io
import base64

from db import engine
from models.database import (
    User, MonitorTask, PriceHistory, ApiUsageLog,
    ApiCostRecord, AdminBudget, TransactionHistory, AdminAuditLog, utc_iso_now,
)
from schemas.api_models import (
    AnalyticsOverviewResponse, UserTrendsResponse, TimeSeriesPoint,
    ApiUsageTrendsResponse, UserActivityResponse, UserActivityItem,
    CostSummaryResponse, FloatTimeSeriesPoint,
    GeoDistributionResponse, GeoDistributionItem,
    TopRoutesResponse, TopRouteItem,
    AdminBudgetRequest, AdminBudgetResponse,
    AdminAuditLogResponse,
    TotpSetupResponse, TotpVerifyRequest,
)
from api.deps import get_current_admin
from services.scheduler import _scheduler
from config import logger

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _date_str(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _get_time_boundaries(range_type: str):
    """根据时间范围类型返回 (起始时间, 分组格式标签生成函数, 步长列表)。"""
    now = _utc_now()

    if range_type == "week":
        start = now - timedelta(weeks=12)
        periods = []
        cursor = start
        while cursor <= now:
            week_start = cursor - timedelta(days=cursor.weekday())
            label = week_start.strftime("%m/%d")
            periods.append((label, week_start, week_start + timedelta(days=7)))
            cursor += timedelta(days=7)
        return start, periods

    if range_type == "month":
        periods = []
        for i in range(11, -1, -1):
            dt = now - timedelta(days=i * 30)
            label = dt.strftime("%Y-%m")
            month_start = dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)
            periods.append((label, month_start, month_end))
        start = periods[0][1]
        return start, periods

    if range_type == "quarter":
        periods = []
        for i in range(7, -1, -1):
            dt = now - timedelta(days=i * 91)
            q = (dt.month - 1) // 3 + 1
            label = f"{dt.year} Q{q}"
            q_start_month = (q - 1) * 3 + 1
            q_start = dt.replace(month=q_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
            if q == 4:
                q_end = q_start.replace(year=q_start.year + 1, month=1)
            else:
                q_end = q_start.replace(month=q_start_month + 3)
            periods.append((label, q_start, q_end))
        start = periods[0][1]
        return start, periods

    # default: "day" - 最近 30 天
    start = now - timedelta(days=30)
    periods = []
    for i in range(30):
        dt = start + timedelta(days=i)
        label = dt.strftime("%m/%d")
        day_start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        periods.append((label, day_start, day_end))
    return start, periods


def _count_in_period(session, model, date_field, period_start, period_end, extra_filters=None):
    """统计指定时间段内的记录数。"""
    start_str = period_start.strftime("%Y-%m-%dT%H:%M:%S")
    end_str = period_end.strftime("%Y-%m-%dT%H:%M:%S")
    stmt = select(func.count()).select_from(model).where(
        date_field >= start_str,
        date_field < end_str,
    )
    if extra_filters:
        for f in extra_filters:
            stmt = stmt.where(f)
    return session.exec(stmt).one() or 0


# ============================================================================
# 概览 KPI
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/overview",
    response_model=AnalyticsOverviewResponse,
    summary="仪表板概览 KPI",
    tags=["admin-analytics"],
)
async def analytics_overview(admin_user: User = Depends(get_current_admin)):
    now = _utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%S")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")

    with Session(engine) as session:
        total_users = session.exec(select(func.count()).select_from(User)).one() or 0
        today_new_users = session.exec(
            select(func.count()).select_from(User).where(User.created_at >= today_start)
        ).one() or 0
        active_monitors = session.exec(
            select(func.count()).select_from(MonitorTask).where(
                MonitorTask.status == "active", MonitorTask.is_deleted == False
            )
        ).one() or 0
        total_searches = session.exec(select(func.count()).select_from(PriceHistory)).one() or 0

        today_api_calls = session.exec(
            select(func.count()).select_from(ApiUsageLog).where(ApiUsageLog.created_at >= today_start)
        ).one() or 0

        today_searches = session.exec(
            select(func.count()).select_from(ApiUsageLog).where(
                ApiUsageLog.created_at >= today_start,
                ApiUsageLog.endpoint.like("%/search%"),
                ApiUsageLog.method == "POST",
            )
        ).one() or 0

        # DAU/WAU/MAU
        dau = session.exec(
            select(func.count(distinct(ApiUsageLog.user_id))).where(
                ApiUsageLog.created_at >= today_start,
                ApiUsageLog.user_id.isnot(None),
            )
        ).one() or 0
        wau = session.exec(
            select(func.count(distinct(ApiUsageLog.user_id))).where(
                ApiUsageLog.created_at >= week_ago,
                ApiUsageLog.user_id.isnot(None),
            )
        ).one() or 0
        mau = session.exec(
            select(func.count(distinct(ApiUsageLog.user_id))).where(
                ApiUsageLog.created_at >= month_ago,
                ApiUsageLog.user_id.isnot(None),
            )
        ).one() or 0

        # 平均响应时间（今日）
        avg_rt = session.exec(
            select(func.avg(ApiUsageLog.response_time_ms)).where(
                ApiUsageLog.created_at >= today_start
            )
        ).one()
        avg_response_time_ms = round(float(avg_rt), 1) if avg_rt else 0.0

        # 错误率（今日）
        error_count = session.exec(
            select(func.count()).select_from(ApiUsageLog).where(
                ApiUsageLog.created_at >= today_start,
                ApiUsageLog.status_code >= 500,
            )
        ).one() or 0
        error_rate = round((error_count / today_api_calls * 100), 2) if today_api_calls > 0 else 0.0

    scheduler_running = _scheduler is not None and _scheduler.running if _scheduler else False

    return AnalyticsOverviewResponse(
        total_users=total_users,
        today_new_users=today_new_users,
        active_monitors=active_monitors,
        total_searches=total_searches,
        today_api_calls=today_api_calls,
        today_searches=today_searches,
        scheduler_status="Running" if scheduler_running else "Stopped",
        last_run_time=now.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        dau=dau,
        wau=wau,
        mau=mau,
        avg_response_time_ms=avg_response_time_ms,
        error_rate_percent=error_rate,
    )


# ============================================================================
# 用户注册趋势
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/user-trends",
    response_model=UserTrendsResponse,
    summary="用户注册趋势",
    tags=["admin-analytics"],
)
async def analytics_user_trends(
    range: str = FastQuery(default="day", description="day / week / month / quarter"),
    admin_user: User = Depends(get_current_admin),
):
    start, periods = _get_time_boundaries(range)
    data = []
    with Session(engine) as session:
        for label, p_start, p_end in periods:
            count = _count_in_period(session, User, User.created_at, p_start, p_end)
            data.append(TimeSeriesPoint(label=label, value=count))
    return UserTrendsResponse(range=range, data=data)


# ============================================================================
# API 使用量趋势
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/api-usage",
    response_model=ApiUsageTrendsResponse,
    summary="API 使用量趋势",
    tags=["admin-analytics"],
)
async def analytics_api_usage(
    range: str = FastQuery(default="day", description="day / week / month / quarter"),
    admin_user: User = Depends(get_current_admin),
):
    start, periods = _get_time_boundaries(range)
    total_calls = []
    with Session(engine) as session:
        for label, p_start, p_end in periods:
            count = _count_in_period(session, ApiUsageLog, ApiUsageLog.created_at, p_start, p_end)
            total_calls.append(TimeSeriesPoint(label=label, value=count))

    return ApiUsageTrendsResponse(range=range, total_calls=total_calls)


# ============================================================================
# 每用户活动明细
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/user-activity",
    response_model=UserActivityResponse,
    summary="每用户活动明细",
    tags=["admin-analytics"],
)
async def analytics_user_activity(
    page: int = FastQuery(default=1, ge=1),
    page_size: int = FastQuery(default=20, ge=5, le=100),
    q: str = FastQuery(default="", max_length=100),
    admin_user: User = Depends(get_current_admin),
):
    with Session(engine) as session:
        base_query = select(User)
        if q.strip():
            base_query = base_query.where(User.email.like(f"%{q.strip()}%"))

        total = session.exec(
            select(func.count()).select_from(User).where(
                User.email.like(f"%{q.strip()}%") if q.strip() else True
            )
        ).one() or 0

        users = session.exec(
            base_query.order_by(User.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()

        items = []
        for u in users:
            # 搜索次数（通过 ApiUsageLog 统计 POST /search 端点）
            search_count = session.exec(
                select(func.count()).select_from(ApiUsageLog).where(
                    ApiUsageLog.user_id == u.id,
                    ApiUsageLog.endpoint.like("%/search%"),
                    ApiUsageLog.method == "POST",
                )
            ).one() or 0

            monitor_count = session.exec(
                select(func.count()).select_from(MonitorTask).where(
                    MonitorTask.user_id == u.id,
                    MonitorTask.is_deleted == False,
                )
            ).one() or 0

            # 积分消耗（负数 amount 总和的绝对值）
            consumed = session.exec(
                select(func.coalesce(func.sum(
                    case((TransactionHistory.amount < 0, -TransactionHistory.amount), else_=0)
                ), 0)).where(TransactionHistory.user_id == u.id)
            ).one() or 0

            items.append(UserActivityItem(
                user_id=u.id,
                email=u.email,
                role=u.role,
                search_count=search_count,
                monitor_count=monitor_count,
                credits_consumed=int(consumed),
                last_active=u.last_login_at,
                country=u.country,
            ))

    return UserActivityResponse(items=items, total=total, page=page, page_size=page_size)


# ============================================================================
# API 成本统计
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/costs",
    response_model=CostSummaryResponse,
    summary="API 成本统计",
    tags=["admin-analytics"],
)
async def analytics_costs(
    range: str = FastQuery(default="day", description="day / week / month / quarter"),
    admin_user: User = Depends(get_current_admin),
):
    start, periods = _get_time_boundaries(range)

    with Session(engine) as session:
        total_budget = session.exec(
            select(func.coalesce(func.sum(AdminBudget.amount_usd), 0.0))
        ).one() or 0.0

        total_spent = session.exec(
            select(func.coalesce(func.sum(ApiCostRecord.cost_usd), 0.0))
        ).one() or 0.0

        total_api_calls = session.exec(
            select(func.count()).select_from(ApiCostRecord)
        ).one() or 0

        avg_cost = round(float(total_spent) / total_api_calls, 5) if total_api_calls > 0 else 0.0

        trend = []
        for label, p_start, p_end in periods:
            start_str = p_start.strftime("%Y-%m-%dT%H:%M:%S")
            end_str = p_end.strftime("%Y-%m-%dT%H:%M:%S")
            period_cost = session.exec(
                select(func.coalesce(func.sum(ApiCostRecord.cost_usd), 0.0)).where(
                    ApiCostRecord.created_at >= start_str,
                    ApiCostRecord.created_at < end_str,
                )
            ).one() or 0.0
            trend.append(FloatTimeSeriesPoint(label=label, value=round(float(period_cost), 4)))

    return CostSummaryResponse(
        total_budget=round(float(total_budget), 2),
        total_spent=round(float(total_spent), 4),
        balance=round(float(total_budget) - float(total_spent), 2),
        total_api_calls=total_api_calls,
        avg_cost_per_call=avg_cost,
        trend=trend,
        range=range,
    )


# ============================================================================
# 用户地理分布
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/geo",
    response_model=GeoDistributionResponse,
    summary="用户国家/地区分布",
    tags=["admin-analytics"],
)
async def analytics_geo(admin_user: User = Depends(get_current_admin)):
    with Session(engine) as session:
        results = session.exec(
            select(User.country, func.count(User.id).label("cnt"))
            .where(User.country.isnot(None), User.country != "")
            .group_by(User.country)
            .order_by(func.count(User.id).desc())
        ).all()

        total_with_geo = sum(r[1] for r in results) if results else 0
        total_all = session.exec(select(func.count()).select_from(User)).one() or 0
        total_without_geo = total_all - total_with_geo

        data = []
        for country, count in results:
            pct = round((count / total_with_geo * 100), 1) if total_with_geo > 0 else 0.0
            data.append(GeoDistributionItem(country=country, count=count, percentage=pct))

    return GeoDistributionResponse(
        data=data,
        total_with_geo=total_with_geo,
        total_without_geo=total_without_geo,
    )


# ============================================================================
# 热门航线
# ============================================================================

@router.get(
    "/api/v1/admin/analytics/top-routes",
    response_model=TopRoutesResponse,
    summary="热门航线 Top 10",
    tags=["admin-analytics"],
)
async def analytics_top_routes(admin_user: User = Depends(get_current_admin)):
    with Session(engine) as session:
        results = session.exec(
            select(
                MonitorTask.origin,
                MonitorTask.destination,
                func.count(MonitorTask.id).label("cnt"),
            )
            .group_by(MonitorTask.origin, MonitorTask.destination)
            .order_by(func.count(MonitorTask.id).desc())
            .limit(10)
        ).all()

        data = [
            TopRouteItem(origin=r[0], destination=r[1], count=r[2])
            for r in results
        ]
    return TopRoutesResponse(data=data)


# ============================================================================
# 预算管理
# ============================================================================

@router.post(
    "/api/v1/admin/budget",
    response_model=AdminBudgetResponse,
    status_code=201,
    summary="录入 API 充值/预算",
    tags=["admin-analytics"],
)
async def admin_add_budget(
    request: AdminBudgetRequest,
    admin_user: User = Depends(get_current_admin),
):
    with Session(engine) as session:
        record = AdminBudget(
            amount_usd=request.amount_usd,
            provider=request.provider,
            description=request.description,
            created_at=utc_iso_now(),
        )
        session.add(record)

        audit = AdminAuditLog(
            admin_user_id=admin_user.id,
            action="budget_add",
            target_type="budget",
            details=f"${request.amount_usd} to {request.provider}",
            created_at=utc_iso_now(),
        )
        session.add(audit)
        session.commit()
        session.refresh(record)

    logger.info(f"💰 Admin #{admin_user.id} added budget: ${request.amount_usd} ({request.provider})")

    return AdminBudgetResponse(
        id=record.id,
        amount_usd=record.amount_usd,
        provider=record.provider,
        description=record.description,
        created_at=record.created_at,
    )


@router.get(
    "/api/v1/admin/budget",
    response_model=List[AdminBudgetResponse],
    summary="查看预算充值记录",
    tags=["admin-analytics"],
)
async def admin_list_budget(
    limit: int = FastQuery(default=50, ge=1, le=200),
    admin_user: User = Depends(get_current_admin),
):
    with Session(engine) as session:
        records = session.exec(
            select(AdminBudget).order_by(AdminBudget.id.desc()).limit(limit)
        ).all()
        return [
            AdminBudgetResponse(
                id=r.id, amount_usd=r.amount_usd, provider=r.provider,
                description=r.description, created_at=r.created_at,
            )
            for r in records
        ]


# ============================================================================
# 审计日志
# ============================================================================

@router.get(
    "/api/v1/admin/audit-log",
    response_model=List[AdminAuditLogResponse],
    summary="管理员操作审计日志",
    tags=["admin-analytics"],
)
async def admin_audit_log(
    limit: int = FastQuery(default=50, ge=1, le=200),
    admin_user: User = Depends(get_current_admin),
):
    with Session(engine) as session:
        logs = session.exec(
            select(AdminAuditLog).order_by(AdminAuditLog.id.desc()).limit(limit)
        ).all()
        return [
            AdminAuditLogResponse(
                id=l.id, admin_user_id=l.admin_user_id, action=l.action,
                target_type=l.target_type, target_id=l.target_id,
                details=l.details, ip_address=l.ip_address,
                created_at=l.created_at,
            )
            for l in logs
        ]


# ============================================================================
# CSV 数据导出
# ============================================================================

from fastapi.responses import StreamingResponse
import csv as csv_mod

@router.get(
    "/api/v1/admin/export/users",
    summary="导出用户列表 CSV",
    tags=["admin-export"],
)
async def export_users_csv(admin_user: User = Depends(get_current_admin)):
    """导出所有用户数据为 CSV 文件。"""
    with Session(engine) as session:
        users = session.exec(select(User).order_by(User.id)).all()

    def generate():
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["id", "email", "full_name", "role", "credits", "country", "region", "city", "email_verified", "created_at", "last_login_at"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for u in users:
            writer.writerow([u.id, u.email, u.full_name or "", u.role, u.credits, u.country or "", u.region or "", u.city or "", u.email_verified, u.created_at, u.last_login_at or ""])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )


@router.get(
    "/api/v1/admin/export/api-usage",
    summary="导出 API 使用记录 CSV",
    tags=["admin-export"],
)
async def export_api_usage_csv(
    range: str = FastQuery(default="month", regex="^(day|week|month|quarter)$"),
    admin_user: User = Depends(get_current_admin),
):
    """导出指定时间范围内的 API 使用日志为 CSV。"""
    start_str, _ = _get_time_boundaries(range)
    with Session(engine) as session:
        logs = session.exec(
            select(ApiUsageLog)
            .where(ApiUsageLog.created_at >= start_str)
            .order_by(ApiUsageLog.id.desc())
        ).all()

    def generate():
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["id", "user_id", "endpoint", "method", "status_code", "response_time_ms", "ip_address", "created_at"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for log in logs:
            writer.writerow([log.id, log.user_id or "", log.endpoint, log.method, log.status_code, log.response_time_ms, log.ip_address or "", log.created_at])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=api_usage_{range}.csv"},
    )


@router.get(
    "/api/v1/admin/export/costs",
    summary="导出 API 成本记录 CSV",
    tags=["admin-export"],
)
async def export_costs_csv(
    range: str = FastQuery(default="month", regex="^(day|week|month|quarter)$"),
    admin_user: User = Depends(get_current_admin),
):
    """导出指定时间范围内的 API 成本记录为 CSV。"""
    start_str, _ = _get_time_boundaries(range)
    with Session(engine) as session:
        records = session.exec(
            select(ApiCostRecord)
            .where(ApiCostRecord.created_at >= start_str)
            .order_by(ApiCostRecord.id.desc())
        ).all()

    def generate():
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["id", "api_provider", "cost_usd", "request_type", "reference_id", "origin", "destination", "created_at"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for r in records:
            writer.writerow([r.id, r.api_provider, r.cost_usd, r.request_type, r.reference_id or "", r.origin or "", r.destination or "", r.created_at])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=costs_{range}.csv"},
    )


@router.get(
    "/api/v1/admin/export/audit-log",
    summary="导出审计日志 CSV",
    tags=["admin-export"],
)
async def export_audit_log_csv(admin_user: User = Depends(get_current_admin)):
    """导出管理员操作审计日志为 CSV。"""
    with Session(engine) as session:
        logs = session.exec(
            select(AdminAuditLog).order_by(AdminAuditLog.id.desc())
        ).all()

    def generate():
        buf = io.StringIO()
        writer = csv_mod.writer(buf)
        writer.writerow(["id", "admin_user_id", "action", "target_type", "target_id", "details", "ip_address", "created_at"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for l in logs:
            writer.writerow([l.id, l.admin_user_id, l.action, l.target_type or "", l.target_id or "", l.details or "", l.ip_address or "", l.created_at])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


# ============================================================================
# TOTP 双因素认证
# ============================================================================

def _generate_qr_base64(provisioning_uri: str) -> str:
    """将 TOTP provisioning URI 生成为 base64 PNG 图片。"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
    )
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


@router.post(
    "/api/v1/admin/security/totp/setup",
    response_model=TotpSetupResponse,
    summary="生成 TOTP 密钥和 QR 码",
    tags=["admin-security"],
)
async def totp_setup(admin_user: User = Depends(get_current_admin)):
    """
    为当前管理员生成新的 TOTP 密钥。
    返回 secret、provisioning_uri 和 QR 码 base64 图片。
    用户需要用 Google Authenticator 扫码后调用 verify 接口确认。
    """
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=admin_user.email,
        issuer_name="SkyHunter Pro Admin",
    )
    qr_b64 = _generate_qr_base64(provisioning_uri)

    with Session(engine) as session:
        db_user = session.get(User, admin_user.id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        db_user.totp_secret = secret
        session.add(db_user)
        session.commit()

    logger.info(f"TOTP setup initiated for admin {admin_user.email} (ID: {admin_user.id})")

    return TotpSetupResponse(
        secret=secret,
        provisioning_uri=provisioning_uri,
        qr_code_base64=qr_b64,
    )


@router.post(
    "/api/v1/admin/security/totp/verify",
    summary="验证 TOTP 码并启用双因素认证",
    tags=["admin-security"],
)
async def totp_verify(
    body: TotpVerifyRequest,
    http_request: StarletteRequest,
    admin_user: User = Depends(get_current_admin),
):
    """
    验证用户输入的 6 位 TOTP 码。
    验证通过后将 totp_enabled 设置为 True，正式启用 2FA。
    """
    with Session(engine) as session:
        db_user = session.get(User, admin_user.id)
        if not db_user or not db_user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TOTP not configured. Call /setup first.",
            )

        totp = pyotp.TOTP(db_user.totp_secret)
        if not totp.verify(body.code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid TOTP code. Please try again.",
            )

        db_user.totp_enabled = True
        session.add(db_user)

        from core.middleware import _get_client_ip
        ip = _get_client_ip(http_request) if http_request else None
        audit = AdminAuditLog(
            admin_user_id=admin_user.id,
            action="totp_enable",
            target_type="user",
            target_id=str(admin_user.id),
            details='{"action": "TOTP 2FA enabled"}',
            ip_address=ip,
            created_at=utc_iso_now(),
        )
        session.add(audit)
        session.commit()

    logger.info(f"TOTP enabled for admin {admin_user.email} (ID: {admin_user.id})")
    return {"message": "TOTP 2FA has been enabled successfully."}


@router.post(
    "/api/v1/admin/security/totp/disable",
    summary="禁用 TOTP 双因素认证",
    tags=["admin-security"],
)
async def totp_disable(
    http_request: StarletteRequest,
    admin_user: User = Depends(get_current_admin),
):
    """
    禁用当前管理员的 TOTP 双因素认证，清除密钥。
    """
    with Session(engine) as session:
        db_user = session.get(User, admin_user.id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")

        db_user.totp_secret = None
        db_user.totp_enabled = False
        session.add(db_user)

        from core.middleware import _get_client_ip
        ip = _get_client_ip(http_request) if http_request else None
        audit = AdminAuditLog(
            admin_user_id=admin_user.id,
            action="totp_disable",
            target_type="user",
            target_id=str(admin_user.id),
            details='{"action": "TOTP 2FA disabled"}',
            ip_address=ip,
            created_at=utc_iso_now(),
        )
        session.add(audit)
        session.commit()

    logger.info(f"TOTP disabled for admin {admin_user.email} (ID: {admin_user.id})")
    return {"message": "TOTP 2FA has been disabled."}


@router.get(
    "/api/v1/admin/security/totp/status",
    summary="查询当前管理员的 TOTP 状态",
    tags=["admin-security"],
)
async def totp_status(admin_user: User = Depends(get_current_admin)):
    """返回当前管理员是否已启用 TOTP。"""
    return {"totp_enabled": admin_user.totp_enabled}
