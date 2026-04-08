from sqlmodel import SQLModel, Field as SQLField
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import UniqueConstraint


def utc_iso_now() -> str:
    """生成带 Z 后缀的 UTC ISO 时间字符串，确保前端 JS 正确解析为 UTC。"""
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')

class User(SQLModel, table=True):
    """
    用户表
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("phone", name="uq_users_phone"),
        {"extend_existing": True},
    )

    id: Optional[int] = SQLField(default=None, primary_key=True)
    email: str = SQLField(index=True, description="邮箱（唯一）")
    phone: Optional[str] = SQLField(default=None, description="手机号（唯一，可选）")
    hashed_password: str = SQLField(description="bcrypt 哈希密码")
    full_name: Optional[str] = SQLField(default=None, description="用户全名")
    role: str = SQLField(default="user", description="角色: user/admin/agent")
    credits: int = SQLField(default=5, description="用户积分余额，注册赠送5积分")
    email_verified: bool = SQLField(default=False, description="邮箱是否已验证")
    email_verified_at: Optional[str] = SQLField(default=None, description="邮箱验证完成时间 ISO")
    created_at: str = SQLField(default_factory=utc_iso_now, description="注册时间 ISO")
    country: Optional[str] = SQLField(default=None, index=True, description="ISO 国家码，注册时通过 IP 推断")
    region: Optional[str] = SQLField(default=None, description="地区/省份")
    city: Optional[str] = SQLField(default=None, description="城市")
    signup_ip: Optional[str] = SQLField(default=None, description="注册时的 IP 地址")
    last_login_at: Optional[str] = SQLField(default=None, description="最后登录时间 ISO")
    last_login_ip: Optional[str] = SQLField(default=None, description="最后登录 IP")
    totp_secret: Optional[str] = SQLField(default=None, description="TOTP 密钥（加密存储）")
    totp_enabled: bool = SQLField(default=False, description="是否启用 TOTP 双因素认证")
    auth_provider: str = SQLField(default="email", description="认证方式: email/apple/google")
    apple_sub: Optional[str] = SQLField(default=None, index=True, description="Apple 用户唯一标识符")
    google_sub: Optional[str] = SQLField(default=None, index=True, description="Google 用户唯一标识符")


class MonitorTask(SQLModel, table=True):
    """持久化监控任务表"""
    __tablename__ = "monitor_tasks"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: Optional[int] = SQLField(default=None, index=True, description="关联用户 ID")
    origin: str = SQLField(index=True, description="出发地 IATA")
    destination: str = SQLField(index=True, description="目的地 IATA")
    start_date: str = SQLField(description="监控起始日期 YYYY-MM-DD")
    days: int = SQLField(default=30, description="监控天数")
    cabin_class: str = SQLField(default="economy", description="舱位等级")
    adults: int = SQLField(default=1, description="成人数量")
    children: int = SQLField(default=0, description="儿童数量")
    target_price: Optional[float] = SQLField(default=None, description="目标价格 USD")
    notification_email: Optional[str] = SQLField(default=None, description="通知邮箱")
    status: str = SQLField(default="active", description="active/found/paused/expired")
    lowest_price: Optional[float] = SQLField(default=None, description="历史最低价")
    lowest_price_date: Optional[str] = SQLField(default=None, description="最低价日期")
    current_price: Optional[float] = SQLField(default=None, description="当前价格")
    last_checked_at: Optional[str] = SQLField(default=None, description="最后检查时间 ISO")
    created_at: str = SQLField(default_factory=utc_iso_now, description="创建时间 ISO")
    booking_link: Optional[str] = SQLField(default=None, description="预订链接")
    airline: Optional[str] = SQLField(default=None, description="航司名称")
    flight_number: Optional[str] = SQLField(default=None, description="航班号")
    max_stops: Optional[int] = SQLField(default=None, description="最大转机次数")
    departure_time_min: Optional[str] = SQLField(default=None, description="最早起飞时间 HH:MM")
    departure_time_max: Optional[str] = SQLField(default=None, description="最晚起飞时间 HH:MM")
    sort_strategy: str = SQLField(default="best", description="搜索策略: best/cheapest")
    trip_type: str = SQLField(default="one_way", description="行程类型: one_way/round_trip")
    return_date: Optional[str] = SQLField(default=None, description="返程日期 YYYY-MM-DD")
    arrival_time_min: Optional[str] = SQLField(default=None, description="最早到达时间 HH:MM")
    arrival_time_max: Optional[str] = SQLField(default=None, description="最晚到达时间 HH:MM")
    airline_include: Optional[str] = SQLField(default=None, description="偏好航司代码")
    excluded_airlines: Optional[str] = SQLField(default=None, description="排除航司代码，逗号分隔如 UA,AA")
    baggage_info: Optional[str] = SQLField(default=None, description="行李信息")
    is_deleted: bool = SQLField(default=False, description="软删除标记")
    interval_minutes: int = SQLField(default=240, description="检查频率（分钟）: 10/30/60/240/720/1440")
    end_date: Optional[str] = SQLField(default=None, description="监控结束时间 ISO，基于 duration_days 自动计算")
    next_run_time: Optional[str] = SQLField(default=None, description="下次运行时间 ISO")
    total_credits_deducted: int = SQLField(default=0, description="创建时一次性扣除的总积分")
    click_count: int = SQLField(default=0, description="预订链接点击次数")
    last_clicked_at: Optional[str] = SQLField(default=None, description="最后点击时间 ISO")
    email_notified_at: Optional[str] = SQLField(default=None, description="达到目标价后发送邮件的时间 ISO")


class FlightCache(SQLModel, table=True):
    """航班价格缓存表"""
    __tablename__ = "flight_cache"
    __table_args__ = (
        UniqueConstraint("origin", "destination", "date", name="uq_flight_cache_route_date"),
        {"extend_existing": True},
    )

    id: Optional[int] = SQLField(default=None, primary_key=True)
    origin: str = SQLField(index=True, description="出发地 IATA")
    destination: str = SQLField(index=True, description="目的地 IATA")
    date: str = SQLField(description="航班日期 YYYY-MM-DD")
    price: Optional[float] = SQLField(default=None, description="缓存价格")
    data: Optional[str] = SQLField(default=None, description="完整航班数据 JSON")
    updated_at: str = SQLField(
        default_factory=utc_iso_now,
        description="缓存更新时间 ISO",
    )


class PriceHistory(SQLModel, table=True):
    """价格历史记录表"""
    __tablename__ = "price_history"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    monitor_id: int = SQLField(index=True, description="关联监控任务 ID")
    price: float = SQLField(description="检查到的价格")
    checked_at: str = SQLField(default_factory=utc_iso_now)
    booking_link: Optional[str] = SQLField(default=None)


class MonitorActivityLog(SQLModel, table=True):
    """监控任务活动日志：创建、暂停、恢复、达到目标、过期、存档等"""
    __tablename__ = "monitor_activity_log"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    monitor_id: int = SQLField(index=True, description="关联监控任务 ID")
    event_type: str = SQLField(description="created|price_check|paused|resumed|found|expired|archived")
    event_at: str = SQLField(default_factory=utc_iso_now)
    price: Optional[float] = SQLField(default=None, description="价格检查时的价格")
    previous_status: Optional[str] = SQLField(default=None)
    new_status: Optional[str] = SQLField(default=None)


class Airport(SQLModel, table=True):
    """全球机场数据表（仅含有 IATA 代码的商用机场）"""
    __tablename__ = "airports"
    __table_args__ = (
        UniqueConstraint("iata_code", name="uq_airports_iata_code"),
        {"extend_existing": True},
    )

    id: Optional[int] = SQLField(default=None, primary_key=True)
    iata_code: str = SQLField(index=True, description="IATA 三字码（如 JFK, SFO）")
    icao_code: Optional[str] = SQLField(default=None, description="ICAO 四字码")
    name: str = SQLField(description="机场全称")
    municipality: Optional[str] = SQLField(default=None, index=True, description="城市名称")
    iso_country: str = SQLField(index=True, description="ISO 国家代码（如 US, CN）")
    iso_region: Optional[str] = SQLField(default=None, description="ISO 地区代码")
    airport_type: str = SQLField(default="medium_airport", description="类型: large/medium/small_airport 等")
    latitude: Optional[float] = SQLField(default=None, description="纬度")
    longitude: Optional[float] = SQLField(default=None, description="经度")
    is_disabled: bool = SQLField(default=False, description="是否已禁用（关闭/错误的机场）")


class PasswordReset(SQLModel, table=True):
    """密码重置令牌表"""
    __tablename__ = "password_resets"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    email: str = SQLField(index=True, description="用户邮箱")
    token: str = SQLField(index=True, description="6位数字验证码")
    expires_at: str = SQLField(description="过期时间 ISO 格式")
    used: bool = SQLField(default=False, description="是否已使用")
    created_at: str = SQLField(default_factory=utc_iso_now, description="创建时间")


class EmailVerification(SQLModel, table=True):
    """邮箱验证令牌表"""
    __tablename__ = "email_verifications"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    email: str = SQLField(index=True, description="用户邮箱")
    token: str = SQLField(index=True, description="6位数字验证码")
    expires_at: str = SQLField(description="过期时间 ISO 格式")
    used: bool = SQLField(default=False, description="是否已使用")
    created_at: str = SQLField(default_factory=utc_iso_now, description="创建时间")


class TransactionHistory(SQLModel, table=True):
    """积分交易流水表"""
    __tablename__ = "transaction_history"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: int = SQLField(index=True, description="关联用户 ID")
    transaction_type: str = SQLField(description="交易类型：recharge/consumption/refund/system_adjustment")
    amount: int = SQLField(description="积分变动值，扣费为负数，入账为正数")
    credits_before: int = SQLField(description="变动前余额")
    credits_after: int = SQLField(description="变动后余额")
    reference_type: Optional[str] = SQLField(default=None, description="关联对象类型")
    reference_id: Optional[str] = SQLField(default=None, description="关联对象 ID")
    description: Optional[str] = SQLField(default=None, description="交易说明")
    operator_user_id: Optional[int] = SQLField(default=None, description="操作人 ID（如管理员）")
    created_at: str = SQLField(default_factory=utc_iso_now, description="创建时间 ISO")


class ApiUsageLog(SQLModel, table=True):
    """API 请求日志表，通过中间件自动记录每次请求"""
    __tablename__ = "api_usage_log"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: Optional[int] = SQLField(default=None, index=True, description="请求用户 ID（未登录为 None）")
    endpoint: str = SQLField(index=True, description="请求路径，如 /api/v1/search")
    method: str = SQLField(description="HTTP 方法：GET/POST/PUT/DELETE")
    status_code: int = SQLField(description="响应状态码")
    response_time_ms: int = SQLField(default=0, description="响应耗时（毫秒）")
    ip_address: Optional[str] = SQLField(default=None, description="请求 IP")
    user_agent: Optional[str] = SQLField(default=None, description="User-Agent")
    created_at: str = SQLField(default_factory=utc_iso_now, index=True, description="请求时间 ISO")


class ApiCostRecord(SQLModel, table=True):
    """外部 API 调用成本记录（如 SerpApi）"""
    __tablename__ = "api_cost_record"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    api_provider: str = SQLField(default="serpapi", index=True, description="API 供应商")
    cost_usd: float = SQLField(description="单次调用成本（美元）")
    request_type: str = SQLField(description="请求类型：search / monitor_check")
    reference_id: Optional[str] = SQLField(default=None, description="关联搜索或监控 ID")
    origin: Optional[str] = SQLField(default=None, description="出发地 IATA")
    destination: Optional[str] = SQLField(default=None, description="目的地 IATA")
    created_at: str = SQLField(default_factory=utc_iso_now, index=True, description="调用时间 ISO")


class AdminBudget(SQLModel, table=True):
    """管理员 API 预算/充值记录"""
    __tablename__ = "admin_budget"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    amount_usd: float = SQLField(description="充值金额（美元）")
    provider: str = SQLField(default="serpapi", description="供应商：serpapi / other")
    description: Optional[str] = SQLField(default=None, description="备注说明")
    created_at: str = SQLField(default_factory=utc_iso_now, index=True, description="充值时间 ISO")


class PushToken(SQLModel, table=True):
    """用户推送通知 token 表"""
    __tablename__ = "push_tokens"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: int = SQLField(index=True, description="关联用户 ID")
    token: str = SQLField(index=True, description="Expo push token 或 FCM token")
    platform: str = SQLField(default="unknown", description="ios/android/web")
    created_at: str = SQLField(default_factory=utc_iso_now, description="注册时间 ISO")
    updated_at: str = SQLField(default_factory=utc_iso_now, description="更新时间 ISO")


class RefreshToken(SQLModel, table=True):
    """Refresh Token 表，用于 JWT 双 token 刷新机制"""
    __tablename__ = "refresh_tokens"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    user_id: int = SQLField(index=True, description="关联用户 ID")
    token: str = SQLField(index=True, description="Refresh token 值（UUID）")
    expires_at: str = SQLField(description="过期时间 ISO")
    revoked: bool = SQLField(default=False, description="是否已撤销")
    created_at: str = SQLField(default_factory=utc_iso_now, description="创建时间 ISO")
    user_agent: Optional[str] = SQLField(default=None, description="客户端 User-Agent")
    ip_address: Optional[str] = SQLField(default=None, description="创建时 IP")


class AdminAuditLog(SQLModel, table=True):
    """管理员操作审计日志"""
    __tablename__ = "admin_audit_log"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    admin_user_id: int = SQLField(index=True, description="执行操作的管理员 ID")
    action: str = SQLField(description="操作类型：delete_user / adjust_credits / budget_add 等")
    target_type: Optional[str] = SQLField(default=None, description="目标类型：user / monitor / budget")
    target_id: Optional[str] = SQLField(default=None, description="目标 ID")
    details: Optional[str] = SQLField(default=None, description="操作详情 JSON")
    ip_address: Optional[str] = SQLField(default=None, description="操作者 IP")
    created_at: str = SQLField(default_factory=utc_iso_now, index=True, description="操作时间 ISO")

class SystemConfig(SQLModel, table=True):
    """系统全局配置表，例如积分成本、购买套餐等"""
    __tablename__ = "system_config"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = SQLField(default=None, primary_key=True)
    key: str = SQLField(index=True, unique=True, description="配置键名")
    value: str = SQLField(description="配置值 (JSON 字符串或普通字符串)")
    description: Optional[str] = SQLField(default=None, description="配置说明")
    updated_at: str = SQLField(default_factory=utc_iso_now, description="更新时间 ISO")

