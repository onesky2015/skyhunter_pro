// filename: constants/utils.ts
import { HeatmapCell } from '../types';

export const getLevelColor = (level: HeatmapCell['level']): string => {
  switch (level) {
    case 'low': return '#00FF00';
    case 'medium': return '#FFD700';
    case 'high': return '#FF4444';
    default: return '#333333';
  }
};

export const getLevelOpacity = (level: HeatmapCell['level']): number => {
  switch (level) {
    case 'low': return 0.85;
    case 'medium': return 0.9;
    case 'high': return 0.9;
    default: return 0.3;
  }
};

export const formatPrice = (price: number | null | undefined): string => {
  if (price == null) return '---';
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const formatDuration = (minutes: number | null): string => {
  if (minutes == null) return '--';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/** 获取默认日期：30天后 */
export const getDefaultStartDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

/** 获取默认返程日期：37天后 */
export const getDefaultReturnDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 37);
  return d.toISOString().split('T')[0];
};

export const getDayFromDate = (dateStr: string): string => dateStr.split('-')[2] || '';

/** 将分钟数转为 HH:MM 格式 */
export const minutesToTimeStr = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/** 将 HH:MM 格式转为分钟数，非法输入返回 null */
export const timeStrToMinutes = (timeStr: string | null | undefined): number | null => {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * 将后端返回的 ISO 时间字符串标准化为 UTC。
 * 后端使用 datetime.utcnow().isoformat() 生成时间，但不含时区后缀，
 * JavaScript 会将无时区的 ISO 字符串解释为本地时间，导致时差偏移。
 */
const ensureUTC = (isoStr: string): string => {
  if (/[Zz]$/.test(isoStr) || /[+-]\d{2}:\d{2}$/.test(isoStr)) return isoStr;
  return isoStr + 'Z';
};

/** 格式化 ISO 时间为本地日期时间 */
export const formatDateTime = (isoStr: string | null): string => {
  if (!isoStr) return '--';
  try {
    const d = new Date(ensureUTC(isoStr));
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
};

/** 计算距今多久（友好显示） */
export const timeAgo = (isoStr: string | null): string => {
  if (!isoStr) return 'Never';
  try {
    const then = new Date(ensureUTC(isoStr)).getTime();
    if (isNaN(then)) return 'Unknown';
    const now = Date.now();
    const diffMs = now - then;
    if (diffMs < 0) return 'Just now';
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'Unknown';
  }
};

/** 计算距今多久（i18n 友好显示） */
export type TFunc = (section: string, key: string) => string;
export const timeAgoLocalized = (isoStr: string | null, t: TFunc): string => {
  if (!isoStr) return t('common', 'never');
  try {
    const then = new Date(ensureUTC(isoStr)).getTime();
    if (isNaN(then)) return t('common', 'unknown');
    const now = Date.now();
    const diffMs = now - then;
    if (diffMs < 0) return t('common', 'justNow');
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('common', 'justNow');
    if (diffMin < 60) return t('common', 'minAgo').replace('{n}', String(diffMin));
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t('common', 'hoursAgo').replace('{n}', String(diffHr));
    const diffDay = Math.floor(diffHr / 24);
    return t('common', 'daysAgo').replace('{n}', String(diffDay));
  } catch {
    return t('common', 'unknown');
  }
};

export interface AirlineOption {
  value: string;
  label: string;
  type: 'alliance' | 'airline';
}

export const AIRLINE_OPTIONS: AirlineOption[] = [
  // 联盟
  { value: '', label: '✈ Any Airline', type: 'alliance' },
  { value: 'Star Alliance', label: '⭐ Star Alliance', type: 'alliance' },
  { value: 'SkyTeam', label: '🔷 SkyTeam', type: 'alliance' },
  { value: 'Oneworld', label: '🌐 Oneworld', type: 'alliance' },
  // 主要航司
  { value: 'UA', label: '🇺🇸 United Airlines (UA)', type: 'airline' },
  { value: 'SQ', label: '🇸🇬 Singapore Airlines (SQ)', type: 'airline' },
  { value: 'DL', label: '🇺🇸 Delta Air Lines (DL)', type: 'airline' },
  { value: 'BA', label: '🇬🇧 British Airways (BA)', type: 'airline' },
  { value: 'EK', label: '🇦🇪 Emirates (EK)', type: 'airline' },
  { value: 'CX', label: '🇭🇰 Cathay Pacific (CX)', type: 'airline' },
  { value: 'MU', label: '🇨🇳 China Eastern (MU)', type: 'airline' },
  { value: 'CA', label: '🇨🇳 Air China (CA)', type: 'airline' },
];

/** 计算搜索费用（与后端保持一致） */
export const calculateSearchCost = (days: number): number => {
  return days === 1 ? 1 : 5;
};

// ============================================================================
// Phase 2: 监控频率/时长/计费常量
// ============================================================================

/** 频率选项（与后端 monitor_frequency_tiers 对齐） */
export interface FrequencyOption {
  value: number;
  label: string;
  emoji: string;
  desc: string;
}

export const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 10,   label: 'Turbo',    emoji: '⚡', desc: 'Every 10 min' },
  { value: 30,   label: 'Express',  emoji: '🚀', desc: 'Every 30 min' },
  { value: 60,   label: 'Fast',     emoji: '⏩', desc: 'Every 1 hour' },
  { value: 240,  label: 'Standard', emoji: '📊', desc: 'Every 4 hours' },
  { value: 720,  label: 'Eco',      emoji: '🌿', desc: 'Every 12 hours' },
  { value: 1440, label: 'Daily',    emoji: '📅', desc: 'Every 24 hours' },
];

/** 时长选项（天） */
export const DURATION_OPTIONS = [
  { value: 3,  label: '3 Days' },
  { value: 5,  label: '5 Days' },
  { value: 7,  label: '7 Days' },
  { value: 14, label: '14 Days' },
  { value: 30, label: '30 Days' },
];

/**
 * 动态计算监控费用（与后端公式一致）
 * Formula: ceil((duration_days * 24 * 60 / interval_minutes) * 0.1)
 */
export const calculateMonitorCost = (durationDays: number, intervalMinutes: number): number => {
  const totalMinutes = durationDays * 24 * 60;
  return Math.max(1, Math.ceil((totalMinutes / intervalMinutes) * 0.1));
};

/**
 * 计算修改频率时需补扣的积分（仅当提高频率时 > 0）
 * 基于剩余监控时长计算，与后端公式一致
 */
export const calculateFrequencyChangeCost = (
  endDateIso: string | null,
  oldIntervalMinutes: number,
  newIntervalMinutes: number
): number => {
  if (!endDateIso || newIntervalMinutes >= oldIntervalMinutes) return 0;
  try {
    const endMs = new Date(ensureUTC(endDateIso)).getTime();
    if (isNaN(endMs)) return 0;
    const nowMs = Date.now();
    const remainingMs = Math.max(0, endMs - nowMs);
    const remainingMinutes = remainingMs / (1000 * 60);
    const oldCost = Math.ceil((remainingMinutes / oldIntervalMinutes) * 0.1);
    const newCost = Math.ceil((remainingMinutes / newIntervalMinutes) * 0.1);
    return Math.max(0, newCost - oldCost);
  } catch {
    return 0;
  }
};

/** 计算剩余时间友好显示 */
export const remainingTime = (endDateIso: string | null): string => {
  if (!endDateIso) return 'No end date';
  try {
    const end = new Date(ensureUTC(endDateIso)).getTime();
    if (isNaN(end)) return 'Unknown';
    const now = Date.now();
    const diffMs = end - now;
    if (diffMs <= 0) return 'Expired';
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffHr < 1) return `${Math.floor(diffMs / 60000)}m left`;
    if (diffHr < 24) return `${diffHr}h left`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d left`;
  } catch {
    return 'Unknown';
  }
};

/** 计算剩余时间（i18n 友好显示） */
export const remainingTimeLocalized = (endDateIso: string | null, t: TFunc): string => {
  if (!endDateIso) return t('common', 'noEndDate');
  try {
    const end = new Date(ensureUTC(endDateIso)).getTime();
    if (isNaN(end)) return t('common', 'unknown');
    const now = Date.now();
    const diffMs = end - now;
    if (diffMs <= 0) return t('common', 'expired');
    const diffHr = Math.floor(diffMs / 3600000);
    if (diffHr < 1) return t('common', 'minLeft').replace('{n}', String(Math.floor(diffMs / 60000)));
    if (diffHr < 24) return t('common', 'hoursLeft').replace('{n}', String(diffHr));
    const diffDay = Math.floor(diffHr / 24);
    return t('common', 'daysLeft').replace('{n}', String(diffDay));
  } catch {
    return t('common', 'unknown');
  }
};

/** 获取频率标签（简短形式） */
export const getFrequencyBadge = (minutes: number): string => {
  const opt = FREQUENCY_OPTIONS.find(o => o.value === minutes);
  if (!opt) return `${minutes}m`;
  if (minutes < 60) return `${opt.emoji} ${minutes}m`;
  if (minutes < 1440) return `${opt.emoji} ${minutes / 60}h`;
  return `${opt.emoji} 24h`;
};

