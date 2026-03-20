from pydantic import BaseModel, Field
from typing import Optional, List

class SignupRequest(BaseModel):
    """注册请求"""
    email: str = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=6, description="密码（至少6位）")
    full_name: Optional[str] = Field(default=None, description="用户全名")
    phone: Optional[str] = Field(default=None, description="手机号（可选）")

class TokenResponse(BaseModel):
    """登录成功返回的 Token（含 Refresh Token）"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = 3600
    user_id: int
    email: str
    full_name: Optional[str] = None
    role: str = "user"
    credits: int = 0


class RefreshTokenRequest(BaseModel):
    """刷新 token 请求"""
    refresh_token: str = Field(..., description="Refresh token")

class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    email: str
    phone: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    credits: int = 0
    created_at: str

class TransactionHistoryResponse(BaseModel):
    """积分流水响应"""
    id: int
    user_id: int
    transaction_type: str
    amount: int
    credits_before: int
    credits_after: int
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    description: Optional[str] = None
    operator_user_id: Optional[int] = None
    created_at: str

class SearchRequest(BaseModel):
    """一次性航班搜索请求"""
    origin: str = Field(..., min_length=3, max_length=3, description="出发地 IATA")
    destination: str = Field(..., min_length=3, max_length=3, description="目的地 IATA")
    start_date: str = Field(..., description="起始日期 (YYYY-MM-DD)")
    days: int = Field(default=30, ge=1, le=60, description="搜索天数")
    cabin_class: str = Field(default="economy", description="舱位等级")
    adults: int = Field(default=1, ge=1, le=9)
    children: int = Field(default=0, ge=0, le=9)
    max_stops: Optional[int] = Field(default=None, ge=0)
    departure_time_min: Optional[str] = Field(default=None)
    departure_time_max: Optional[str] = Field(default=None)
    sort_strategy: str = Field(default="best")
    trip_type: str = Field(default="one_way")
    return_date: Optional[str] = Field(default=None)
    arrival_time_min: Optional[str] = Field(default=None)
    arrival_time_max: Optional[str] = Field(default=None)
    airline_include: Optional[str] = Field(default=None)
    excluded_airlines: Optional[str] = Field(default=None, description="排除航司代码，逗号分隔")

class MonitorCreateRequest(BaseModel):
    """创建监控任务请求"""
    origin: str = Field(..., min_length=3, max_length=3)
    destination: str = Field(..., min_length=3, max_length=3)
    start_date: str = Field(...)
    days: int = Field(default=30, ge=1, le=60)
    cabin_class: str = Field(default="economy")
    adults: int = Field(default=1, ge=1, le=9)
    children: int = Field(default=0, ge=0, le=9)
    target_price: Optional[float] = Field(default=None, gt=0)
    notification_email: Optional[str] = Field(default=None)
    max_stops: Optional[int] = Field(default=None, ge=0, le=2)
    departure_time_min: Optional[str] = Field(default=None)
    departure_time_max: Optional[str] = Field(default=None)
    sort_strategy: str = Field(default="best")
    trip_type: str = Field(default="one_way")
    return_date: Optional[str] = Field(default=None)
    arrival_time_min: Optional[str] = Field(default=None)
    arrival_time_max: Optional[str] = Field(default=None)
    airline_include: Optional[str] = Field(default=None)
    excluded_airlines: Optional[str] = Field(default=None, description="排除航司代码，逗号分隔如 UA,AA")
    interval_minutes: int = Field(default=240, ge=10, le=1440, description="检查频率（分钟）")
    duration_days: int = Field(default=7, ge=1, le=30, description="监控持续天数")

class MonitorResponse(BaseModel):
    """监控任务响应"""
    id: int
    origin: str
    destination: str
    start_date: str
    days: int
    cabin_class: str
    adults: int
    children: int
    target_price: Optional[float]
    notification_email: Optional[str]
    status: str
    lowest_price: Optional[float]
    lowest_price_date: Optional[str]
    current_price: Optional[float]
    last_checked_at: Optional[str]
    created_at: str
    booking_link: Optional[str]
    airline: Optional[str]
    flight_number: Optional[str]
    max_stops: Optional[int]
    departure_time_min: Optional[str]
    departure_time_max: Optional[str]
    sort_strategy: str = "best"
    trip_type: str = "one_way"
    return_date: Optional[str] = None
    arrival_time_min: Optional[str] = None
    arrival_time_max: Optional[str] = None
    airline_include: Optional[str] = None
    excluded_airlines: Optional[str] = None
    baggage_info: Optional[str] = None
    interval_minutes: int = 240
    end_date: Optional[str] = None
    next_run_time: Optional[str] = None
    total_credits_deducted: int = 0
    click_count: int = 0
    last_clicked_at: Optional[str] = None
    email_notified_at: Optional[str] = None

class HeatmapCell(BaseModel):
    """热力图单元格"""
    date: str
    price: Optional[float] = None
    level: str = "unavailable"

class FlightDetail(BaseModel):
    """航班详情"""
    airline: Optional[str] = None
    flight_number: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    stops: int = 0
    booking_link: Optional[str] = None
    baggage_info: Optional[str] = None

class SearchResponse(BaseModel):
    """一次性搜索响应"""
    search_id: str
    origin: str
    destination: str
    start_date: str
    days: int
    cabin_class: str
    currency: str = "USD"
    lowest_price: Optional[float] = None
    lowest_price_date: Optional[str] = None
    average_price: Optional[float] = None
    highest_price: Optional[float] = None
    heatmap_data: List[HeatmapCell] = []
    best_flight: Optional[FlightDetail] = None
    data_source: str = "mock"
    searched_at: str = ""
    trip_type: str = "one_way"
    return_date: Optional[str] = None
    return_lowest_price: Optional[float] = None
    return_lowest_price_date: Optional[str] = None
    return_heatmap_data: List[HeatmapCell] = []

class AdminStatsResponse(BaseModel):
    """管理员仪表盘统计数据"""
    total_users: int
    active_monitors: int
    total_searches: int
    scheduler_status: str = "Unknown"
    last_run_time: str = ""

class AdminUserResponse(BaseModel):
    """管理员视角的用户信息"""
    id: int
    email: str
    role: str
    credits: int
    created_at: str

class AdminMonitorResponse(BaseModel):
    """管理员视角的监控任务"""
    id: int
    user_id: Optional[int] = None
    user_email: str = ""
    origin: str
    destination: str
    start_date: str
    days: int
    cabin_class: str
    status: str
    current_price: Optional[float] = None
    lowest_price: Optional[float] = None
    target_price: Optional[float] = None
    trip_type: str = "one_way"
    created_at: str = ""
    last_checked_at: Optional[str] = None

class AdminCreditAdjustRequest(BaseModel):
    """管理员调整用户积分请求"""
    amount: int = Field(..., description="调整积分数量（正数增加，负数扣除）")

class AdminCreditAdjustResponse(BaseModel):
    """管理员调整用户积分响应"""
    user_id: int
    email: str
    credits_before: int
    credits_after: int
    amount_adjusted: int

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., description="注册邮箱")
    token: str = Field(..., description="收到的6位验证码")
    new_password: str = Field(..., min_length=6, description="新密码")

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="原密码")
    new_password: str = Field(..., min_length=6, description="新密码")


class SignupResponse(BaseModel):
    """注册成功响应（需要邮箱验证）"""
    message: str
    requires_verification: bool = True
    email: str


class VerifyEmailRequest(BaseModel):
    """邮箱验证请求"""
    email: str = Field(..., description="注册邮箱")
    code: str = Field(..., description="收到的6位验证码")


class ResendVerificationRequest(BaseModel):
    """重发邮箱验证码请求"""
    email: str = Field(..., description="注册邮箱")


class DeleteAccountRequest(BaseModel):
    """账号删除请求"""
    password: str = Field(..., description="当前密码（二次确认）")

class PricingQuoteRequest(BaseModel):
    duration_days: int = Field(..., ge=1, le=30, description="监控天数")
    interval_minutes: int = Field(..., ge=10, le=1440, description="检查频率（分钟）")

class PricingQuoteResponse(BaseModel):
    cost: int
    sufficient_balance: bool
    current_balance: int

class UpdateMonitorStatusRequest(BaseModel):
    status: str = Field(..., description="支持 active 或 paused")
    
class UpdateMonitorRequest(BaseModel):
    target_price: Optional[float] = Field(None, gt=0)
    notification_email: Optional[str] = None


class AirportSearchResult(BaseModel):
    """机场搜索结果"""
    iata_code: str
    name: str
    municipality: Optional[str] = None
    iso_country: str
    airport_type: str


# ========== 机场管理（Admin） ==========

class AdminAirportResponse(BaseModel):
    """管理后台机场详情"""
    id: int
    iata_code: str
    icao_code: Optional[str] = None
    name: str
    municipality: Optional[str] = None
    iso_country: str
    iso_region: Optional[str] = None
    airport_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_disabled: bool = False


class AdminAirportListResponse(BaseModel):
    """带分页的机场列表"""
    items: List[AdminAirportResponse]
    total: int
    page: int
    page_size: int


class AdminAirportCreateRequest(BaseModel):
    """手动添加机场"""
    iata_code: str = Field(..., min_length=2, max_length=4, description="IATA 代码")
    icao_code: Optional[str] = Field(None, max_length=4)
    name: str = Field(..., min_length=1, max_length=200)
    municipality: Optional[str] = Field(None, max_length=100)
    iso_country: str = Field(..., min_length=2, max_length=2)
    iso_region: Optional[str] = Field(None, max_length=10)
    airport_type: str = Field(default="medium_airport")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AdminAirportUpdateRequest(BaseModel):
    """编辑机场（所有字段可选）"""
    iata_code: Optional[str] = Field(None, min_length=2, max_length=4)
    icao_code: Optional[str] = Field(None, max_length=4)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    municipality: Optional[str] = Field(None, max_length=100)
    iso_country: Optional[str] = Field(None, min_length=2, max_length=2)
    iso_region: Optional[str] = Field(None, max_length=10)
    airport_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_disabled: Optional[bool] = None


class AdminAirportCsvUploadResponse(BaseModel):
    """CSV 上传结果"""
    total_parsed: int
    inserted: int
    skipped_existing: int
    skipped_no_iata: int
    backup_path: Optional[str] = None


# ========== 分析仪表板（Admin Analytics） ==========

class TimeSeriesPoint(BaseModel):
    """时间序列数据点"""
    label: str
    value: int = 0

class FloatTimeSeriesPoint(BaseModel):
    """浮点时间序列数据点（用于成本等）"""
    label: str
    value: float = 0.0

class AnalyticsOverviewResponse(BaseModel):
    """仪表板概览 KPI"""
    total_users: int
    today_new_users: int
    active_monitors: int
    total_searches: int
    today_api_calls: int
    today_searches: int
    scheduler_status: str = "Unknown"
    last_run_time: str = ""
    dau: int = 0
    wau: int = 0
    mau: int = 0
    avg_response_time_ms: float = 0.0
    error_rate_percent: float = 0.0

class UserTrendsResponse(BaseModel):
    """用户注册趋势"""
    range: str
    data: List[TimeSeriesPoint]

class ApiUsageTrendsResponse(BaseModel):
    """API 使用量趋势"""
    range: str
    total_calls: List[TimeSeriesPoint]
    by_endpoint: dict = {}

class UserActivityItem(BaseModel):
    """每用户活动明细"""
    user_id: int
    email: str
    role: str
    search_count: int = 0
    monitor_count: int = 0
    credits_consumed: int = 0
    last_active: Optional[str] = None
    country: Optional[str] = None

class UserActivityResponse(BaseModel):
    """每用户活动列表"""
    items: List[UserActivityItem]
    total: int
    page: int
    page_size: int

class CostSummaryResponse(BaseModel):
    """API 成本汇总"""
    total_budget: float = 0.0
    total_spent: float = 0.0
    balance: float = 0.0
    total_api_calls: int = 0
    avg_cost_per_call: float = 0.0
    trend: List[FloatTimeSeriesPoint] = []
    range: str = "day"

class GeoDistributionItem(BaseModel):
    """地理分布项"""
    country: str
    count: int
    percentage: float = 0.0

class GeoDistributionResponse(BaseModel):
    """用户地理分布"""
    data: List[GeoDistributionItem]
    total_with_geo: int = 0
    total_without_geo: int = 0

class TopRouteItem(BaseModel):
    """热门航线"""
    origin: str
    destination: str
    count: int

class TopRoutesResponse(BaseModel):
    """热门航线列表"""
    data: List[TopRouteItem]

class AdminBudgetRequest(BaseModel):
    """管理员充值/预算录入"""
    amount_usd: float = Field(..., gt=0, description="充值金额（美元）")
    provider: str = Field(default="serpapi", description="供应商")
    description: Optional[str] = Field(default=None, description="备注")

class AdminBudgetResponse(BaseModel):
    """充值记录响应"""
    id: int
    amount_usd: float
    provider: str
    description: Optional[str] = None
    created_at: str

class AdminAuditLogResponse(BaseModel):
    """审计日志响应"""
    id: int
    admin_user_id: int
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: str

class TotpSetupResponse(BaseModel):
    """TOTP 设置响应"""
    secret: str
    provisioning_uri: str
    qr_code_base64: str

class TotpVerifyRequest(BaseModel):
    """TOTP 验证请求"""
    code: str = Field(..., min_length=6, max_length=6)


class OAuthAppleRequest(BaseModel):
    """Apple Sign-In 请求"""
    id_token: str = Field(..., description="Apple 返回的 identity token (JWT)")
    full_name: Optional[str] = Field(default=None, description="用户全名（仅首次授权时可获取）")


class OAuthGoogleRequest(BaseModel):
    """Google Sign-In 请求"""
    id_token: str = Field(..., description="Google 返回的 ID token (JWT)")
