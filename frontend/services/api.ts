// filename: services/api.ts
import { API_URL, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../constants/api';
import { storage } from './storage';
import {
  UserInfo,
  MonitorTask,
  SearchResponse,
  AdminStats,
  AdminUser,
  AdminMonitor,
  SearchRequestPayload,
  MonitorCreatePayload,
  MonitorUpdatePayload,
  AirportSearchResult,
  AdminAirport,
  AdminAirportListResponse,
  AirportCsvUploadResult,
  AnalyticsOverview,
  UserTrendsData,
  ApiUsageTrendsData,
  UserActivityData,
  CostSummary,
  GeoDistributionData,
  AdminBudgetRecord,
  AdminAuditLogItem,
  TotpSetupData,
  TopRouteItem,
} from '../types';

/** 构建带 Authorization 的请求头 */
export const getAuthHeaders = (token: string | null, extra?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (extra) Object.assign(headers, extra);
  return headers;
};

/** 处理 401 自动登出：严格清除所有认证数据 */
export const handle401 = async (): Promise<void> => {
  try {
    await storage.removeItem(TOKEN_KEY);
    await storage.removeItem(REFRESH_TOKEN_KEY);
    await storage.removeItem(USER_KEY);
  } catch (e) {
    console.warn('[handle401] Failed to clear storage:', e);
  }
};

let _isRefreshing = false;
let _refreshPromise: Promise<string | null> | null = null;

/** 使用 refresh_token 获取新 access_token */
const tryRefreshToken = async (): Promise<string | null> => {
  const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    await storage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      await storage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    return data.access_token;
  } catch {
    return null;
  }
};

/** API 请求封装（带自动 token 刷新 + 401 处理） */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  token: string | null,
  on401?: () => void
): Promise<Response> => {
  const headers = getAuthHeaders(token, options.headers as Record<string, string>);
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && token) {
    if (!_isRefreshing) {
      _isRefreshing = true;
      _refreshPromise = tryRefreshToken().finally(() => {
        _isRefreshing = false;
        _refreshPromise = null;
      });
    }

    const newToken = await (_refreshPromise ?? tryRefreshToken());
    if (newToken) {
      const retryHeaders = getAuthHeaders(newToken, options.headers as Record<string, string>);
      return fetch(`${API_URL}${endpoint}`, { ...options, headers: retryHeaders });
    }

    await handle401();
    if (on401) on401();
  }

  return response;
};

// ========== 认证相关 API ==========

export interface SignupResult {
  requiresVerification: boolean;
  email: string;
  message: string;
}

export interface LoginResult {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

export const authApi = {
  /** 注册（返回验证要求，不再直接返回 Token） */
  signup: async (email: string, password: string, fullName?: string): Promise<SignupResult> => {
    const response = await fetch(`${API_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName || null }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      requiresVerification: data.requires_verification ?? true,
      email: data.email,
      message: data.message,
    };
  },

  /** 邮箱验证（验证成功后返回 Token） */
  verifyEmail: async (email: string, code: string): Promise<LoginResult> => {
    const response = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      token_type: data.token_type,
      expires_in: data.expires_in ?? 3600,
      user: {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name ?? null,
        role: data.role ?? 'user',
        credits: data.credits ?? 0,
      },
    };
  },

  /** 重发邮箱验证码 */
  resendVerification: async (email: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 登录（OAuth2 表单格式），未验证邮箱时抛出特殊错误，TOTP 启用时需二次验证 */
  login: async (email: string, password: string, totpCode?: string): Promise<LoginResult> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (totpCode) {
      headers['X-TOTP-Code'] = totpCode;
    }
    const response = await fetch(`${API_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers,
      body: formData.toString(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      const detail = err?.detail || `HTTP ${response.status}`;
      if (response.status === 403 && detail === 'Email not verified') {
        const error = new Error(detail);
        (error as any).requiresVerification = true;
        (error as any).email = email;
        throw error;
      }
      if (response.status === 403 && detail === 'TOTP code required') {
        const error = new Error(detail);
        (error as any).requiresTotp = true;
        (error as any).email = email;
        (error as any).password = password;
        throw error;
      }
      throw new Error(detail);
    }
    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      token_type: data.token_type,
      expires_in: data.expires_in ?? 3600,
      user: {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name ?? null,
        role: data.role ?? 'user',
        credits: data.credits ?? 0,
      },
    };
  },

  /** 忘记密码 */
  forgotPassword: async (email: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 重置密码（验证码 + 新密码） */
  resetPassword: async (email: string, token: string, newPassword: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, new_password: newPassword }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 修改密码（已登录用户，需提供当前密码） */
  changePassword: async (
    token: string | null,
    oldPassword: string,
    newPassword: string,
    on401?: () => void
  ): Promise<void> => {
    const response = await apiRequest(
      '/api/v1/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 删除账号（需要密码二次确认） */
  deleteAccount: async (
    token: string | null,
    password: string,
    on401?: () => void
  ): Promise<void> => {
    const response = await apiRequest(
      '/api/v1/auth/delete-account',
      {
        method: 'POST',
        body: JSON.stringify({ password }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** Apple OAuth 登录 */
  oauthApple: async (idToken: string, fullName?: string): Promise<LoginResult> => {
    const response = await fetch(`${API_URL}/api/v1/auth/oauth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, full_name: fullName || null }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      token_type: data.token_type,
      expires_in: data.expires_in ?? 3600,
      user: {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name ?? null,
        role: data.role ?? 'user',
        credits: data.credits ?? 0,
      },
    };
  },

  /** Google OAuth 登录 */
  oauthGoogle: async (idToken: string): Promise<LoginResult> => {
    const response = await fetch(`${API_URL}/api/v1/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? null,
      token_type: data.token_type,
      expires_in: data.expires_in ?? 3600,
      user: {
        user_id: data.user_id,
        email: data.email,
        full_name: data.full_name ?? null,
        role: data.role ?? 'user',
        credits: data.credits ?? 0,
      },
    };
  },

  /** 登出（撤销 refresh token） */
  serverLogout: async (): Promise<void> => {
    const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // best-effort
      }
    }
  },
};

// ========== 用户相关 API ==========

export const userApi = {
  /** 获取当前用户信息 */
  getMe: async (token: string | null, on401?: () => void): Promise<UserInfo> => {
    const response = await apiRequest('/api/v1/users/me', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      user_id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      credits: data.credits ?? 0,
    };
  },

  /** 注册推送通知 token */
  registerPushToken: async (token: string | null, pushToken: string, platform: string, on401?: () => void): Promise<void> => {
    await apiRequest(
      '/api/v1/users/push-token',
      {
        method: 'POST',
        body: JSON.stringify({ token: pushToken, platform }),
      },
      token,
      on401
    );
  },

  /** Mock 充值积分 */
  topup: async (token: string | null, amount: number = 50, on401?: () => void): Promise<{ credits_added: number; credits_total: number }> => {
    const response = await apiRequest(
      '/api/v1/users/topup',
      {
        method: 'POST',
        body: JSON.stringify({ amount }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// ========== 搜索相关 API ==========

export const searchApi = {
  /** 执行搜索 */
  search: async (
    token: string | null,
    params: SearchRequestPayload,
    on401?: () => void
  ): Promise<SearchResponse> => {
    const response = await apiRequest(
      '/api/v1/search',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 询价 */
  quote: async (
    token: string | null,
    days: number,
    on401?: () => void
  ): Promise<{ cost: number; user_credits: number; sufficient: boolean }> => {
    const response = await apiRequest(
      '/api/v1/quote/search',
      {
        method: 'POST',
        body: JSON.stringify({ days }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// ========== 监控任务相关 API ==========

export const monitorApi = {
  /** 获取监控任务列表（Phase 2: 支持 include_archived 参数） */
  getMonitors: async (token: string | null, on401?: () => void, includeArchived: boolean = false): Promise<MonitorTask[]> => {
    const query = includeArchived ? '?include_archived=true' : '';
    const response = await apiRequest(`/api/v1/monitors${query}`, {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 创建监控任务 */
  createMonitor: async (token: string | null, params: MonitorCreatePayload, on401?: () => void): Promise<MonitorTask> => {
    const response = await apiRequest(
      '/api/v1/monitors',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 更新监控任务 */
  updateMonitor: async (token: string | null, id: number, params: MonitorUpdatePayload, on401?: () => void): Promise<MonitorTask> => {
    const response = await apiRequest(
      `/api/v1/monitors/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(params),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 删除监控任务（软删除） */
  deleteMonitor: async (token: string | null, id: number, on401?: () => void): Promise<void> => {
    const response = await apiRequest(
      `/api/v1/monitors/${id}`,
      { method: 'DELETE' },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 恢复监控任务 */
  restoreMonitor: async (token: string | null, id: number, on401?: () => void): Promise<void> => {
    const response = await apiRequest(
      `/api/v1/monitors/${id}/restore`,
      { method: 'POST' },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 获取回收站列表 */
  getTrash: async (token: string | null, on401?: () => void): Promise<MonitorTask[]> => {
    const response = await apiRequest('/api/v1/monitors/trash', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 获取任务报告（价格历史 + 状态变更） */
  getTaskReport: async (
    token: string | null,
    monitorId: number,
    on401?: () => void,
    limit?: number
  ): Promise<import('../types').TaskReportItem[]> => {
    const q = limit != null ? `?limit=${limit}` : '';
    const response = await apiRequest(`/api/v1/monitors/${monitorId}/report${q}`, {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 更新监控任务状态 */
  updateStatus: async (token: string | null, id: number, status: string, on401?: () => void): Promise<MonitorTask> => {
    const response = await apiRequest(
      `/api/v1/monitors/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// ========== Admin 相关 API ==========

export const adminApi = {
  /** 获取统计数据 */
  getStats: async (token: string | null, on401?: () => void): Promise<AdminStats> => {
    const response = await apiRequest('/api/v1/admin/stats', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 获取系统配置 */
  getConfigs: async (token: string | null, on401?: () => void): Promise<any[]> => {
    const response = await apiRequest('/api/v1/admin/configs', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 更新系统配置 */
  setConfig: async (token: string | null, key: string, value: string, description?: string, on401?: () => void): Promise<any> => {
    const response = await apiRequest('/api/v1/admin/configs', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description }),
    }, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 获取用户列表 */
  getUsers: async (token: string | null, on401?: () => void): Promise<AdminUser[]> => {
    const response = await apiRequest('/api/v1/admin/users', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 获取监控任务列表 */
  getMonitors: async (token: string | null, on401?: () => void): Promise<AdminMonitor[]> => {
    const response = await apiRequest('/api/v1/admin/monitors', {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 调整用户积分 */
  adjustCredits: async (token: string | null, userId: number, amount: number, on401?: () => void): Promise<{ credits_after: number }> => {
    const response = await apiRequest(
      `/api/v1/admin/users/${userId}/credits`,
      {
        method: 'POST',
        body: JSON.stringify({ amount }),
      },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 删除用户 */
  deleteUser: async (token: string | null, userId: number, on401?: () => void): Promise<void> => {
    const response = await apiRequest(
      `/api/v1/admin/users/${userId}`,
      { method: 'DELETE' },
      token,
      on401
    );
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
  },

  /** 获取机场列表（分页+搜索） */
  getAirports: async (
    token: string | null,
    params: { page?: number; page_size?: number; q?: string; show_disabled?: boolean },
    on401?: () => void,
  ): Promise<AdminAirportListResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.q) query.set('q', params.q);
    if (params.show_disabled !== undefined) query.set('show_disabled', String(params.show_disabled));
    const response = await apiRequest(`/api/v1/admin/airports?${query}`, {}, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 手动添加机场 */
  createAirport: async (token: string | null, data: Partial<AdminAirport>, on401?: () => void): Promise<AdminAirport> => {
    const response = await apiRequest('/api/v1/admin/airports', {
      method: 'POST',
      body: JSON.stringify(data),
    }, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 编辑机场 */
  updateAirport: async (token: string | null, airportId: number, data: Partial<AdminAirport>, on401?: () => void): Promise<AdminAirport> => {
    const response = await apiRequest(`/api/v1/admin/airports/${airportId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  /** 上传 CSV 文件 */
  uploadAirportsCsv: async (token: string | null, file: File, on401?: () => void): Promise<AirportCsvUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/api/v1/admin/airports/upload-csv`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (response.status === 401) {
      await handle401();
      if (on401) on401();
    }
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },
};

// ========== 机场搜索 API（公开，无需认证） ==========

export const airportApi = {
  /** 根据关键词搜索机场（支持 IATA 代码、城市名、机场名） */
  search: async (query: string, limit: number = 10): Promise<AirportSearchResult[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
    const response = await fetch(`${API_URL}/api/v1/airports/search?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    return response.json();
  },
};

// ========== Admin Analytics API ==========

export const analyticsApi = {
  getOverview: async (token: string | null, on401?: () => void): Promise<AnalyticsOverview> => {
    const response = await apiRequest('/api/v1/admin/analytics/overview', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getUserTrends: async (token: string | null, range: string = 'day', on401?: () => void): Promise<UserTrendsData> => {
    const response = await apiRequest(`/api/v1/admin/analytics/user-trends?range=${range}`, {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getApiUsage: async (token: string | null, range: string = 'day', on401?: () => void): Promise<ApiUsageTrendsData> => {
    const response = await apiRequest(`/api/v1/admin/analytics/api-usage?range=${range}`, {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getUserActivity: async (
    token: string | null,
    params: { page?: number; page_size?: number; q?: string } = {},
    on401?: () => void,
  ): Promise<UserActivityData> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.q) query.set('q', params.q);
    const response = await apiRequest(`/api/v1/admin/analytics/user-activity?${query}`, {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getCosts: async (token: string | null, range: string = 'day', on401?: () => void): Promise<CostSummary> => {
    const response = await apiRequest(`/api/v1/admin/analytics/costs?range=${range}`, {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getGeo: async (token: string | null, on401?: () => void): Promise<GeoDistributionData> => {
    const response = await apiRequest('/api/v1/admin/analytics/geo', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getTopRoutes: async (token: string | null, on401?: () => void): Promise<{ data: TopRouteItem[] }> => {
    const response = await apiRequest('/api/v1/admin/analytics/top-routes', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  addBudget: async (
    token: string | null,
    data: { amount_usd: number; provider?: string; description?: string },
    on401?: () => void,
  ): Promise<AdminBudgetRecord> => {
    const response = await apiRequest('/api/v1/admin/budget', {
      method: 'POST', body: JSON.stringify(data),
    }, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  getBudgets: async (token: string | null, on401?: () => void): Promise<AdminBudgetRecord[]> => {
    const response = await apiRequest('/api/v1/admin/budget', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getAuditLog: async (token: string | null, on401?: () => void): Promise<AdminAuditLogItem[]> => {
    const response = await apiRequest('/api/v1/admin/audit-log', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  setupTotp: async (token: string | null, on401?: () => void): Promise<TotpSetupData> => {
    const response = await apiRequest('/api/v1/admin/security/totp/setup', { method: 'POST' }, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  verifyTotp: async (token: string | null, code: string, on401?: () => void): Promise<{ message: string }> => {
    const response = await apiRequest('/api/v1/admin/security/totp/verify', {
      method: 'POST', body: JSON.stringify({ code }),
    }, token, on401);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  disableTotp: async (token: string | null, on401?: () => void): Promise<{ message: string }> => {
    const response = await apiRequest('/api/v1/admin/security/totp/disable', { method: 'POST' }, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  getTotpStatus: async (token: string | null, on401?: () => void): Promise<{ totp_enabled: boolean }> => {
    const response = await apiRequest('/api/v1/admin/security/totp/status', {}, token, on401);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },

  exportCsv: async (token: string | null, type: 'users' | 'api-usage' | 'costs' | 'audit-log', range?: string): Promise<string> => {
    let url = `/api/v1/admin/export/${type}`;
    if (range && type !== 'users' && type !== 'audit-log') {
      url += `?range=${range}`;
    }
    const response = await apiRequest(url, {}, token);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  },
};

