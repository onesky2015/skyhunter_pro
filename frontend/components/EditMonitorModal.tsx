// filename: components/EditMonitorModal.tsx
/**
 * Phase 2: 编辑监控任务 Modal（含频率修改 + 积分消耗变化警告）
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DatePicker } from './DatePicker';
import { MonitorTask, MonitorUpdatePayload } from '../types';
import { FREQUENCY_OPTIONS, DURATION_OPTIONS, getFrequencyBadge, calculateFrequencyChangeCost, calculateMonitorCost } from '../constants/utils';
import { useI18n } from '../i18n';

interface EditMonitorModalProps {
  visible: boolean;
  onClose: () => void;
  monitor: MonitorTask | null;
  onSubmit: (id: number, params: MonitorUpdatePayload) => Promise<boolean>;
  userCredits?: number;
  onTopUp?: () => void;
}

export const EditMonitorModal: React.FC<EditMonitorModalProps> = ({
  visible,
  onClose,
  monitor,
  onSubmit,
  userCredits = 0,
  onTopUp,
}) => {
  const { t } = useI18n();
  const [targetPrice, setTargetPrice] = useState('');
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(240);
  const [excludedAirlines, setExcludedAirlines] = useState('');
  const [extendDays, setExtendDays] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (monitor) {
      setTargetPrice(monitor.target_price?.toString() || '');
      setEmail(monitor.notification_email || '');
      setStartDate(monitor.start_date);
      setReturnDate(monitor.return_date || '');
      setIntervalMinutes(monitor.interval_minutes || 240);
      setExcludedAirlines(monitor.excluded_airlines || '');
      setExtendDays(0);
    }
  }, [monitor]);

  const frequencyChanged = monitor && intervalMinutes !== (monitor.interval_minutes || 240);

  const handleSubmit = async () => {
    if (!monitor) return;

    const body: MonitorUpdatePayload = {};
    const trimmedTargetPrice = targetPrice.trim();
    const trimmedEmail = email.trim();
    const trimmedStartDate = startDate.trim();
    const trimmedReturnDate = returnDate.trim();

    // 更新目标价格：允许清空，非法输入直接提示
    if (trimmedTargetPrice === '') {
      body.target_price = null;
    } else {
      const tp = parseFloat(trimmedTargetPrice);
      if (!isNaN(tp) && tp > 0) {
        if (tp !== monitor.target_price) {
          body.target_price = tp;
        }
      } else {
        Alert.alert(t('common', 'error'), t('monitors', 'targetPricePositive'));
        return;
      }
    }

    // 更新通知邮箱：允许清空
    if (trimmedEmail === '') {
      body.notification_email = null;
    } else if (trimmedEmail !== monitor.notification_email) {
      body.notification_email = trimmedEmail;
    }

    // 更新日期：仅在格式有效且值变化时提交
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedStartDate)) {
      Alert.alert(t('common', 'error'), t('monitors', 'dateFormatYYYYMMDD'));
      return;
    }
    if (trimmedStartDate !== monitor.start_date) body.start_date = trimmedStartDate;

    if (monitor.trip_type === 'round_trip') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedReturnDate)) {
        Alert.alert(t('common', 'error'), t('monitors', 'returnDateFormat'));
        return;
      }
      if (trimmedReturnDate <= trimmedStartDate) {
        Alert.alert(t('common', 'error'), t('monitors', 'returnAfterDeparture'));
        return;
      }
      if (trimmedReturnDate !== (monitor.return_date || '')) {
        body.return_date = trimmedReturnDate;
      }
    }

    // Phase 2: 更新频率 — 若提高频率需补扣积分，先弹窗确认
    if (frequencyChanged) {
      const costToDeduct = calculateFrequencyChangeCost(
        monitor.end_date,
        monitor.interval_minutes || 240,
        intervalMinutes
      );
      if (costToDeduct > 0) {
        const remaining = userCredits - costToDeduct;
        const canContinue = remaining >= 0;
        const msg = `修改监控频率将扣除 ${costToDeduct} 积分\n\n当前积分: ${userCredits}\n扣除后剩余: ${remaining}${!canContinue ? '\n\n积分不足，请先充值' : ''}`;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          if (!canContinue) {
            const goTopUp = window.confirm(`${msg}\n\n点击「确定」去充值 | 点击「取消」放弃`);
            if (goTopUp && onTopUp) onTopUp();
            return;
          }
          const choice = window.confirm(`${msg}\n\n点击「确定」继续 | 点击「取消」放弃修改`);
          if (!choice) return;
        } else {
          const result = await new Promise<'continue' | 'cancel' | 'topup'>((resolve) => {
            const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
              { text: '取消', style: 'cancel', onPress: () => resolve('cancel') },
            ];
            if (canContinue) {
              buttons.push({ text: '继续', onPress: () => resolve('continue') });
            }
            if (onTopUp) {
              buttons.push({ text: '去充值', onPress: () => resolve('topup') });
            }
            Alert.alert('💎 积分扣除确认', msg, buttons, {
              cancelable: true,
              onDismiss: () => resolve('cancel'),
            });
          });
          if (result === 'cancel') return;
          if (result === 'topup') {
            onTopUp?.();
            return;
          }
          if (result === 'continue' && !canContinue) return;
        }
      }
      body.interval_minutes = intervalMinutes;
    }

    // 更新排除航司
    const trimmedExcluded = excludedAirlines.trim().replace(/\s+/g, ',').replace(/,+/g, ',') || null;
    if (trimmedExcluded !== (monitor.excluded_airlines || '')) {
      body.excluded_airlines = trimmedExcluded;
    }

    // 延长监控天数：需补扣积分，弹窗确认
    if (extendDays > 0) {
      const extendCost = calculateMonitorCost(extendDays, intervalMinutes);
      const remaining = userCredits - extendCost;
      const canContinue = remaining >= 0;

      // 计算延长后新 end_date 用于提示
      let newEndDateStr = '';
      if (monitor.end_date) {
        const endMs = new Date(monitor.end_date).getTime() + extendDays * 24 * 60 * 60 * 1000;
        newEndDateStr = new Date(endMs).toISOString().slice(0, 10);
      }
      const msg = `延长监控 ${extendDays} 天将扣除 ${extendCost} 积分\n\n当前积分: ${userCredits}\n扣除后剩余: ${remaining}${newEndDateStr ? `\n新到期日: ${newEndDateStr}` : ''}${!canContinue ? '\n\n积分不足，请先充值' : ''}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (!canContinue) {
          const goTopUp = window.confirm(`${msg}\n\n点击「确定」去充值 | 点击「取消」放弃`);
          if (goTopUp && onTopUp) onTopUp();
          return;
        }
        const choice = window.confirm(`${msg}\n\n点击「确定」继续 | 点击「取消」放弃`);
        if (!choice) return;
      } else {
        const result = await new Promise<'continue' | 'cancel' | 'topup'>((resolve) => {
          const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
            { text: '取消', style: 'cancel', onPress: () => resolve('cancel') },
          ];
          if (canContinue) buttons.push({ text: '继续', onPress: () => resolve('continue') });
          if (onTopUp) buttons.push({ text: '去充值', onPress: () => resolve('topup') });
          Alert.alert('💎 积分扣除确认', msg, buttons, {
            cancelable: true,
            onDismiss: () => resolve('cancel'),
          });
        });
        if (result === 'cancel') return;
        if (result === 'topup') { onTopUp?.(); return; }
        if (result === 'continue' && !canContinue) return;
      }
      body.extend_days = extendDays;
    }

    // 没有实际变更时不发请求，避免无意义刷新
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setSubmitting(true);
    const success = await onSubmit(monitor.id, body);
    setSubmitting(false);
    if (success) {
      onClose();
    }
  };

  if (!monitor) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('monitors', 'editMonitorTitle')}</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.routeText}>
              {monitor.origin} → {monitor.destination}
            </Text>

            <View style={styles.lockedInfoBox}>
              <Text style={styles.lockedInfoText}>
                {t('monitors', 'lockedFieldsNote')}
              </Text>
            </View>

            {/* Dates */}
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              label={t('search', 'departureDate')}
              style={styles.inputGroup}
            />

            {monitor.trip_type === 'round_trip' && (
              <DatePicker
                value={returnDate}
                onChange={setReturnDate}
                label={t('search', 'returnDate')}
                style={styles.inputGroup}
              />
            )}

            {/* Phase 2: Frequency Selector */}
            <Text style={styles.label}>{t('monitors', 'checkFrequency')}</Text>
            <View style={styles.frequencyGrid}>
              {FREQUENCY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.frequencyButton,
                    intervalMinutes === opt.value && styles.frequencyButtonActive,
                  ]}
                  onPress={() => setIntervalMinutes(opt.value)}
                >
                  <Text style={styles.frequencyEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.frequencyLabel,
                      intervalMinutes === opt.value && styles.frequencyLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Phase 2: Frequency Change Warning */}
            {frequencyChanged && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {'⚠️ '}{t('monitors', 'frequencyChangeWarning')
                    .replace('{from}', getFrequencyBadge(monitor.interval_minutes || 240))
                    .replace('{to}', getFrequencyBadge(intervalMinutes))}
                  {intervalMinutes < (monitor.interval_minutes || 240)
                    ? t('monitors', 'higherFreqConsume')
                    : t('monitors', 'lowerFreqSave')}
                </Text>
              </View>
            )}

            {/* Target Price */}
            <Text style={styles.label}>{t('monitors', 'targetPriceOptional')}</Text>
            <TextInput
              style={styles.input}
              value={targetPrice}
              onChangeText={setTargetPrice}
              placeholder={t('monitors', 'targetPricePlaceholderEdit')}
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            {/* Email */}
            <Text style={styles.label}>{t('monitors', 'notificationEmailOptional')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('monitors', 'emailPlaceholderEdit')}
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Excluded Airlines */}
            <Text style={styles.label}>{t('monitors', 'excludedAirlinesOptional')}</Text>
            <TextInput
              style={styles.input}
              value={excludedAirlines}
              onChangeText={setExcludedAirlines}
              placeholder={t('monitors', 'excludedAirlinesPlaceholder')}
              placeholderTextColor="#666"
              autoCapitalize="characters"
            />

            {/* Extend Monitor Duration */}
            <Text style={styles.label}>{t('monitors', 'extendMonitorDuration')}</Text>
            {monitor.end_date && (
              <Text style={styles.currentEndDate}>
                {t('monitors', 'currentExpiry')} {new Date(monitor.end_date).toISOString().slice(0, 10)}
              </Text>
            )}
            <View style={styles.durationGrid}>
              {/* 不延长选项 */}
              <TouchableOpacity
                style={[styles.durationButton, extendDays === 0 && styles.durationButtonActive]}
                onPress={() => setExtendDays(0)}
              >
                <Text style={[styles.durationLabel, extendDays === 0 && styles.durationLabelActive]}>
                  {t('monitors', 'noExtend')}
                </Text>
              </TouchableOpacity>
              {DURATION_OPTIONS.map((opt) => {
                const cost = calculateMonitorCost(opt.value, intervalMinutes);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.durationButton, extendDays === opt.value && styles.durationButtonActive]}
                    onPress={() => setExtendDays(opt.value)}
                  >
                    <Text style={[styles.durationLabel, extendDays === opt.value && styles.durationLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.durationCost, extendDays === opt.value && styles.durationCostActive]}>
                      {`+${cost}💎`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 {t('monitors', 'dateChangeNote')}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>{t('common', 'cancel').toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('common', 'save').toUpperCase()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  scrollContent: {
    padding: 16,
  },
  modal: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#00FF00',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  routeText: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  lockedInfoBox: {
    backgroundColor: '#171717',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    marginBottom: 16,
  },
  lockedInfoText: {
    color: '#a3a3a3',
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 16,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  infoText: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#00FF00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Phase 2: Frequency selector
  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  frequencyButton: {
    width: '31%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  frequencyButtonActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  frequencyEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  frequencyLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  frequencyLabelActive: {
    color: '#000000',
  },
  warningBox: {
    backgroundColor: '#2E2E1A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAB308',
  },
  warningText: {
    color: '#EAB308',
    fontSize: 11,
    lineHeight: 16,
  },
  currentEndDate: {
    color: '#888888',
    fontSize: 11,
    marginBottom: 8,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  durationButton: {
    width: '31%',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  durationButtonActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  durationLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  durationLabelActive: {
    color: '#000000',
  },
  durationCost: {
    color: '#888888',
    fontSize: 9,
    marginTop: 2,
  },
  durationCostActive: {
    color: '#000000',
  },
});

