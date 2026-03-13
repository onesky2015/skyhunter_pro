from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session, select
from datetime import datetime, date, timedelta
from typing import List, Optional
from uuid import uuid4
import math
from db import engine
from models.database import User, MonitorTask, TransactionHistory, FlightCache, PriceHistory, MonitorActivityLog, Airport, utc_iso_now
from schemas.api_models import *
from api.deps import get_current_user
from config import logger, USE_MOCK_DATA
from services.flight import _search_range, _build_flight_cache_signature, _classify_heatmap_levels, _search_serpapi_single_day, _generate_mock_heatmap, _generate_mock_flight_detail
from services.billing import _record_transaction, _refund_user_credits
from services.scheduler import _monitor_response_from_task
from services.email import send_alert_email

router = APIRouter()


# ============================================================================
# API 端点：机场搜索（公开，无需认证）
# ============================================================================

from fastapi import Query as FastQuery
from sqlalchemy import or_, func, case


@router.get("/api/v1/airports/search", response_model=List[AirportSearchResult], summary="机场自动补全搜索", tags=["airports"])
async def search_airports(
    q: str = FastQuery(..., min_length=1, max_length=50, description="搜索关键词：IATA代码、城市名或机场名称"),
    limit: int = FastQuery(default=10, ge=1, le=30, description="返回结果数量上限"),
):
    """根据 IATA 代码、城市名或机场名称模糊搜索机场。"""
    keyword = q.strip().upper()
    if not keyword:
        return []

    type_priority = case(
        (Airport.airport_type == "large_airport", 0),
        (Airport.airport_type == "medium_airport", 1),
        (Airport.airport_type == "small_airport", 2),
        else_=3,
    )

    with Session(engine) as session:
        stmt = (
            select(Airport)
            .where(
                Airport.is_disabled == False,
                or_(
                    func.upper(Airport.iata_code).like(f"{keyword}%"),
                    func.upper(Airport.municipality).like(f"%{keyword}%"),
                    func.upper(Airport.name).like(f"%{keyword}%"),
                ),
            )
            .order_by(
                (func.upper(Airport.iata_code) == keyword).desc(),
                type_priority,
            )
            .limit(limit)
        )
        results = session.exec(stmt).all()

    return [
        AirportSearchResult(
            iata_code=ap.iata_code,
            name=ap.name,
            municipality=ap.municipality,
            iso_country=ap.iso_country,
            airport_type=ap.airport_type,
        )
        for ap in results
    ]


# ============================================================================
# API 端点：一次性搜索（需要认证）
# ============================================================================


@router.post("/api/v1/search", response_model=SearchResponse, summary="30天热力图搜索", tags=["search"])
async def search_flights(request: SearchRequest, current_user: User = Depends(get_current_user)):
    """一次性航班价格热力图搜索（不存入数据库），需要登录。"""
    search_id = str(uuid4())[:8]
    origin = request.origin.upper()
    destination = request.destination.upper()

    if origin == destination:
        raise HTTPException(status_code=400, detail="出发地和目的地不能相同")
    try:
        start_date_obj = date.fromisoformat(request.start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"日期格式无效: '{request.start_date}'")
    if start_date_obj < date.today():
        raise HTTPException(status_code=400, detail="起始日期不能早于今天")

    valid_cabins = ["economy", "premium_economy", "business", "first"]
    if request.cabin_class not in valid_cabins:
        raise HTTPException(status_code=400, detail=f"无效舱位: '{request.cabin_class}'")
    valid_trip_types = ["one_way", "round_trip"]
    if request.trip_type not in valid_trip_types:
        raise HTTPException(status_code=400, detail=f"无效行程类型: '{request.trip_type}'")

    return_date_obj = None
    if request.trip_type == "round_trip":
        if not request.return_date:
            raise HTTPException(status_code=400, detail="往返航班必须指定返程日期")
        try:
            return_date_obj = date.fromisoformat(request.return_date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"返程日期格式无效")
        if return_date_obj <= start_date_obj:
            raise HTTPException(status_code=400, detail="返程日期必须晚于出发日期")

    # ── 积分检查 & 扣除：分级定价（单日 1 积分，多日 5 积分） ──
    search_cost = 1 if request.days == 1 else 5
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user or user.credits < search_cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. This search costs {search_cost} credit(s). You have {user.credits if user else 0}. Please top up.",
            )
        credits_before = user.credits
        user.credits -= search_cost
        session.add(user)
        session.commit()
        session.refresh(user)
        _record_transaction(
            user_id=user.id,
            transaction_type="consumption",
            amount=-search_cost,
            credits_before=credits_before,
            credits_after=user.credits,
            description=f"Flight search charge ({origin}->{destination}, {request.days} day(s))",
            reference_type="search",
            reference_id=search_id,
        )
        logger.info(f"💳 User #{current_user.id} 搜索扣除 {search_cost} 积分，剩余: {user.credits}")

    logger.info(f"🔍 [{search_id}] User #{current_user.id} 搜索: {origin}->{destination}")

    try:
        range_results = _search_range(
            origin, destination, start_date_obj, request.days,
            request.cabin_class, request.adults, request.children, request.max_stops,
            request.departure_time_min, request.departure_time_max, request.sort_strategy,
            request.arrival_time_min, request.arrival_time_max, request.airline_include,
            request.excluded_airlines, return_date_obj,
        )
        raw_data = [{"date": r["date"], "price": r["price"]} for r in range_results]
        data_source = "mock" if USE_MOCK_DATA else "serpapi"

        return_raw_data = []
        if request.trip_type == "round_trip" and return_date_obj:
            return_range_results = _search_range(
                destination, origin, return_date_obj, request.days,
                request.cabin_class, request.adults, request.children, request.max_stops,
                request.departure_time_min, request.departure_time_max, request.sort_strategy,
                request.arrival_time_min, request.arrival_time_max, request.airline_include,
                request.excluded_airlines, None,
            )
            return_raw_data = [{"date": r["date"], "price": r["price"]} for r in return_range_results]
    except Exception as e:
        _refund_user_credits(current_user.id, search_cost, f"search_failed:{search_id}")
        logger.error(f"❌ [{search_id}] 搜索异常: {e}")
        raise HTTPException(status_code=500, detail=f"搜索服务不可用: {str(e)}")

    heatmap_data = _classify_heatmap_levels(raw_data)
    valid_prices = [c.price for c in heatmap_data if c.price is not None]
    lowest_price = lowest_price_date = average_price = highest_price = None
    best_flight = None
    if valid_prices:
        lowest_price = min(valid_prices)
        highest_price = max(valid_prices)
        average_price = round(sum(valid_prices) / len(valid_prices), 2)
        for cell in heatmap_data:
            if cell.price == lowest_price:
                lowest_price_date = cell.date
                break
        for r in range_results:
            if r["price"] == lowest_price and r.get("flight_data"):
                fd = r["flight_data"]
                if isinstance(fd, dict):
                    best_flight = FlightDetail(**{k: fd.get(k) for k in FlightDetail.model_fields})
                break

    return_heatmap_data = []
    return_lowest_price = return_lowest_price_date = None
    if return_raw_data:
        return_heatmap_data = _classify_heatmap_levels(return_raw_data)
        return_valid = [c.price for c in return_heatmap_data if c.price is not None]
        if return_valid:
            return_lowest_price = min(return_valid)
            for cell in return_heatmap_data:
                if cell.price == return_lowest_price:
                    return_lowest_price_date = cell.date
                    break

    return SearchResponse(
        search_id=search_id, origin=origin, destination=destination,
        start_date=request.start_date, days=request.days, cabin_class=request.cabin_class,
        lowest_price=lowest_price, lowest_price_date=lowest_price_date,
        average_price=average_price, highest_price=highest_price,
        heatmap_data=heatmap_data, best_flight=best_flight,
        data_source=data_source, searched_at=utc_iso_now(),
        trip_type=request.trip_type, return_date=request.return_date,
        return_lowest_price=return_lowest_price,
        return_lowest_price_date=return_lowest_price_date,
        return_heatmap_data=return_heatmap_data,
    )


# ============================================================================
# API 端点：询价系统（Quote）
# ============================================================================


class QuoteSearchRequest(BaseModel):
    """搜索询价请求"""
    days: int = Field(default=30, ge=1, le=60, description="搜索天数")


class QuoteSearchResponse(BaseModel):
    """搜索询价响应"""
    cost: int = Field(description="本次搜索消耗的积分数")
    currency: str = Field(default="credits", description="积分单位")
    user_credits: int = Field(description="用户当前积分余额")
    sufficient: bool = Field(description="余额是否充足")


@router.post("/api/v1/quote/search", response_model=QuoteSearchResponse, summary="搜索费用询价", tags=["quote"])
async def quote_search(request: QuoteSearchRequest, current_user: User = Depends(get_current_user)):
    """
    查询一次搜索操作的积分费用（不实际扣费）。

    分级定价逻辑：
    - days == 1：单日搜索，cost = 1 积分
    - days > 1 ：多日热力图（情报分析服务），cost = 5 积分

    前端应在执行搜索前调用此接口，并在 UI 弹窗中展示真实费用让用户确认。
    """
    cost = 1 if request.days == 1 else 5  # 分级定价：单日 1 积分，多日情报分析 5 积分
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        user_credits = user.credits if user else 0
    return QuoteSearchResponse(
        cost=cost,
        currency="credits",
        user_credits=user_credits,
        sufficient=user_credits >= cost,
    )


# ============================================================================
# API 端点：监控任务 CRUD（数据隔离）
# ============================================================================


@router.post("/api/v1/monitors", response_model=MonitorResponse, status_code=201, summary="创建监控任务", tags=["monitors"])
async def create_monitor(request: MonitorCreateRequest, current_user: User = Depends(get_current_user)):
    """创建持久化监控任务，自动绑定当前用户。"""
    origin = request.origin.upper()
    destination = request.destination.upper()

    if origin == destination:
        raise HTTPException(status_code=400, detail="出发地和目的地不能相同")
    try:
        start_date_obj = date.fromisoformat(request.start_date)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"日期格式无效: '{request.start_date}'")
    if start_date_obj < date.today():
        raise HTTPException(status_code=400, detail="起始日期不能早于今天")

    valid_trip_types = ["one_way", "round_trip"]
    if request.trip_type not in valid_trip_types:
        raise HTTPException(status_code=400, detail=f"无效行程类型: '{request.trip_type}'")

    return_date_obj = None
    if request.trip_type == "round_trip":
        if not request.return_date:
            raise HTTPException(status_code=400, detail="往返航班必须指定返程日期")
        try:
            return_date_obj = date.fromisoformat(request.return_date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"返程日期格式无效")
        if return_date_obj <= start_date_obj:
            raise HTTPException(status_code=400, detail="返程日期必须晚于出发日期")

    # Phase 2: 动态计费 — ceil((duration_days * 24 * 60 / interval_minutes) * 0.1)
    total_minutes = request.duration_days * 24 * 60
    estimated_cost = max(1, math.ceil((total_minutes / request.interval_minutes) * 0.1))

    # 积分检查：余额不足时返回 402
    with Session(engine) as session:
        user = session.get(User, current_user.id)
        if not user or user.credits < estimated_cost:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required: {estimated_cost}, Available: {user.credits if user else 0}. Please top up.",
            )
        # 扣除动态积分
        credits_before = user.credits
        user.credits -= estimated_cost
        session.add(user)
        session.commit()
        session.refresh(user)
        _record_transaction(
            user_id=user.id,
            transaction_type="consumption",
            amount=-estimated_cost,
            credits_before=credits_before,
            credits_after=user.credits,
            description=(
                f"Monitor creation charge ({request.origin}->{request.destination}, "
                f"interval={request.interval_minutes}m, duration={request.duration_days}d)"
            ),
            reference_type="monitor_create",
            reference_id=f"{request.origin}-{request.destination}-{request.start_date}",
        )
        logger.info(f"💳 User #{current_user.id} 扣除 {estimated_cost} 积分（频率={request.interval_minutes}m, 时长={request.duration_days}d），剩余: {user.credits}")

    # Phase 2: 计算 end_date；next_run_time 设为 None 以便调度器在下次心跳（5 分钟内）立即执行首次检查
    now_utc = datetime.utcnow()
    now_iso = utc_iso_now()
    end_date_dt = now_utc + timedelta(days=request.duration_days)
    end_date_iso = end_date_dt.strftime('%Y-%m-%dT%H:%M:%S.%fZ')

    # 创建任务（绑定 user_id）
    task = MonitorTask(
        user_id=current_user.id,
        origin=origin, destination=destination,
        start_date=request.start_date, days=request.days,
        cabin_class=request.cabin_class, adults=request.adults, children=request.children,
        target_price=request.target_price, notification_email=request.notification_email,
        max_stops=request.max_stops, departure_time_min=request.departure_time_min,
        departure_time_max=request.departure_time_max, sort_strategy=request.sort_strategy,
        trip_type=request.trip_type, return_date=request.return_date,
        arrival_time_min=request.arrival_time_min, arrival_time_max=request.arrival_time_max,
        airline_include=request.airline_include, excluded_airlines=request.excluded_airlines,
        status="active", created_at=now_iso,
        # Phase 2 新字段：next_run_time=None 确保首次调度在 5 分钟内执行
        interval_minutes=request.interval_minutes,
        end_date=end_date_iso,
        next_run_time=None,
        total_credits_deducted=estimated_cost,
    )

    task_id = None
    try:
        with Session(engine) as session:
            session.add(task)
            session.commit()
            session.refresh(task)
            task_id = task.id
            session.add(MonitorActivityLog(
                monitor_id=task_id,
                event_type="created",
                event_at=utc_iso_now(),
                new_status="active",
            ))
            session.commit()
            logger.info(f"✅ User #{current_user.id} 创建监控 #{task_id}: {origin}->{destination}")
    except Exception as create_err:
        _refund_user_credits(current_user.id, estimated_cost, "monitor_create_failed")
        logger.error(f"❌ 创建监控失败，已退款: {create_err}")
        raise HTTPException(status_code=500, detail="创建监控任务失败，已自动退款")

    # 立即执行初始搜索
    try:
        check_date = start_date_obj
        if USE_MOCK_DATA:
            mock_data = _generate_mock_heatmap(origin, destination, check_date, 1, request.cabin_class)
            if mock_data and mock_data[0]["price"] is not None:
                initial_price = mock_data[0]["price"]
                if return_date_obj:
                    return_mock = _generate_mock_heatmap(destination, origin, return_date_obj, 1, request.cabin_class)
                    if return_mock and return_mock[0]["price"] is not None:
                        initial_price += return_mock[0]["price"]
                mock_flight = _generate_mock_flight_detail(
                    origin, destination, request.start_date, initial_price,
                    max_stops=request.max_stops, departure_time_min=request.departure_time_min,
                    departure_time_max=request.departure_time_max, arrival_time_min=request.arrival_time_min,
                    arrival_time_max=request.arrival_time_max, airline_include=request.airline_include,
                )
                flight_info = mock_flight.model_dump()
            else:
                initial_price = None
                flight_info = None
        else:
            result = _search_serpapi_single_day(
                origin, destination, check_date, request.cabin_class,
                request.adults, request.children, request.max_stops,
                request.departure_time_min, request.departure_time_max,
                request.sort_strategy, request.arrival_time_min,
                request.arrival_time_max, request.airline_include, request.excluded_airlines,
                return_date_obj,
                bypass_cache=True,
            )
            if result:
                initial_price = result["price"]
                flight_info = result
            else:
                initial_price = None
                flight_info = None

        with Session(engine) as session:
            db_task = session.get(MonitorTask, task_id)
            if db_task and initial_price is not None:
                db_task.current_price = initial_price
                db_task.lowest_price = initial_price
                db_task.lowest_price_date = check_date.isoformat()
                db_task.last_checked_at = utc_iso_now()
                if flight_info:
                    db_task.booking_link = flight_info.get("booking_link")
                    db_task.airline = flight_info.get("airline")
                    db_task.flight_number = flight_info.get("flight_number")
                    db_task.baggage_info = flight_info.get("baggage_info")
                # 首次创建时写入“当前监控价”，后续由调度器仅在发现更低价时更新。
                ph = PriceHistory(
                    monitor_id=task_id, price=initial_price,
                    booking_link=flight_info.get("booking_link") if flight_info else None,
                )
                session.add(ph)
                session.add(db_task)
                session.commit()
                session.refresh(db_task)
    except Exception as e:
        logger.warning(f"  ⚠️ 初始搜索失败: {e}")

    with Session(engine) as session:
        final_task = session.get(MonitorTask, task_id)
        return _monitor_response_from_task(final_task)


@router.get("/api/v1/monitors", response_model=List[MonitorResponse], summary="获取当前用户的监控任务", tags=["monitors"])
async def get_monitors(
    include_archived: bool = False,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的监控任务（数据隔离，排除已软删除的，支持分页）"""
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    logger.info(f"🔍 [get_monitors] User #{current_user.id} requesting monitors (archived={include_archived})")
    with Session(engine) as session:
        statement = (
            select(MonitorTask)
            .where(MonitorTask.user_id == current_user.id)
            .where(MonitorTask.is_deleted == False)
        )
        if not include_archived:
            statement = statement.where(MonitorTask.status != "archived")
        statement = statement.order_by(MonitorTask.id.desc()).offset(safe_offset).limit(safe_limit)
        tasks = session.exec(statement).all()
        logger.info(f"  ✅ [get_monitors] Query finished. User ID: {current_user.id}, Tasks found: {len(tasks)}")
        if len(tasks) == 0:
             # 再查一遍全部，看是不是 user_id 对不上
             all_count = session.exec(select(MonitorTask)).all()
             logger.info(f"  🚨 [DEBUG] Global match: Total tasks in DB is {len(all_count)}")
        return [_monitor_response_from_task(t) for t in tasks]


@router.delete("/api/v1/monitors/{monitor_id}", status_code=204, summary="软删除监控任务", tags=["monitors"])
async def delete_monitor(monitor_id: int, current_user: User = Depends(get_current_user)):
    """
    软删除指定的监控任务（只能删除自己的）。

    不会物理删除数据，而是将 is_deleted 标记为 True。
    可通过 POST /api/v1/monitors/{id}/restore 恢复。
    """
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        # 数据隔离：确保只能删除自己的任务
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权删除其他用户的任务")
        if task.is_deleted:
            raise HTTPException(status_code=400, detail=f"任务 #{monitor_id} 已在回收站中")
        task.is_deleted = True
        task.status = "paused"  # 软删除后暂停调度
        session.add(task)
        session.commit()
        logger.info(f"🗑️ User #{current_user.id} 软删除任务 #{monitor_id}")
    return None


@router.get("/api/v1/monitors/trash", response_model=List[MonitorResponse], summary="获取回收站中的监控任务", tags=["monitors"])
async def get_trash_monitors(current_user: User = Depends(get_current_user)):
    """
    获取当前用户已软删除的监控任务列表（回收站）。

    仅返回 is_deleted == True 的任务，按 ID 倒序排列。
    """
    with Session(engine) as session:
        statement = (
            select(MonitorTask)
            .where(MonitorTask.user_id == current_user.id)
            .where(MonitorTask.is_deleted == True)
            .order_by(MonitorTask.id.desc())
        )
        tasks = session.exec(statement).all()
        return [_monitor_response_from_task(t) for t in tasks]


@router.post("/api/v1/monitors/{monitor_id}/restore", response_model=MonitorResponse, summary="恢复已删除的监控任务", tags=["monitors"])
async def restore_monitor(monitor_id: int, current_user: User = Depends(get_current_user)):
    """
    从回收站恢复指定的监控任务。

    将 is_deleted 设为 False，状态恢复为 'active'。
    只能恢复自己的任务。
    """
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权恢复其他用户的任务")
        if not task.is_deleted:
            raise HTTPException(status_code=400, detail=f"任务 #{monitor_id} 未被删除，无需恢复")
        task.is_deleted = False
        task.status = "active"
        session.add(task)
        session.commit()
        session.refresh(task)
        logger.info(f"♻️ User #{current_user.id} 恢复任务 #{monitor_id}")
        return _monitor_response_from_task(task)


class MonitorUpdateRequest(BaseModel):
    """编辑监控任务请求（Phase 2: 含频率修改 & 延长天数）"""
    target_price: Optional[float] = Field(default=None, gt=0, description="新目标价格 USD")
    notification_email: Optional[str] = Field(default=None, description="新通知邮箱")
    start_date: Optional[str] = Field(default=None, description="新出发日期 YYYY-MM-DD")
    return_date: Optional[str] = Field(default=None, description="新返程日期 YYYY-MM-DD")
    interval_minutes: Optional[int] = Field(default=None, ge=10, le=1440, description="新检查频率（分钟）")
    excluded_airlines: Optional[str] = Field(default=None, description="排除航司代码，逗号分隔")
    extend_days: Optional[int] = Field(default=None, ge=1, le=30, description="延长监控天数（在当前 end_date 基础上追加）")


@router.put("/api/v1/monitors/{monitor_id}", response_model=MonitorResponse, summary="编辑监控任务", tags=["monitors"])
async def update_monitor(monitor_id: int, request: MonitorUpdateRequest, current_user: User = Depends(get_current_user)):
    """
    编辑指定的监控任务（只能编辑自己的、未删除的任务）。

    可更新字段：target_price, notification_email, start_date, return_date。
    如果 start_date 或 return_date 发生变化，将自动重置：
    - status → 'active'
    - current_price → None
    - lowest_price → None
    - lowest_price_date → None
    """
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权编辑其他用户的任务")
        if task.is_deleted:
            raise HTTPException(status_code=400, detail=f"任务 #{monitor_id} 已被删除，请先恢复")

        dates_changed = False

        # 更新 target_price（传入即更新）
        if request.target_price is not None:
            task.target_price = request.target_price

        # 更新 notification_email（传入即更新，允许空字符串清除）
        if request.notification_email is not None:
            task.notification_email = request.notification_email if request.notification_email.strip() else None

        # 更新 start_date
        if request.start_date is not None:
            try:
                new_start = date.fromisoformat(request.start_date)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"出发日期格式无效: '{request.start_date}'")
            if new_start < date.today():
                raise HTTPException(status_code=400, detail="出发日期不能早于今天")
            if task.start_date != request.start_date:
                task.start_date = request.start_date
                dates_changed = True

        # 更新 return_date
        if request.return_date is not None:
            if task.trip_type != "round_trip":
                raise HTTPException(status_code=400, detail="单程航班无法设置返程日期")
            try:
                new_return = date.fromisoformat(request.return_date)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"返程日期格式无效: '{request.return_date}'")
            # 校验返程日期晚于出发日期
            effective_start = request.start_date if request.start_date else task.start_date
            if new_return <= date.fromisoformat(effective_start):
                raise HTTPException(status_code=400, detail="返程日期必须晚于出发日期")
            if task.return_date != request.return_date:
                task.return_date = request.return_date
                dates_changed = True

        # 更新排除航司
        if request.excluded_airlines is not None:
            task.excluded_airlines = request.excluded_airlines.strip() or None

        # Phase 2: 更新 interval_minutes（频率修改，提高频率时补扣积分）
        if request.interval_minutes is not None:
            valid_intervals = {10, 30, 60, 240, 720, 1440}
            if request.interval_minutes not in valid_intervals:
                raise HTTPException(status_code=400, detail=f"无效频率: {request.interval_minutes}，允许值: {sorted(valid_intervals)}")
            if task.interval_minutes != request.interval_minutes:
                old_interval = task.interval_minutes
                new_interval = request.interval_minutes
                # 提高频率（间隔变小）时需补扣积分
                if new_interval < old_interval and task.end_date:
                    try:
                        end_str = str(task.end_date)[:10]
                        end_date_obj = date.fromisoformat(end_str)
                    except Exception:
                        end_date_obj = None
                    if end_date_obj:
                        remaining_days = max(0, (end_date_obj - date.today()).days)
                        remaining_min = remaining_days * 24 * 60
                        old_cost = max(0, math.ceil((remaining_min / old_interval) * 0.1))
                        new_cost = max(0, math.ceil((remaining_min / new_interval) * 0.1))
                        cost_diff = max(0, new_cost - old_cost)
                        if cost_diff > 0:
                            user = session.get(User, current_user.id)
                            if not user or user.credits < cost_diff:
                                raise HTTPException(
                                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                                    detail=f"Insufficient credits. Required: {cost_diff}, Available: {user.credits if user else 0}. Please top up.",
                                )
                            credits_before = user.credits
                            user.credits -= cost_diff
                            session.add(user)
                            task.total_credits_deducted = (task.total_credits_deducted or 0) + cost_diff
                            _record_transaction(
                                user_id=user.id,
                                transaction_type="consumption",
                                amount=-cost_diff,
                                credits_before=credits_before,
                                credits_after=user.credits,
                                description=f"Monitor #{monitor_id} frequency change {old_interval}m→{new_interval}m",
                                reference_type="monitor_edit",
                                reference_id=f"monitor_{monitor_id}",
                            )
                            logger.info(f"💳 User #{current_user.id} 频率变更补扣 {cost_diff} 积分，剩余: {user.credits}")
                task.interval_minutes = request.interval_minutes
                # 重新计算 next_run_time
                task.next_run_time = (datetime.utcnow() + timedelta(minutes=request.interval_minutes)).strftime('%Y-%m-%dT%H:%M:%S.%fZ')
                logger.info(f"⏱️ 任务 #{monitor_id} 频率变更为 {request.interval_minutes}m")

        # 日期变更时重置价格状态
        if dates_changed:
            task.status = "active"
            task.current_price = None
            task.lowest_price = None
            task.lowest_price_date = None
            task.last_checked_at = None
            task.next_run_time = None  # 立即触发重新检查
            logger.info(f"📅 任务 #{monitor_id} 日期变更，价格状态已重置")

        # target_price 更新后：立即对比当前价，若已满足则直接标记 found 并发邮件
        if request.target_price is not None and not dates_changed:
            new_target = request.target_price
            if task.current_price is not None and task.current_price <= new_target and task.status == "active":
                now_iso = utc_iso_now()
                task.status = "found"
                task.email_notified_at = now_iso
                session.add(MonitorActivityLog(
                    monitor_id=monitor_id, event_type="found",
                    event_at=now_iso, price=task.current_price,
                    previous_status="active", new_status="found",
                ))
                logger.info(
                    f"  🎯 任务 #{monitor_id} 编辑后当前价 ${task.current_price} "
                    f"已满足新目标价 ${new_target}，立即标记 found"
                )
                if task.notification_email:
                    user = session.get(User, current_user.id)
                    recipient_name = user.full_name if user and user.full_name else None
                    try:
                        send_alert_email(
                            to_email=task.notification_email, origin=task.origin,
                            destination=task.destination, price=task.current_price,
                            target_price=new_target, departure_date=task.start_date,
                            link=task.booking_link or "#",
                            adults=task.adults, children=task.children,
                            airline=task.airline, flight_number=task.flight_number,
                            monitor_id=task.id, recipient_name=recipient_name,
                        )
                        logger.info(f"  📧 邮件已发送至 {task.notification_email}")
                    except Exception as mail_err:
                        logger.error(f"  ❌ 邮件发送失败（状态已更新为 found）: {mail_err}")
            elif task.status == "active":
                # 目标价已更新但当前价还未达标，重置 next_run_time 让调度器立即重新检查
                task.next_run_time = None
                logger.info(
                    f"  ♻️ 任务 #{monitor_id} 目标价更新为 ${new_target}，"
                    f"当前价 ${task.current_price}，重置调度立即重检"
                )

        # 延长监控天数：在当前 end_date 基础上追加天数，并按新增天数补扣积分
        if request.extend_days is not None and request.extend_days > 0:
            if task.end_date:
                try:
                    cur_end = date.fromisoformat(str(task.end_date)[:10])
                except Exception:
                    cur_end = date.today()
            else:
                cur_end = date.today()
            new_end = cur_end + timedelta(days=request.extend_days)
            # 按新增天数和当前频率计算需补扣积分（与创建时相同公式）
            extend_minutes = request.extend_days * 24 * 60
            extend_cost = max(1, math.ceil((extend_minutes / (task.interval_minutes or 240)) * 0.1))
            user = session.get(User, current_user.id)
            if not user or user.credits < extend_cost:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=f"Insufficient credits. Required: {extend_cost}, Available: {user.credits if user else 0}. Please top up.",
                )
            credits_before = user.credits
            user.credits -= extend_cost
            session.add(user)
            task.end_date = new_end.isoformat()
            task.total_credits_deducted = (task.total_credits_deducted or 0) + extend_cost
            # 若任务已过期则恢复为 active
            if task.status == "expired":
                task.status = "active"
                task.next_run_time = None
            _record_transaction(
                user_id=user.id,
                transaction_type="consumption",
                amount=-extend_cost,
                credits_before=credits_before,
                credits_after=user.credits,
                description=f"Monitor #{monitor_id} extend {request.extend_days}d (end→{new_end})",
                reference_type="monitor_edit",
                reference_id=f"monitor_{monitor_id}",
            )
            logger.info(
                f"📅 任务 #{monitor_id} 延长 {request.extend_days} 天，"
                f"新 end_date={new_end}，补扣 {extend_cost} 积分，剩余: {user.credits}"
            )

        session.add(task)
        session.commit()
        session.refresh(task)
        logger.info(f"✏️ User #{current_user.id} 编辑任务 #{monitor_id}")
        return _monitor_response_from_task(task)


class MonitorStatusUpdate(BaseModel):
    """暂停/恢复/存档监控任务请求"""
    status: str = Field(..., description="目标状态: 'paused' / 'active' / 'archived'")


@router.patch("/api/v1/monitors/{monitor_id}/status", response_model=MonitorResponse, summary="暂停/恢复/存档监控任务", tags=["monitors"])
async def update_monitor_status(monitor_id: int, request: MonitorStatusUpdate, current_user: User = Depends(get_current_user)):
    """
    暂停、恢复或存档指定的监控任务。

    状态转换规则：
    - active ↔ paused: 自由切换
    - expired/found → archived: 允许存档
    - archived 状态不可再切换回 active/paused
    """
    allowed_statuses = {"paused", "active", "archived"}
    if request.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"无效状态: '{request.status}'，允许: {sorted(allowed_statuses)}")

    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权操作其他用户的任务")

        # Phase 2: 存档逻辑 — 仅允许从 expired/found 转入 archived
        if request.status == "archived":
            if task.status not in ("expired", "found"):
                raise HTTPException(
                    status_code=400,
                    detail=f"只有 'expired' 或 'found' 状态的任务可以存档，当前状态: '{task.status}'"
                )
        elif request.status in ("active", "paused"):
            # active/paused/found 均可切换（found 仍在监控中，允许暂停/恢复）
            if task.status not in ("active", "paused", "found"):
                raise HTTPException(status_code=400, detail=f"任务当前状态为 '{task.status}'，无法切换为 '{request.status}'")

        prev_status = task.status
        task.status = request.status
        # 恢复为 active 时重置 next_run_time，确保调度器在下次心跳立即执行
        if request.status == "active":
            task.next_run_time = None
        evt_type = "resumed" if request.status == "active" else request.status
        session.add(MonitorActivityLog(
            monitor_id=monitor_id, event_type=evt_type,
            event_at=utc_iso_now(),
            previous_status=prev_status, new_status=request.status,
        ))
        session.add(task)
        session.commit()
        session.refresh(task)

        status_icons = {"paused": "⏸️", "active": "▶️", "archived": "📦"}
        status_labels = {"paused": "暂停", "active": "恢复", "archived": "存档"}
        logger.info(f"{status_icons.get(request.status, '❓')} User #{current_user.id} {status_labels.get(request.status, '操作')}任务 #{monitor_id}")
        return _monitor_response_from_task(task)


@router.get("/api/v1/monitors/{monitor_id}/history", summary="获取价格历史", tags=["monitors"])
async def get_price_history(monitor_id: int, limit: int = 50, current_user: User = Depends(get_current_user)):
    """获取指定任务的价格历史记录（只能查看自己的）"""
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权查看其他用户的数据")
        statement = (
            select(PriceHistory)
            .where(PriceHistory.monitor_id == monitor_id)
            .order_by(PriceHistory.id.desc())
            .limit(limit)
        )
        histories = session.exec(statement).all()
        return [{"id": h.id, "price": h.price, "checked_at": h.checked_at, "booking_link": h.booking_link} for h in histories]


@router.get("/api/v1/monitors/{monitor_id}/report", summary="获取任务报告", tags=["monitors"])
async def get_task_report(monitor_id: int, limit: int = 100, current_user: User = Depends(get_current_user)):
    """
    获取任务报告：合并价格检查记录与状态变更（创建、暂停、恢复、达到目标、过期、存档），
    按时间倒序，用于任务报告栏展示。
    """
    with Session(engine) as session:
        task = session.get(MonitorTask, monitor_id)
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 #{monitor_id} 不存在")
        if task.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权查看其他用户的数据")

        # 价格检查记录
        ph_list = session.exec(
            select(PriceHistory)
            .where(PriceHistory.monitor_id == monitor_id)
            .order_by(PriceHistory.id.desc())
            .limit(limit)
        ).all()
        price_events = []
        for i, h in enumerate(ph_list):
            prev_price = ph_list[i + 1].price if i + 1 < len(ph_list) else None
            price_events.append({
                "event_type": "price_check",
                "event_at": h.checked_at,
                "price": h.price,
                "previous_price": prev_price,
            })

        # 状态变更记录
        log_list = session.exec(
            select(MonitorActivityLog)
            .where(MonitorActivityLog.monitor_id == monitor_id)
            .order_by(MonitorActivityLog.id.desc())
            .limit(limit)
        ).all()
        status_events = [
            {
                "event_type": e.event_type,
                "event_at": e.event_at,
                "price": e.price,
                "previous_status": e.previous_status,
                "new_status": e.new_status,
            }
            for e in log_list
        ]

        # 合并并按时间倒序
        all_events = price_events + status_events
        all_events.sort(key=lambda x: x["event_at"] or "", reverse=True)
        return all_events[:limit]


