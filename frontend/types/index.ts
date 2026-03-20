// filename: types/index.ts
// TypeScript 类型定义

export interface HeatmapCell {
  date: string;
  price: number | null;
  level: 'low' | 'medium' | 'high' | 'unavailable';
}

export interface FlightDetail {
  airline: string | null;
  flight_number: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  duration_minutes: number | null;
  stops: number;
  booking_link: string | null;
  baggage_info: string | null;
}

export type TripType = 'one_way' | 'round_trip';
export type SortStrategy = 'best' | 'cheapest';

/** 搜索请求参数（与后端 SearchRequest 对齐） */
export interface SearchRequestPayload {
  origin: string;
  destination: string;
  start_date: string;
  days: number;
  cabin_class?: string;
  adults?: number;
  children?: number;
  max_stops?: number | null;
  departure_time_min?: string;
  departure_time_max?: string;
  sort_strategy?: SortStrategy;
  trip_type?: TripType;
  return_date?: string;
  arrival_time_min?: string;
  arrival_time_max?: string;
  airline_include?: string;
  excluded_airlines?: string;
}

/** 搜索页内部使用的选项（camelCase） */
export interface SearchRequestOptions {
  tripType?: TripType;
  returnDate?: string;
  maxStops?: number | null;
  departureTimeMin?: string;
  departureTimeMax?: string;
  arrivalTimeMin?: string;
  arrivalTimeMax?: string;
  airlineInclude?: string;
  excludedAirlines?: string;
  sortStrategy?: SortStrategy;
  cabinClass?: string;
  adults?: number;
  children?: number;
}

/** 创建监控参数（与后端 MonitorCreateRequest 对齐） */
export interface MonitorCreatePayload extends SearchRequestPayload {
  target_price?: number;
  notification_email?: string;
  interval_minutes?: number;
  duration_days?: number;
}

/** 编辑监控参数（与后端 MonitorUpdateRequest 对齐） */
export interface MonitorUpdatePayload {
  target_price?: number | null;
  notification_email?: string | null;
  start_date?: string;
  return_date?: string;
  interval_minutes?: number;
  excluded_airlines?: string | null;
  extend_days?: number;
}

export interface SearchResponse {
  search_id: string;
  origin: string;
  destination: string;
  start_date: string;
  days: number;
  cabin_class: string;
  currency: string;
  lowest_price: number | null;
  lowest_price_date: string | null;
  average_price: number | null;
  highest_price: number | null;
  heatmap_data: HeatmapCell[];
  best_flight: FlightDetail | null;
  data_source: 'mock' | 'serpapi';
  searched_at: string;
  trip_type: string;
  return_date: string | null;
  return_lowest_price: number | null;
  return_lowest_price_date: string | null;
  return_heatmap_data: HeatmapCell[];
}

/** 监控任务（对应后端 MonitorResponse, Phase 2 含调度字段） */
export interface MonitorTask {
  id: number;
  origin: string;
  destination: string;
  start_date: string;
  days: number;
  cabin_class: string;
  adults: number;
  children: number;
  target_price: number | null;
  notification_email: string | null;
  status: string; // active / found / paused / expired / archived
  lowest_price: number | null;
  lowest_price_date: string | null;
  current_price: number | null;
  last_checked_at: string | null;
  created_at: string;
  booking_link: string | null;
  airline: string | null;
  flight_number: string | null;
  max_stops: number | null;
  departure_time_min: string | null;
  departure_time_max: string | null;
  sort_strategy: string;
  trip_type: string;
  return_date: string | null;
  arrival_time_min: string | null;
  arrival_time_max: string | null;
  airline_include: string | null;
  excluded_airlines: string | null;
  baggage_info: string | null;
  // Phase 2: 调度与计费字段
  interval_minutes: number;
  end_date: string | null;
  next_run_time: string | null;
  total_credits_deducted: number;
  email_notified_at: string | null;
}

/** 任务报告单项（价格检查或状态变更） */
export interface TaskReportItem {
  event_type: string;
  event_at: string;
  price?: number;
  previous_price?: number | null;
  previous_status?: string | null;
  new_status?: string | null;
}

/** 用户信息（对应后端 TokenResponse） */
export interface UserInfo {
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  credits: number;
}

/** Admin 仪表盘统计数据 */
export interface AdminStats {
  total_users: number;
  active_monitors: number;
  total_searches: number;
  scheduler_status: string;
  last_run_time: string;
}

/** Admin 用户列表项 */
export interface AdminUser {
  id: number;
  email: string;
  role: string;
  credits: number;
  created_at: string;
}

/** Admin 监控任务列表项（含用户邮箱） */
export interface AdminMonitor {
  id: number;
  user_id: number | null;
  user_email: string;
  origin: string;
  destination: string;
  start_date: string;
  days: number;
  cabin_class: string;
  status: string;
  current_price: number | null;
  lowest_price: number | null;
  target_price: number | null;
  trip_type: string;
  created_at: string;
  last_checked_at: string | null;
}

export interface AirlineOption {
  label: string;
  value: string;
}

export interface AirportSearchResult {
  iata_code: string;
  name: string;
  municipality: string | null;
  iso_country: string;
  airport_type: string;
}

/** Admin 机场详情 */
export interface AdminAirport {
  id: number;
  iata_code: string;
  icao_code: string | null;
  name: string;
  municipality: string | null;
  iso_country: string;
  iso_region: string | null;
  airport_type: string;
  latitude: number | null;
  longitude: number | null;
  is_disabled: boolean;
}

/** Admin 机场列表分页响应 */
export interface AdminAirportListResponse {
  items: AdminAirport[];
  total: number;
  page: number;
  page_size: number;
}

/** CSV 上传结果 */
export interface AirportCsvUploadResult {
  total_parsed: number;
  inserted: number;
  skipped_existing: number;
  skipped_no_iata: number;
  backup_path: string | null;
}

// ========== Admin Analytics Types ==========

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface AnalyticsOverview {
  total_users: number;
  today_new_users: number;
  active_monitors: number;
  total_searches: number;
  today_api_calls: number;
  today_searches: number;
  scheduler_status: string;
  last_run_time: string;
  dau: number;
  wau: number;
  mau: number;
  avg_response_time_ms: number;
  error_rate_percent: number;
}

export interface UserTrendsData {
  range: string;
  data: TimeSeriesPoint[];
}

export interface ApiUsageTrendsData {
  range: string;
  total_calls: TimeSeriesPoint[];
}

export interface UserActivityItem {
  user_id: number;
  email: string;
  role: string;
  search_count: number;
  monitor_count: number;
  credits_consumed: number;
  last_active: string | null;
  country: string | null;
}

export interface UserActivityData {
  items: UserActivityItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface CostSummary {
  total_budget: number;
  total_spent: number;
  balance: number;
  total_api_calls: number;
  avg_cost_per_call: number;
  trend: TimeSeriesPoint[];
  range: string;
}

export interface GeoDistributionItem {
  country: string;
  count: number;
  percentage: number;
}

export interface GeoDistributionData {
  data: GeoDistributionItem[];
  total_with_geo: number;
  total_without_geo: number;
}

export interface TopRouteItem {
  origin: string;
  destination: string;
  count: number;
}

export interface AdminBudgetRecord {
  id: number;
  amount_usd: number;
  provider: string;
  description: string | null;
  created_at: string;
}

export interface AdminAuditLogItem {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface TotpSetupData {
  secret: string;
  provisioning_uri: string;
  qr_code_base64: string;
}

