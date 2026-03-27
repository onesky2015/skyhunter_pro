// filename: components/MonitorCard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { MonitorTask, TaskReportItem } from '../types';
import { formatPrice, timeAgoLocalized, getFrequencyBadge, remainingTimeLocalized, formatDateTime } from '../constants/utils';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

interface MonitorCardProps {
  task: MonitorTask;
  onPress?: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  /** 获取任务报告（用于展开报告栏） */
  onFetchReport?: (monitorId: number) => Promise<TaskReportItem[]>;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({
  task,
  onPress,
  onLongPress,
  onPauseResume,
  onDelete,
  onArchive,
  onFetchReport,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [reportData, setReportData] = useState<TaskReportItem[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const toggleReport = useCallback(async () => {
    if (!onFetchReport) return;
    if (reportExpanded) {
      setReportExpanded(false);
      return;
    }
    setReportLoading(true);
    try {
      const data = await onFetchReport(task.id);
      setReportData(data);
      setReportExpanded(true);
    } catch (e) {
      console.error('获取任务报告失败:', e);
    } finally {
      setReportLoading(false);
    }
  }, [onFetchReport, task.id, reportExpanded]);
  const isFound = task.status === 'found';
  const isExpired = task.status === 'expired';
  const isPaused = task.status === 'paused';
  const isArchived = task.status === 'archived';
  const borderColor = isFound
    ? theme.colors.success
    : isExpired
      ? theme.colors.textSoft
      : isPaused
        ? theme.colors.textMuted
        : isArchived
          ? theme.colors.textSoft
          : theme.colors.warning;
  const isRoundTrip = task.trip_type === 'round_trip';
  const isGlass = theme.name === 'glass';

  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      onLongPress();
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `${t('monitors', 'deleteConfirm').replace('{id}', String(task.id))}\n${t('monitors', 'deleteRoute').replace('{origin}', task.origin).replace('{destination}', task.destination)}`
      );
      if (confirmed && onDelete) onDelete();
    } else {
      Alert.alert(
        t('monitors', 'deleteConfirm').replace('{id}', String(task.id)),
        t('monitors', 'deleteRoute').replace('{origin}', task.origin).replace('{destination}', task.destination),
        [
          { text: t('common', 'cancel'), style: 'cancel' },
          { text: t('common', 'delete'), style: 'destructive', onPress: onDelete },
        ]
      );
    }
  }, [onLongPress, onDelete, task.id, task.origin, task.destination, t]);

  const cardBody = (
    <>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={onPress}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        <View style={styles.leftSection}>
          <View style={styles.routeRow}>
            <Text style={styles.indexText}>#{task.id}</Text>
            <Text style={styles.routeText}>
              {task.origin} {isRoundTrip ? '⇄' : '→'} {task.destination}
            </Text>
            {isRoundTrip && (
              <View style={styles.roundTripBadge}>
                <Text style={styles.roundTripBadgeText}>{t('common', 'round').toUpperCase()}</Text>
              </View>
            )}
          </View>
          {/* Phase 2: Frequency Badge + Remaining Time */}
          <View style={styles.badgeRow}>
            <View style={styles.freqBadge}>
              <Text style={styles.freqBadgeText}>{getFrequencyBadge(task.interval_minutes || 240)}</Text>
            </View>
            {task.end_date && (
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>⏳ {remainingTimeLocalized(task.end_date, t)}</Text>
              </View>
            )}
            {task.total_credits_deducted > 0 && (
              <View style={styles.creditBadge}>
                <Text style={styles.creditBadgeText}>💎 {task.total_credits_deducted}</Text>
              </View>
            )}
          </View>

          <Text style={styles.dateText}>
            {task.start_date}
            {isRoundTrip && task.return_date ? ` ↩ ${task.return_date}` : ''}
            {task.target_price ? ` · ${t('common', 'target')}: $${task.target_price}` : ''}
          </Text>
          <Text style={styles.metaText}>
            {task.cabin_class === 'economy'
              ? `💺 ${t('search', 'economy')}`
              : task.cabin_class === 'premium_economy'
              ? `💺+ ${t('search', 'premiumEconomy')}`
              : task.cabin_class === 'business'
              ? `💼 ${t('search', 'business')}`
              : `💎 ${t('search', 'first')}`}
            {' · '}
            {'👥 '}{task.adults}{task.children > 0 ? `+${task.children}` : ''}
            {task.airline_include ? ` · ✈ ${task.airline_include}` : ''}
          </Text>

          {/* 价格详情：总价、单人价、儿童、最近查询、邮件通知 */}
          <View style={styles.priceDetailBlock}>
            <Text style={styles.priceDetailTitle}>💰 {t('monitors', 'priceDetail')}</Text>
            <View style={styles.priceDetailRow}>
              <Text style={styles.priceDetailLabel}>{t('monitors', 'totalPrice')}</Text>
              <Text style={styles.priceDetailValue}>
                {task.current_price != null ? formatPrice(task.current_price) : '---'}
              </Text>
            </View>
            {task.current_price != null && (task.adults + task.children) > 0 && (
              <View style={styles.priceDetailRow}>
                <Text style={styles.priceDetailLabel}>{t('monitors', 'pricePerPerson')}</Text>
                <Text style={styles.priceDetailValue}>
                  {formatPrice(task.current_price / (task.adults + task.children))}
                </Text>
              </View>
            )}
            {task.children > 0 && (
              <View style={styles.priceDetailRow}>
                <Text style={styles.priceDetailLabel}>{t('monitors', 'childrenCount')}</Text>
                <Text style={styles.priceDetailValue}>{task.children} 人</Text>
              </View>
            )}
            <View style={styles.priceDetailRow}>
              <Text style={styles.priceDetailLabel}>{t('monitors', 'lastChecked')}</Text>
              <Text style={styles.priceDetailValue}>
                {task.last_checked_at
                  ? `${formatDateTime(task.last_checked_at)} (${timeAgoLocalized(task.last_checked_at, t)})`
                  : t('monitors', 'pending')}
              </Text>
            </View>
            {task.status === 'found' && task.notification_email && (
              <View style={styles.priceDetailRow}>
                <Text style={styles.priceDetailLabel}>{t('monitors', 'emailNotified')}</Text>
                <Text style={[styles.priceDetailValue, styles.emailNotified]}>
                  {(task as MonitorTask & { email_notified_at?: string | null }).email_notified_at
                    ? `✅ ${t('monitors', 'sent')}`
                    : `✅ ${t('monitors', 'triggered')}`}
                </Text>
              </View>
            )}
          </View>

          {/* 高级筛选标签 */}
          {(task.max_stops !== null ||
            task.departure_time_min ||
            task.departure_time_max ||
            task.arrival_time_min ||
            task.arrival_time_max ||
            task.airline_include ||
            (task.sort_strategy && task.sort_strategy !== 'best')) && (
            <View style={styles.filterTagsRow}>
              {task.max_stops !== null && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>
                    {task.max_stops === 0
                      ? `🚫 ${t('common', 'direct')}`
                      : `✈️ ≤${task.max_stops} stop${task.max_stops > 1 ? 's' : ''}`}
                  </Text>
                </View>
              )}
              {(task.departure_time_min || task.departure_time_max) && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>
                    🛫 {task.departure_time_min || '00:00'}-{task.departure_time_max || '24:00'}
                  </Text>
                </View>
              )}
              {(task.arrival_time_min || task.arrival_time_max) && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>
                    🛬 {task.arrival_time_min || '00:00'}-{task.arrival_time_max || '24:00'}
                  </Text>
                </View>
              )}
              {task.airline_include && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>✈ {task.airline_include}</Text>
                </View>
              )}
              {task.sort_strategy && task.sort_strategy !== 'best' && (
                <View style={styles.filterTag}>
                  <Text style={styles.filterTagText}>💰 {t('common', 'cheapest')}</Text>
                </View>
              )}
            </View>
          )}

          {/* 行李信息 */}
          {task.baggage_info && (
            <Text style={styles.baggageText}>🧳 {task.baggage_info}</Text>
          )}
          {!task.baggage_info && (
            <Text style={styles.baggageText}>
              {'🧳 '}{task.cabin_class === 'economy'
                ? t('common', 'bagsIncluded')
                : task.cabin_class === 'business' || task.cabin_class === 'first'
                ? t('common', 'bagsIncluded2')
                : t('common', 'bagsIncluded')}
            </Text>
          )}
          <Text style={styles.checkedText}>
            {task.last_checked_at
              ? `${t('common', 'checked')}: ${timeAgoLocalized(task.last_checked_at, t)}`
              : t('common', 'pendingFirstCheck')}
          </Text>
        </View>

        <View style={styles.rightSection}>
          <Text
            style={[
              styles.priceText,
              isFound ? {} : !task.current_price ? { color: '#a1a1aa' } : {},
            ]}
          >
            {task.current_price != null ? formatPrice(task.current_price) : '---'}
          </Text>
          {task.airline && (
            <Text style={styles.airlineText}>{task.airline}</Text>
          )}
          {isFound ? (
            <View style={styles.badgeFound}>
              <Text style={styles.badgeFoundText}>{t('common', 'found')}</Text>
            </View>
          ) : isExpired ? (
            <View style={styles.badgeExpired}>
              <Text style={styles.badgeExpiredText}>{t('common', 'expired').toUpperCase()}</Text>
            </View>
          ) : isPaused ? (
            <View style={styles.badgePaused}>
              <Text style={styles.badgePausedText}>{t('monitors', 'paused').toUpperCase()}</Text>
            </View>
          ) : isArchived ? (
            <View style={styles.badgeArchived}>
              <Text style={styles.badgeArchivedText}>{t('common', 'archived').toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.badgeScanning}>
              <View style={styles.scanningDot} />
              <Text style={styles.badgeScanningText}>{t('common', 'active').toUpperCase()}</Text>
            </View>
          )}
          {/* Pause/Resume 按钮（found 也仍在监控中，允许暂停/恢复） */}
          {(task.status === 'active' || task.status === 'paused' || task.status === 'found') && onPauseResume && (
            <TouchableOpacity
              style={[
                styles.pauseResumeButton,
                task.status === 'paused' ? styles.resumeButton : styles.pauseButton,
              ]}
              onPress={onPauseResume}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pauseResumeText,
                  task.status === 'paused' ? styles.resumeText : styles.pauseText,
                ]}
              >
                {task.status === 'paused' ? `▶ ${t('common', 'resume').toUpperCase()}` : `⏸ ${t('common', 'pause').toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          )}
          {/* Phase 2: Archive 按钮（仅 expired 显示，found 仍在监控中不允许直接归档） */}
          {task.status === 'expired' && onArchive && (
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={onArchive}
              activeOpacity={0.7}
            >
              <Text style={styles.archiveButtonText}>📦 {t('common', 'archive').toUpperCase()}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* 任务报告栏（可展开） */}
      {onFetchReport && (
        <TouchableOpacity
          style={styles.reportToggle}
          onPress={toggleReport}
          activeOpacity={0.7}
        >
          <Text style={styles.reportToggleText}>
            📋 {t('monitors', 'taskReport')} {task.origin} → {task.destination}
          </Text>
          <Text style={styles.reportToggleArrow}>{reportExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
      )}
      {reportExpanded && (
        <View style={styles.reportPanel}>
          {reportLoading ? (
            <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginVertical: 16 }} />
          ) : reportData && reportData.length > 0 ? (
            <View style={styles.reportList}>
              {reportData.map((item, i) => (
                <View key={i} style={styles.reportItem}>
                  <Text style={styles.reportItemTime}>{formatDateTime(item.event_at)}</Text>
                  <Text style={styles.reportItemType}>
                    {item.event_type === 'price_check'
                      ? `价格检查 $${item.price?.toFixed(0) ?? '--'}`
                      : item.event_type === 'created'
                      ? '创建任务'
                      : item.event_type === 'paused'
                      ? '⏸ 暂停'
                      : item.event_type === 'resumed'
                      ? '▶ 恢复'
                      : item.event_type === 'found'
                      ? '✅ 达到目标价'
                      : item.event_type === 'expired'
                      ? '⏰ 已过期'
                      : item.event_type === 'archived'
                      ? '📦 已存档'
                      : item.event_type}
                  </Text>
                  {item.event_type === 'price_check' && item.previous_price != null && (
                    <Text style={styles.reportItemDelta}>
                      (上次 ${item.previous_price.toFixed(0)})
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.reportEmpty}>暂无记录</Text>
          )}
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.cardWrapper, isGlass && styles.cardWrapperGlass]}>
      {isGlass ? (
        <BlurView
          intensity={theme.effects.blurIntensity}
          tint={theme.effects.blurTint}
          style={[styles.card, styles.glassCard, { borderLeftColor: borderColor }]}
        >
          {cardBody}
        </BlurView>
      ) : (
        <View style={[styles.card, { borderLeftColor: borderColor }]}>
          {cardBody}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    cardWrapper: {
      marginBottom: 12,
      borderRadius: theme.radius.md,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.7 : 1),
    },
    cardWrapperGlass: {
      shadowOffset: { width: 0, height: 10 },
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderLeftWidth: 4,
      overflow: 'hidden',
      borderWidth: theme.name === 'glass' ? 1 : 0,
      borderColor: theme.colors.borderStrong,
    },
    glassCard: {
      backgroundColor: theme.colors.surface,
    },
    cardContent: {
      flexDirection: 'row',
      padding: 16,
    },
    leftSection: {
      flex: 1,
    },
    rightSection: {
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginLeft: 12,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      flexWrap: 'wrap',
      gap: 6,
    },
    indexText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
      minWidth: 28,
    },
    routeText: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
    },
    roundTripBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 8,
    },
    roundTripBadgeText: {
      color: theme.colors.accentText,
      fontSize: 8,
      fontWeight: '700',
    },
    dateText: {
      color: theme.colors.text,
      fontSize: 12,
      marginBottom: 4,
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginBottom: 8,
    },
    filterTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 8,
    },
    filterTag: {
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    filterTagText: {
      color: theme.colors.accent,
      fontSize: 9,
    },
    baggageText: {
      color: theme.colors.textSoft,
      fontSize: 10,
      marginBottom: 4,
    },
    checkedText: {
      color: theme.colors.textSoft,
      fontSize: 10,
    },
    priceText: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    airlineText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginBottom: 8,
    },
    badgeFound: {
      backgroundColor: theme.colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    badgeFoundText: {
      color: theme.colors.accentText,
      fontSize: 10,
      fontWeight: '700',
    },
    badgeExpired: {
      backgroundColor: theme.colors.textSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    badgeExpiredText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '700',
    },
    badgePaused: {
      backgroundColor: theme.colors.textMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    badgePausedText: {
      color: theme.colors.accentText,
      fontSize: 10,
      fontWeight: '700',
    },
    badgeScanning: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.warning,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    scanningDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accentText,
      marginRight: 4,
    },
    badgeScanningText: {
      color: theme.colors.accentText,
      fontSize: 10,
      fontWeight: '700',
    },
    pauseResumeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      minWidth: 80,
      alignItems: 'center',
    },
    pauseButton: {
      backgroundColor: theme.colors.warning,
    },
    resumeButton: {
      backgroundColor: theme.colors.accent,
    },
    pauseResumeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    pauseText: {
      color: theme.colors.accentText,
    },
    resumeText: {
      color: theme.colors.accentText,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 6,
      flexWrap: 'wrap',
    },
    freqBadge: {
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    freqBadgeText: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '700',
    },
    timeBadge: {
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    timeBadgeText: {
      color: theme.colors.warning,
      fontSize: 10,
      fontWeight: '600',
    },
    creditBadge: {
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    creditBadgeText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    badgeArchived: {
      backgroundColor: theme.colors.textSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    badgeArchivedText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '700',
    },
    archiveButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      minWidth: 80,
      alignItems: 'center',
      backgroundColor: theme.colors.textSoft,
      marginTop: 4,
    },
    archiveButtonText: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '700',
    },
    priceDetailBlock: {
      backgroundColor: theme.colors.surfaceAlt,
      padding: 10,
      borderRadius: theme.radius.sm,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    priceDetailTitle: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    priceDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    priceDetailLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    priceDetailValue: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '600',
    },
    emailNotified: {
      color: theme.colors.success,
    },
    reportToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.surfaceAlt,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    reportToggleText: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
    },
    reportToggleArrow: {
      color: theme.colors.textSoft,
      fontSize: 12,
    },
    reportPanel: {
      backgroundColor: theme.colors.surfaceAlt,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      maxHeight: 200,
    },
    reportList: {
      gap: 8,
    },
    reportItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    reportItemTime: {
      color: theme.colors.textSoft,
      fontSize: 10,
      minWidth: 70,
    },
    reportItemType: {
      color: theme.colors.accent,
      fontSize: 11,
      flex: 1,
    },
    reportItemDelta: {
      color: theme.colors.textMuted,
      fontSize: 10,
    },
    reportEmpty: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: 16,
    },
  });

