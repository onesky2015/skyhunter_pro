import time
import traceback
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from sqlmodel import Session, select
from db import engine
from config import logger, SCHEDULER_INTERVAL_HOURS, USE_MOCK_DATA
from models.database import MonitorTask, PriceHistory, MonitorActivityLog, TransactionHistory, User, utc_iso_now
from schemas.api_models import MonitorResponse
from services.flight import _generate_mock_heatmap, _search_serpapi_single_day, _generate_mock_flight_detail
from services.email import send_alert_email
# ============================================================================
# 后台调度器
# ============================================================================

_scheduler = None


def _parse_iso_datetime(value):
    """
    兼容 SQLModel / PostgreSQL 可能返回 datetime 或 ISO 字符串两种形式。
    始终返回 naive UTC datetime，与 datetime.utcnow() 对齐，避免 offset-aware 比较错误。
    """
    if not value:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            return None
    return None


def _parse_iso_date(value):
    """
    兼容 SQLModel / PostgreSQL 可能返回 date / datetime / ISO 字符串三种形式。
    """
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def _stringify_temporal_value(value):
    """统一将 date/datetime 转成 ISO 字符串（datetime 带 Z 后缀），避免响应序列化告警。"""
    if value is None:
        return None
    if isinstance(value, datetime):
        s = value.isoformat()
        if not s.endswith('Z') and '+' not in s:
            s += 'Z'
        return s
    if isinstance(value, date):
        return str(value.isoformat())
    s = str(value)
    return s


def _monitor_response_from_task(task: MonitorTask) -> MonitorResponse:
    """将数据库任务对象安全映射为 API 响应，避免 datetime 序列化警告。"""
    temporal = ("start_date", "return_date", "last_checked_at", "created_at", "end_date", "next_run_time")
    payload = {k: getattr(task, k, None) for k in MonitorResponse.model_fields}
    for fn in temporal:
        payload[fn] = _stringify_temporal_value(getattr(task, fn, None))
    return MonitorResponse(**payload)


def _process_active_monitors():
    """
    Phase 2: Per-Task 独立调度心跳（每 5 分钟执行一次）

    逻辑：
    1. 查询所有 active + 未删除的任务
    2. 对每个任务检查 end_date → 过期则标记 expired
    3. 检查 next_run_time → 未到时间则跳过
    4. 执行价格检查 → 更新 next_run_time
    """
    now = datetime.utcnow()
    now_iso = utc_iso_now()
    logger.info(f"\n💓 [Scheduler] 心跳 {now.strftime('%H:%M:%S')} UTC (5min per-task)")
    executed_count = 0
    try:
        with Session(engine) as session:
            # found 任务仍在监控期内，继续检查（寻找更低价并允许再次触发通知）
            statement = select(MonitorTask).where(
                MonitorTask.status.in_(["active", "found"]),
                MonitorTask.is_deleted == False,
            )
            tasks = session.exec(statement).all()
            if not tasks:
                logger.info("  ℹ️ 无活跃任务")
                return
            logger.info(f"  📋 发现 {len(tasks)} 个活跃/已触发任务，开始逐个检查...")

            for task in tasks:
                try:
                    # ── Step 1: 检查 end_date 过期 ──
                    if task.end_date:
                        end_dt = _parse_iso_datetime(task.end_date)
                        if end_dt and now > end_dt:
                            prev_status = task.status
                            task.status = "expired"
                            session.add(MonitorActivityLog(
                                monitor_id=task.id, event_type="expired",
                                event_at=now_iso, previous_status=prev_status, new_status="expired",
                            ))
                            session.add(task)
                            session.commit()
                            logger.info(f"  ⏰ 任务 #{task.id} 已过期 (end_date={task.end_date})")
                            continue
                    else:
                        # 兼容旧任务（无 end_date）：用 start_date + days 判断
                        task_start = _parse_iso_date(task.start_date)
                        if task_start:
                            task_end = task_start + timedelta(days=task.days)
                            if date.today() > task_end:
                                prev_status = task.status
                                task.status = "expired"
                                session.add(MonitorActivityLog(
                                    monitor_id=task.id, event_type="expired",
                                    event_at=now_iso, previous_status=prev_status, new_status="expired",
                                ))
                                session.add(task)
                                session.commit()
                                logger.info(f"  ⏰ 任务 #{task.id} 已过期 (legacy: start+days)")
                                continue

                    # ── Step 2: 检查 next_run_time（是否到达执行时间）──
                    if task.next_run_time:
                        next_run = _parse_iso_datetime(task.next_run_time)
                        if next_run and now < next_run:
                            logger.debug(f"  ⏭️ 任务 #{task.id} 跳过: next_run={task.next_run_time} 未到")
                            continue  # 未到执行时间，跳过

                    # ── Step 3: 执行价格检查 ──
                    logger.info(f"  ✈️ 执行任务 #{task.id}: {task.origin}->{task.destination} (间隔={task.interval_minutes}m)")
                    executed_count += 1

                    check_date = _parse_iso_date(task.start_date) or (date.today() + timedelta(days=1))

                    return_date_obj = None
                    if task.trip_type == "round_trip" and task.return_date:
                        return_date_obj = _parse_iso_date(task.return_date)

                    if USE_MOCK_DATA:
                        mock_data = _generate_mock_heatmap(task.origin, task.destination, check_date, 1, task.cabin_class)
                        if mock_data and mock_data[0]["price"] is not None:
                            current_price = mock_data[0]["price"]
                            if return_date_obj:
                                return_mock = _generate_mock_heatmap(task.destination, task.origin, return_date_obj, 1, task.cabin_class)
                                if return_mock and return_mock[0]["price"] is not None:
                                    current_price += return_mock[0]["price"]
                            mock_flight = _generate_mock_flight_detail(
                                task.origin, task.destination, task.start_date, current_price,
                                max_stops=task.max_stops, departure_time_min=task.departure_time_min,
                                departure_time_max=task.departure_time_max, arrival_time_min=task.arrival_time_min,
                                arrival_time_max=task.arrival_time_max, airline_include=task.airline_include,
                            )
                            flight_info = mock_flight.model_dump()
                        else:
                            current_price = None
                            flight_info = None
                    else:
                        result = _search_serpapi_single_day(
                            task.origin, task.destination, check_date, task.cabin_class,
                            task.adults, task.children, task.max_stops,
                            task.departure_time_min, task.departure_time_max,
                            task.sort_strategy or "best", task.arrival_time_min,
                            task.arrival_time_max, task.airline_include, task.excluded_airlines,
                            return_date_obj,
                            bypass_cache=True,  # 监控任务每次检查强制拉取实时价格，避免显示旧缓存
                        )
                        if result:
                            current_price = result["price"]
                            flight_info = result
                        else:
                            current_price = None
                            flight_info = None

                    task.last_checked_at = now_iso
                    if current_price is not None:
                        # 仅在首次或发现更低价时更新展示价；每次检查都记录价格历史
                        prev_display = task.current_price
                        is_new_low = prev_display is None or current_price < prev_display
                        if is_new_low:
                            task.current_price = current_price
                            if task.lowest_price is None or current_price < task.lowest_price:
                                task.lowest_price = current_price
                                task.lowest_price_date = check_date.isoformat()
                            if flight_info:
                                task.booking_link = flight_info.get("booking_link")
                                task.airline = flight_info.get("airline")
                                task.flight_number = flight_info.get("flight_number")
                                task.baggage_info = flight_info.get("baggage_info")
                        ph = PriceHistory(
                            monitor_id=task.id, price=current_price, checked_at=now_iso,
                            booking_link=flight_info.get("booking_link") if flight_info else None,
                        )
                        session.add(ph)
                        # 目标价检查：
                        # - 首次达标 (status=active)：标记 found + 发邮件
                        # - 已达标且发现更低价 (is_new_low)：再次发邮件提醒更低价
                        # 两种情况下任务都保持在 found 状态继续监控，直到 end_date 到期
                        if task.target_price and current_price <= task.target_price:
                            now_iso_alert = utc_iso_now()
                            prev_task_status = task.status
                            should_notify = (
                                task.status == "active"  # 首次达标
                                or (task.status == "found" and is_new_low)  # 已found但发现更低价
                            )
                            task.status = "found"  # 保持/设置 found，调度器继续处理 found 任务
                            if should_notify and task.notification_email:
                                task.email_notified_at = now_iso_alert
                                logger.info(f"  📧 任务 #{task.id} 达到/再次低于目标价 ${task.target_price}，发送邮件至 {task.notification_email}")
                                user = session.get(User, task.user_id) if task.user_id else None
                                recipient_name = user.full_name if user and user.full_name else None
                                try:
                                    send_alert_email(
                                        to_email=task.notification_email, origin=task.origin,
                                        destination=task.destination, price=current_price,
                                        target_price=task.target_price, departure_date=task.start_date,
                                        link=task.booking_link or "#",
                                        adults=task.adults, children=task.children,
                                        airline=flight_info.get("airline") if flight_info else None,
                                        flight_number=flight_info.get("flight_number") if flight_info else None,
                                        monitor_id=task.id,
                                        recipient_name=recipient_name,
                                    )
                                except Exception as mail_err:
                                    logger.error(f"  ❌ 邮件发送失败: {mail_err}")
                            elif task.target_price and current_price <= task.target_price and not task.notification_email:
                                logger.warning(f"  📧 任务 #{task.id} 达到目标价 ${task.target_price}，但未设置 notification_email，跳过邮件")
                            evt = MonitorActivityLog(
                                monitor_id=task.id, event_type="found",
                                event_at=now_iso_alert, price=current_price,
                                previous_status=prev_task_status, new_status="found",
                            )
                            session.add(evt)

                    # ── Step 4: 更新 next_run_time ──
                    interval = task.interval_minutes or 240
                    task.next_run_time = (now + timedelta(minutes=interval)).strftime('%Y-%m-%dT%H:%M:%S.%fZ')

                    session.add(task)
                    session.commit()

                    if not USE_MOCK_DATA:
                        time.sleep(2)

                except Exception as e:
                    logger.error(f"    ❌ 任务 #{task.id} 异常: {e}")
                    continue

        logger.info(f"  ✅ 心跳完成: 执行了 {executed_count} 个任务")
    except Exception as e:
        logger.error(f"❌ 调度器致命错误: {e}")
        import traceback
        traceback.print_exc()


# Phase 2: 调度器心跳间隔从 SCHEDULER_INTERVAL_HOURS 改为 5 分钟
SCHEDULER_HEARTBEAT_MINUTES: int = 5


def _reset_stuck_next_run_times():
    """
    启动时修复：将 next_run_time 在「较远」未来（> interval - 1h）的活跃任务重置为 None。
    用于修复创建时错误地将 next_run_time 设为 now+interval 的旧任务，避免每次重启都重置所有任务。
    """
    now = datetime.utcnow()
    try:
        with Session(engine) as session:
            statement = select(MonitorTask).where(
                MonitorTask.status == "active",
                MonitorTask.is_deleted == False,
                MonitorTask.next_run_time.isnot(None),
            )
            tasks = session.exec(statement).all()
            reset_count = 0
            for task in tasks:
                next_run = _parse_iso_datetime(task.next_run_time)
                if not next_run or now >= next_run:
                    continue
                interval = task.interval_minutes or 240
                threshold_minutes = max(0, interval - 60)  # 仅重置「明显卡住」的任务
                if (next_run - now).total_seconds() > threshold_minutes * 60:
                    task.next_run_time = None
                    session.add(task)
                    reset_count += 1
            if reset_count > 0:
                session.commit()
                logger.info(f"🔧 已重置 {reset_count} 个任务的 next_run_time，将在下次心跳执行")
    except Exception as e:
        logger.warning(f"⚠️ 重置 next_run_time 时出错: {e}")


def start_scheduler():
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.error("❌ apscheduler 未安装")
        return
    if _scheduler is not None:
        return
    _reset_stuck_next_run_times()
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        func=_process_active_monitors, trigger="interval",
        minutes=SCHEDULER_HEARTBEAT_MINUTES, id="process_monitors",
        name=f"每{SCHEDULER_HEARTBEAT_MINUTES}分钟心跳 (per-task 独立调度)",
        replace_existing=True, max_instances=1, misfire_grace_time=600,
    )
    _scheduler.start()
    logger.info(f"⏰ Phase 2 调度器已启动: 每 {SCHEDULER_HEARTBEAT_MINUTES} 分钟心跳，per-task 独立频率")
    logger.info("🔍 启动后立即执行首次检查...")
    _process_active_monitors()


def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown()
        _scheduler = None
        logger.info("🛑 调度器已停止")


