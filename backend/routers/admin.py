from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query as FastQuery
from sqlmodel import Session, select
from sqlalchemy import func
from datetime import datetime
from typing import List
import csv
import io
import os
import shutil
from db import engine
from models.database import User, MonitorTask, PriceHistory, PasswordReset, TransactionHistory, Airport
from schemas.api_models import *
from api.deps import get_current_admin
from config import logger
from services.scheduler import _scheduler
from services.billing import _record_transaction, _refund_user_credits

AIRPORT_CSV_BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "backups")

router = APIRouter()
# ============================================================================
# API 端点：Admin 管理面板（RBAC: admin only）
# ============================================================================


@router.get("/api/v1/admin/stats", response_model=AdminStatsResponse, summary="管理员仪表盘统计", tags=["admin"])
async def admin_get_stats(admin_user: User = Depends(get_current_admin)):
    """
    获取系统统计数据（仅 admin 可访问）。

    返回用户总数、活跃监控数、总搜索次数、调度器状态、最后运行时间。
    """
    with Session(engine) as session:
        total_users = len(session.exec(select(User)).all())
        active_monitors = len(
            session.exec(
                select(MonitorTask).where(
                    MonitorTask.status == "active",
                    MonitorTask.is_deleted == False,
                )
            ).all()
        )
        # 真实搜索计数：统计 PriceHistory 总记录数（每次搜索/调度器检查都会写入）
        total_searches = len(session.exec(select(PriceHistory)).all())

    # 调度器状态
    scheduler_running = _scheduler is not None and _scheduler.running if _scheduler else False
    scheduler_status = "Running" if scheduler_running else "Stopped"
    last_run_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')

    return AdminStatsResponse(
        total_users=total_users,
        active_monitors=active_monitors,
        total_searches=total_searches,  # 真实数据：从 PriceHistory 表统计
        scheduler_status=scheduler_status,
        last_run_time=last_run_time,
    )


@router.get("/api/v1/admin/users", response_model=List[AdminUserResponse], summary="获取所有用户列表", tags=["admin"])
async def admin_get_users(admin_user: User = Depends(get_current_admin)):
    """
    获取系统所有用户列表（仅 admin 可访问）。

    按 ID 倒序排列，返回 id, email, role, credits, created_at。
    """
    with Session(engine) as session:
        users = session.exec(select(User).order_by(User.id.desc())).all()
        return [
            AdminUserResponse(
                id=u.id,
                email=u.email,
                role=u.role,
                credits=u.credits,
                created_at=u.created_at,
            )
            for u in users
        ]


@router.get(
    "/api/v1/admin/users/{user_id}/transactions",
    response_model=List[TransactionHistoryResponse],
    summary="管理员查看指定用户积分流水",
    tags=["admin"],
)
async def admin_get_user_transactions(
    user_id: int,
    limit: int = 100,
    offset: int = 0,
    admin_user: User = Depends(get_current_admin),
):
    """管理员按时间倒序查看指定用户的积分流水。"""
    safe_limit = max(1, min(limit, 500))
    safe_offset = max(0, offset)

    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User #{user_id} not found")

        records = session.exec(
            select(TransactionHistory)
            .where(TransactionHistory.user_id == user_id)
            .order_by(TransactionHistory.id.desc())
            .offset(safe_offset)
            .limit(safe_limit)
        ).all()
        return [TransactionHistoryResponse(**record.model_dump()) for record in records]


@router.get("/api/v1/admin/monitors", response_model=List[AdminMonitorResponse], summary="获取所有用户的监控任务", tags=["admin"])
async def admin_get_all_monitors(admin_user: User = Depends(get_current_admin)):
    """
    获取系统中所有用户的监控任务列表（仅 admin 可访问）。

    通过 JOIN User 表获取 user_email，按 ID 倒序排列。
    """
    with Session(engine) as session:
        tasks = session.exec(select(MonitorTask).order_by(MonitorTask.id.desc())).all()
        # 批量获取关联用户邮箱
        user_ids = list({t.user_id for t in tasks if t.user_id is not None})
        users_map: dict[int, str] = {}
        if user_ids:
            users = session.exec(select(User).where(User.id.in_(user_ids))).all()
            users_map = {u.id: u.email for u in users}

        return [
            AdminMonitorResponse(
                id=t.id,
                user_id=t.user_id,
                user_email=users_map.get(t.user_id, "unknown") if t.user_id else "N/A",
                origin=t.origin,
                destination=t.destination,
                start_date=t.start_date,
                days=t.days,
                cabin_class=t.cabin_class,
                status=t.status,
                current_price=t.current_price,
                lowest_price=t.lowest_price,
                target_price=t.target_price,
                trip_type=t.trip_type,
                created_at=t.created_at,
                last_checked_at=t.last_checked_at,
            )
            for t in tasks
        ]


@router.delete("/api/v1/admin/users/{user_id}", status_code=204, summary="删除用户及其所有数据", tags=["admin"])
async def admin_delete_user(user_id: int, admin_user: User = Depends(get_current_admin)):
    """
    管理员删除指定用户及其所有关联数据（仅 admin 可访问）。

    级联删除顺序：
    1. 该用户所有监控任务的价格历史 (PriceHistory)
    2. 该用户所有监控任务 (MonitorTask)
    3. 该用户的密码重置记录 (PasswordReset)
    4. 用户本身 (User)

    不允许删除自己（防止 admin 误删自己）。
    """
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User #{user_id} not found")

        # 1. 删除该用户所有监控任务的价格历史
        user_tasks = session.exec(
            select(MonitorTask).where(MonitorTask.user_id == user_id)
        ).all()
        for task in user_tasks:
            histories = session.exec(
                select(PriceHistory).where(PriceHistory.monitor_id == task.id)
            ).all()
            for h in histories:
                session.delete(h)

        # 2. 删除该用户所有监控任务
        for task in user_tasks:
            session.delete(task)

        # 3. 删除该用户的密码重置记录
        reset_records = session.exec(
            select(PasswordReset).where(PasswordReset.email == user.email)
        ).all()
        for r in reset_records:
            session.delete(r)

        # 4. 删除该用户的交易流水
        transaction_records = session.exec(
            select(TransactionHistory).where(TransactionHistory.user_id == user_id)
        ).all()
        for record in transaction_records:
            session.delete(record)

        # 5. 删除用户
        session.delete(user)
        session.commit()

        logger.info(
            f"🗑️ Admin #{admin_user.id} deleted User #{user_id} ({user.email}) "
            f"and {len(user_tasks)} monitor(s)"
        )

    return None


@router.post(
    "/api/v1/admin/users/{user_id}/credits",
    response_model=AdminCreditAdjustResponse,
    summary="管理员调整用户积分",
    tags=["admin"],
)
async def admin_adjust_user_credits(
    user_id: int,
    request: AdminCreditAdjustRequest,
    admin_user: User = Depends(get_current_admin),
):
    """
    管理员直接调整指定用户的积分余额（仅 admin 可访问）。

    amount 为正数时增加积分，为负数时扣除积分（不会低于 0）。
    """
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User #{user_id} not found")
        credits_before = user.credits
        user.credits = max(0, user.credits + request.amount)
        session.add(user)
        session.commit()
        session.refresh(user)
        actual_delta = user.credits - credits_before
        _record_transaction(
            user_id=user.id,
            transaction_type="system_adjustment",
            amount=actual_delta,
            credits_before=credits_before,
            credits_after=user.credits,
            description="Admin credit adjustment",
            reference_type="admin_adjustment",
            reference_id=str(admin_user.id),
            operator_user_id=admin_user.id,
        )
        logger.info(
            f"🔧 Admin #{admin_user.id} adjusted User #{user_id} credits: "
            f"{credits_before} → {user.credits} (delta: {request.amount})"
        )
        return AdminCreditAdjustResponse(
            user_id=user.id,
            email=user.email,
            credits_before=credits_before,
            credits_after=user.credits,
            amount_adjusted=request.amount,
        )


# ============================================================================
# API 端点：机场管理（Admin Only）
# ============================================================================


@router.get(
    "/api/v1/admin/airports",
    response_model=AdminAirportListResponse,
    summary="机场列表（分页 + 搜索）",
    tags=["admin-airports"],
)
async def admin_list_airports(
    page: int = FastQuery(default=1, ge=1),
    page_size: int = FastQuery(default=50, ge=10, le=200),
    q: str = FastQuery(default="", max_length=50, description="搜索关键词"),
    show_disabled: bool = FastQuery(default=True, description="是否显示已禁用的机场"),
    admin_user: User = Depends(get_current_admin),
):
    """分页获取机场列表，支持关键词搜索。"""
    from sqlalchemy import or_

    with Session(engine) as session:
        base = select(Airport)
        count_base = select(func.count()).select_from(Airport)

        filters = []
        if not show_disabled:
            filters.append(Airport.is_disabled == False)
        if q.strip():
            keyword = q.strip().upper()
            search_filter = or_(
                func.upper(Airport.iata_code).like(f"%{keyword}%"),
                func.upper(Airport.municipality).like(f"%{keyword}%"),
                func.upper(Airport.name).like(f"%{keyword}%"),
                func.upper(Airport.iso_country).like(f"%{keyword}%"),
            )
            filters.append(search_filter)

        if filters:
            base = base.where(*filters)
            count_base = count_base.where(*filters)

        total = session.exec(count_base).one()
        offset = (page - 1) * page_size
        airports = session.exec(
            base.order_by(Airport.iata_code.asc()).offset(offset).limit(page_size)
        ).all()

        return AdminAirportListResponse(
            items=[
                AdminAirportResponse(
                    id=a.id, iata_code=a.iata_code, icao_code=a.icao_code,
                    name=a.name, municipality=a.municipality,
                    iso_country=a.iso_country, iso_region=a.iso_region,
                    airport_type=a.airport_type,
                    latitude=a.latitude, longitude=a.longitude,
                    is_disabled=a.is_disabled,
                )
                for a in airports
            ],
            total=total,
            page=page,
            page_size=page_size,
        )


@router.post(
    "/api/v1/admin/airports",
    response_model=AdminAirportResponse,
    status_code=201,
    summary="手动添加机场",
    tags=["admin-airports"],
)
async def admin_create_airport(
    request: AdminAirportCreateRequest,
    admin_user: User = Depends(get_current_admin),
):
    """手动添加新机场，IATA 代码不可重复。"""
    iata = request.iata_code.strip().upper()
    with Session(engine) as session:
        existing = session.exec(
            select(Airport).where(Airport.iata_code == iata)
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"IATA '{iata}' already exists (id={existing.id})")

        airport = Airport(
            iata_code=iata,
            icao_code=request.icao_code.strip().upper() if request.icao_code else None,
            name=request.name.strip(),
            municipality=request.municipality.strip() if request.municipality else None,
            iso_country=request.iso_country.strip().upper(),
            iso_region=request.iso_region.strip() if request.iso_region else None,
            airport_type=request.airport_type,
            latitude=request.latitude,
            longitude=request.longitude,
        )
        session.add(airport)
        session.commit()
        session.refresh(airport)
        logger.info(f"✈️ Admin #{admin_user.id} added airport {iata} ({airport.name})")

        return AdminAirportResponse(
            id=airport.id, iata_code=airport.iata_code, icao_code=airport.icao_code,
            name=airport.name, municipality=airport.municipality,
            iso_country=airport.iso_country, iso_region=airport.iso_region,
            airport_type=airport.airport_type,
            latitude=airport.latitude, longitude=airport.longitude,
            is_disabled=airport.is_disabled,
        )


@router.put(
    "/api/v1/admin/airports/{airport_id}",
    response_model=AdminAirportResponse,
    summary="编辑机场信息",
    tags=["admin-airports"],
)
async def admin_update_airport(
    airport_id: int,
    request: AdminAirportUpdateRequest,
    admin_user: User = Depends(get_current_admin),
):
    """编辑机场信息，只更新非 None 字段。不支持删除，只能禁用。"""
    with Session(engine) as session:
        airport = session.get(Airport, airport_id)
        if not airport:
            raise HTTPException(status_code=404, detail=f"Airport #{airport_id} not found")

        if request.iata_code is not None:
            new_iata = request.iata_code.strip().upper()
            if new_iata != airport.iata_code:
                conflict = session.exec(
                    select(Airport).where(Airport.iata_code == new_iata)
                ).first()
                if conflict:
                    raise HTTPException(status_code=409, detail=f"IATA '{new_iata}' already exists")
                airport.iata_code = new_iata

        if request.icao_code is not None:
            airport.icao_code = request.icao_code.strip().upper() or None
        if request.name is not None:
            airport.name = request.name.strip()
        if request.municipality is not None:
            airport.municipality = request.municipality.strip() or None
        if request.iso_country is not None:
            airport.iso_country = request.iso_country.strip().upper()
        if request.iso_region is not None:
            airport.iso_region = request.iso_region.strip() or None
        if request.airport_type is not None:
            airport.airport_type = request.airport_type
        if request.latitude is not None:
            airport.latitude = request.latitude
        if request.longitude is not None:
            airport.longitude = request.longitude
        if request.is_disabled is not None:
            airport.is_disabled = request.is_disabled

        session.add(airport)
        session.commit()
        session.refresh(airport)
        logger.info(f"✏️ Admin #{admin_user.id} updated airport #{airport_id} ({airport.iata_code})")

        return AdminAirportResponse(
            id=airport.id, iata_code=airport.iata_code, icao_code=airport.icao_code,
            name=airport.name, municipality=airport.municipality,
            iso_country=airport.iso_country, iso_region=airport.iso_region,
            airport_type=airport.airport_type,
            latitude=airport.latitude, longitude=airport.longitude,
            is_disabled=airport.is_disabled,
        )


@router.post(
    "/api/v1/admin/airports/upload-csv",
    response_model=AdminAirportCsvUploadResponse,
    summary="上传 CSV 文件合并机场数据",
    tags=["admin-airports"],
)
async def admin_upload_airports_csv(
    file: UploadFile = File(..., description="airports.csv 文件"),
    admin_user: User = Depends(get_current_admin),
):
    """
    上传 CSV 文件，将不重复数据合并到数据库。
    已有的数据（按 iata_code 判断）不会被删除或覆盖。
    上传后会在 backend/data/backups/ 目录保存本地备份。
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    contents = await file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        text = contents.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))

    airports_to_add = []
    skipped_no_iata = 0
    for row in reader:
        iata = row.get("iata_code", "").strip()
        if not iata:
            skipped_no_iata += 1
            continue
        airports_to_add.append({
            "iata_code": iata.upper(),
            "icao_code": row.get("icao_code", "").strip() or None,
            "name": row.get("name", "").strip(),
            "municipality": row.get("municipality", "").strip() or None,
            "iso_country": row.get("iso_country", "").strip(),
            "iso_region": row.get("iso_region", "").strip() or None,
            "airport_type": row.get("type", "").strip() or "medium_airport",
            "latitude": float(row["latitude_deg"]) if row.get("latitude_deg", "").strip() else None,
            "longitude": float(row["longitude_deg"]) if row.get("longitude_deg", "").strip() else None,
        })

    total_parsed = len(airports_to_add)
    inserted = 0
    skipped_existing = 0

    with Session(engine) as session:
        existing_iata = {
            a.iata_code
            for a in session.exec(select(Airport.iata_code)).all()
        }

        for ap_data in airports_to_add:
            if ap_data["iata_code"] in existing_iata:
                skipped_existing += 1
                continue
            session.add(Airport(**ap_data))
            existing_iata.add(ap_data["iata_code"])
            inserted += 1

        session.commit()

    # 本地备份
    backup_path = None
    try:
        os.makedirs(AIRPORT_CSV_BACKUP_DIR, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"airports_{timestamp}.csv"
        backup_path = os.path.join(AIRPORT_CSV_BACKUP_DIR, backup_filename)
        with open(backup_path, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        logger.info(f"📁 CSV 备份已保存: {backup_path}")
    except Exception as e:
        logger.warning(f"⚠️ CSV 备份失败: {e}")
        backup_path = None

    logger.info(
        f"📤 Admin #{admin_user.id} uploaded CSV: "
        f"parsed={total_parsed}, inserted={inserted}, skipped_existing={skipped_existing}, no_iata={skipped_no_iata}"
    )

    return AdminAirportCsvUploadResponse(
        total_parsed=total_parsed,
        inserted=inserted,
        skipped_existing=skipped_existing,
        skipped_no_iata=skipped_no_iata,
        backup_path=backup_filename if backup_path else None,
    )


