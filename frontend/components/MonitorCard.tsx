// filename: components/MonitorCard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { MonitorTask, TaskReportItem } from '../types';
import { formatPrice, timeAgoLocalized, getFrequencyBadge, remainingTimeLocalized, formatDateTime } from '../constants/utils';
import { useI18n } from '../i18n';

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
  const borderColor = isFound ? '#00FF00' : isExpired ? '#666' : isPaused ? '#888' : isArchived ? '#555' : '#EAB308';
  const isRoundTrip = task.trip_type === 'round_trip';

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

  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
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
            <ActivityIndicator size="small" color="#00FF00" style={{ marginVertical: 16 }} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111111',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
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
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 28,
  },
  routeText: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
  },
  roundTripBadge: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  roundTripBadgeText: {
    color: '#000000',
    fontSize: 8,
    fontWeight: '700',
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  metaText: {
    color: '#999999',
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
    backgroundColor: '#222222',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  filterTagText: {
    color: '#00FF00',
    fontSize: 9,
  },
  baggageText: {
    color: '#666666',
    fontSize: 10,
    marginBottom: 4,
  },
  checkedText: {
    color: '#666666',
    fontSize: 10,
  },
  priceText: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  airlineText: {
    color: '#999999',
    fontSize: 10,
    marginBottom: 8,
  },
  badgeFound: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeFoundText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeExpired: {
    backgroundColor: '#666666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeExpiredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  badgePaused: {
    backgroundColor: '#888888',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgePausedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeScanning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAB308',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  scanningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
    marginRight: 4,
  },
  badgeScanningText: {
    color: '#000000',
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
    backgroundColor: '#FFD700',
  },
  resumeButton: {
    backgroundColor: '#00FF00',
  },
  pauseResumeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pauseText: {
    color: '#000000',
  },
  resumeText: {
    color: '#000000',
  },
  // Phase 2: Frequency/Time/Credit badges
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  freqBadge: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  freqBadgeText: {
    color: '#00FF00',
    fontSize: 10,
    fontWeight: '700',
  },
  timeBadge: {
    backgroundColor: '#2E2E1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  timeBadgeText: {
    color: '#EAB308',
    fontSize: 10,
    fontWeight: '600',
  },
  creditBadge: {
    backgroundColor: '#1A2E1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  creditBadgeText: {
    color: '#999999',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeArchived: {
    backgroundColor: '#555555',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeArchivedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  archiveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    backgroundColor: '#555555',
    marginTop: 4,
  },
  archiveButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  // 价格详情块
  priceDetailBlock: {
    backgroundColor: '#1A1A1A',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  priceDetailTitle: {
    color: '#00FF00',
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
    color: '#999999',
    fontSize: 11,
  },
  priceDetailValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  emailNotified: {
    color: '#00FF00',
  },
  // 任务报告
  reportToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  reportToggleText: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: '600',
  },
  reportToggleArrow: {
    color: '#666666',
    fontSize: 12,
  },
  reportPanel: {
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#222222',
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
    borderBottomColor: '#1A1A1A',
  },
  reportItemTime: {
    color: '#666666',
    fontSize: 10,
    minWidth: 70,
  },
  reportItemType: {
    color: '#00FF00',
    fontSize: 11,
    flex: 1,
  },
  reportItemDelta: {
    color: '#999999',
    fontSize: 10,
  },
  reportEmpty: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

