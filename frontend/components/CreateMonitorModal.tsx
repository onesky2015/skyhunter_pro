// filename: components/CreateMonitorModal.tsx
/**
 * Phase 2: 创建监控任务 Modal（含频率选择、时长选择、动态计费）
 *
 * INPUT: visible, onClose, onSubmit, userCredits, prefillData
 * OUTPUT: 调用 onSubmit(params, searchDays) 创建监控任务
 * POS: 对应 Manifest MonitorCreateRequest (v3.3.0)
 */
import React, { useState, useEffect, useMemo } from 'react';
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
import { TimeRangeSlider } from './TimeRangeSlider';
import { AirlinePicker } from './AirlinePicker';
import { AlliancePicker } from './AlliancePicker';
import { TripTypeToggle } from './TripTypeToggle';
import { PassengerStepper } from './PassengerStepper';
import { CabinSelector } from './CabinSelector';
import { OriginDestInput } from './OriginDestInput';
import {
  getDefaultStartDate,
  getDefaultReturnDate,
  minutesToTimeStr,
  timeStrToMinutes,
  AIRLINE_OPTIONS,
  calculateMonitorCost,
  FREQUENCY_OPTIONS,
  DURATION_OPTIONS,
} from '../constants/utils';
import { MonitorCreatePayload, SortStrategy, TripType } from '../types';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

/** 预填数据（从 HeatmapGrid 点击传入） */
export interface MonitorPrefillData {
  origin?: string;
  destination?: string;
  startDate?: string;
  days?: number;
  cabinClass?: string;
  adults?: number;
  children?: number;
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
}

interface CreateMonitorModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: MonitorCreatePayload, searchDays: number) => Promise<boolean>;
  userCredits?: number;
  prefillData?: MonitorPrefillData | null;
}

export const CreateMonitorModal: React.FC<CreateMonitorModalProps> = ({
  visible,
  onClose,
  onSubmit,
  userCredits = 0,
  prefillData = null,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [returnDate, setReturnDate] = useState(getDefaultReturnDate());
  const [tripType, setTripType] = useState<TripType>('one_way');
  const [cabinClass, setCabinClass] = useState('economy');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [targetPrice, setTargetPrice] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Phase 2: 频率与时长
  const [intervalMinutes, setIntervalMinutes] = useState(240);
  const [durationDays, setDurationDays] = useState(7);

  // Advanced filters
  const [maxStops, setMaxStops] = useState<number | null>(null);
  const [departureTimeRange, setDepartureTimeRange] = useState<[number, number]>([0, 1440]);
  const [arrivalTimeRange, setArrivalTimeRange] = useState<[number, number]>([0, 1440]);
  const [airlineInclude, setAirlineInclude] = useState('');
  const [allianceInclude, setAllianceInclude] = useState('');
  const [excludedAirlines, setExcludedAirlines] = useState('');
  const [sortStrategy, setSortStrategy] = useState<'best' | 'cheapest'>('best');
  const [airlinePickerVisible, setAirlinePickerVisible] = useState(false);
  const [alliancePickerVisible, setAlliancePickerVisible] = useState(false);
  const [searchDays, setSearchDays] = useState(30);

  // Phase 2: 动态计费
  const estimatedCost = useMemo(
    () => calculateMonitorCost(durationDays, intervalMinutes),
    [durationDays, intervalMinutes]
  );
  const insufficientCredits = estimatedCost > userCredits;

  // Phase 2: 预填数据
  useEffect(() => {
    if (prefillData && visible) {
      if (prefillData.origin) setOrigin(prefillData.origin);
      if (prefillData.destination) setDestination(prefillData.destination);
      if (prefillData.startDate) setStartDate(prefillData.startDate);
      if (prefillData.cabinClass) setCabinClass(prefillData.cabinClass);
      if (prefillData.adults != null) setAdults(prefillData.adults);
      if (prefillData.children != null) setChildren(prefillData.children);
      if (prefillData.tripType) setTripType(prefillData.tripType);
      if (prefillData.returnDate) setReturnDate(prefillData.returnDate);
      if (prefillData.days != null) setSearchDays(prefillData.days);
      if (prefillData.maxStops !== undefined) setMaxStops(prefillData.maxStops);
      if (prefillData.sortStrategy) setSortStrategy(prefillData.sortStrategy);

      const depMin = timeStrToMinutes(prefillData.departureTimeMin);
      const depMax = timeStrToMinutes(prefillData.departureTimeMax);
      if (depMin != null && depMax != null) {
        setDepartureTimeRange([depMin, depMax]);
      }

      const arrMin = timeStrToMinutes(prefillData.arrivalTimeMin);
      const arrMax = timeStrToMinutes(prefillData.arrivalTimeMax);
      if (arrMin != null && arrMax != null) {
        setArrivalTimeRange([arrMin, arrMax]);
      }

      if (prefillData.airlineInclude) {
        const matchedOption = AIRLINE_OPTIONS.find((option) => option.value === prefillData.airlineInclude);
        if (matchedOption?.type === 'airline') {
          setAirlineInclude(prefillData.airlineInclude);
          setAllianceInclude('');
        } else {
          setAllianceInclude(prefillData.airlineInclude);
          setAirlineInclude('');
        }
      }
      if (prefillData.excludedAirlines) setExcludedAirlines(prefillData.excludedAirlines);
    }
  }, [prefillData, visible]);

  const handleSubmit = async () => {
    const trimOrigin = origin.trim().toUpperCase();
    const trimDest = destination.trim().toUpperCase();
    const trimDate = startDate.trim();

    if (trimOrigin.length !== 3 || trimDest.length !== 3) {
      Alert.alert(t('common', 'error'), t('monitors', 'iataMustBe3'));
      return;
    }
    if (trimOrigin === trimDest) {
      Alert.alert(t('common', 'error'), t('monitors', 'originDestSame'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimDate)) {
      Alert.alert(t('common', 'error'), t('monitors', 'dateFormatYYYYMMDD'));
      return;
    }

    if (tripType === 'round_trip') {
      const trimReturn = returnDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimReturn)) {
        Alert.alert(t('common', 'error'), t('monitors', 'returnDateFormat'));
        return;
      }
      if (trimReturn <= trimDate) {
        Alert.alert(t('common', 'error'), t('monitors', 'returnAfterDeparture'));
        return;
      }
    }

    setSubmitting(true);

    const body: MonitorCreatePayload = {
      origin: trimOrigin,
      destination: trimDest,
      start_date: trimDate,
      // 使用真实搜索窗口天数，避免从搜索页创建监控时退回默认 30 天
      days: searchDays,
      cabin_class: cabinClass,
      adults: adults || 1,
      children: children || 0,
      sort_strategy: sortStrategy,
      trip_type: tripType,
      // Phase 2: 频率与时长
      interval_minutes: intervalMinutes,
      duration_days: durationDays,
    };

    if (targetPrice.trim()) {
      const tp = parseFloat(targetPrice.trim());
      if (!isNaN(tp) && tp > 0) body.target_price = tp;
    }
    if (email.trim()) {
      body.notification_email = email.trim();
    }
    if (tripType === 'round_trip' && returnDate.trim()) {
      body.return_date = returnDate.trim();
    }

    // Advanced filters
    if (maxStops !== null) {
      body.max_stops = maxStops;
    }
    if (departureTimeRange[0] > 0 || departureTimeRange[1] < 1440) {
      body.departure_time_min = minutesToTimeStr(departureTimeRange[0]);
      body.departure_time_max = minutesToTimeStr(departureTimeRange[1]);
    }
    if (arrivalTimeRange[0] > 0 || arrivalTimeRange[1] < 1440) {
      body.arrival_time_min = minutesToTimeStr(arrivalTimeRange[0]);
      body.arrival_time_max = minutesToTimeStr(arrivalTimeRange[1]);
    }
    if (airlineInclude.trim()) {
      body.airline_include = airlineInclude;
    } else if (allianceInclude.trim()) {
      body.airline_include = allianceInclude;
    }
    if (excludedAirlines.trim()) {
      body.excluded_airlines = excludedAirlines.trim().replace(/\s+/g, ',').replace(/,+/g, ',');
    }

    const success = await onSubmit(body, searchDays);
    setSubmitting(false);
    if (success) {
      onClose();
      // Reset form
      setOrigin('');
      setDestination('');
      setStartDate(getDefaultStartDate());
      setReturnDate(getDefaultReturnDate());
      setTargetPrice('');
      setEmail('');
      setIntervalMinutes(240);
      setDurationDays(7);
      setMaxStops(null);
      setDepartureTimeRange([0, 1440]);
      setArrivalTimeRange([0, 1440]);
      setAirlineInclude('');
      setAllianceInclude('');
      setExcludedAirlines('');
      setSortStrategy('best');
      setSearchDays(30);
    }
  };

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
              <Text style={styles.title}>{t('monitors', 'newMonitor')}</Text>
              <Text style={styles.credits}>💎 {userCredits}</Text>
            </View>
            <Text style={styles.subtitle}>
              {t('monitors', 'newMonitorSubtitle')}
            </Text>

            {/* Trip Type */}
            <Text style={styles.label}>{t('search', 'tripType')}</Text>
            <TripTypeToggle tripType={tripType} onChange={setTripType} />

            {/* Origin & Destination */}
            <OriginDestInput origin={origin} setOrigin={setOrigin} destination={destination} setDestination={setDestination} />

            {/* Dates */}
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              label={t('search', 'departureDate')}
              style={styles.inputGroup}
            />

            {tripType === 'round_trip' && (
              <DatePicker
                value={returnDate}
                onChange={setReturnDate}
                label={t('search', 'returnDate')}
                style={styles.inputGroup}
              />
            )}

            {/* Cabin Class */}
            <Text style={styles.label}>{t('search', 'cabinClass')}</Text>
            <CabinSelector value={cabinClass} onChange={setCabinClass} small />

            {/* Passengers (Stepper) */}
            <View style={styles.row}>
              <PassengerStepper label={t('search', 'adults')} value={adults} onChange={setAdults} min={1} />
              <View style={{ width: 12 }} />
              <PassengerStepper label={t('search', 'children')} value={children} onChange={setChildren} />
            </View>

            {/* ═══════════ Phase 2: Frequency Selector ═══════════ */}
            <View style={styles.phase2Section}>
              <Text style={styles.sectionTitle}>⏱ {t('monitors', 'monitorFrequency')}</Text>
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
                    <Text
                      style={[
                        styles.frequencyDesc,
                        intervalMinutes === opt.value && styles.frequencyDescActive,
                      ]}
                    >
                      {opt.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Duration Selector */}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>📅 {t('monitors', 'monitorDuration')}</Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.durationButton,
                      durationDays === opt.value && styles.durationButtonActive,
                    ]}
                    onPress={() => setDurationDays(opt.value)}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        durationDays === opt.value && styles.durationTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dynamic Cost Estimator */}
              <View style={[styles.costBox, insufficientCredits && styles.costBoxError]}>
                <Text style={styles.costLabel}>{t('monitors', 'estimatedCost')}</Text>
                <Text style={[styles.costValue, insufficientCredits && styles.costValueError]}>
                  💎 {estimatedCost} {t('monitors', 'credits')}
                </Text>
                {insufficientCredits && (
                  <Text style={styles.costWarning}>
                    ⚠️ {t('monitors', 'insufficientCredits').replace('{n}', String(estimatedCost - userCredits))}
                  </Text>
                )}
              </View>
            </View>

            {/* Target Price (Optional) */}
            <Text style={styles.label}>{t('monitors', 'targetPriceOptional')}</Text>
            <TextInput
              style={styles.input}
              value={targetPrice}
              onChangeText={setTargetPrice}
              placeholder={t('monitors', 'targetPricePlaceholder')}
              placeholderTextColor="#666"
              keyboardType="numeric"
            />

            {/* Email (Optional) */}
            <Text style={styles.label}>{t('monitors', 'notificationEmailOptional')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth', 'emailPlaceholder')}
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Advanced Filters */}
            <View style={styles.advancedSection}>
              <Text style={styles.sectionTitle}>{t('monitors', 'advancedFiltersOptional')}</Text>

              {/* Max Stops */}
              <Text style={styles.label}>{t('monitors', 'maxStops')}</Text>
              <View style={styles.stopsSelector}>
                {[
                  { value: null, label: t('common', 'any') },
                  { value: 0, label: t('common', 'direct') },
                  { value: 1, label: t('common', 'oneStop') },
                  { value: 2, label: t('common', 'twoStops') },
                ].map((opt) => (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[
                      styles.stopsButton,
                      maxStops === opt.value && styles.stopsButtonActive,
                    ]}
                    onPress={() => setMaxStops(opt.value)}
                  >
                    <Text
                      style={[
                        styles.stopsButtonText,
                        maxStops === opt.value && styles.stopsButtonTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Departure Time */}
              <TimeRangeSlider
                label={t('monitors', 'departureTime')}
                value={departureTimeRange}
                onChange={setDepartureTimeRange}
              />

              {/* Arrival Time */}
              <TimeRangeSlider
                label={t('monitors', 'arrivalTime')}
                value={arrivalTimeRange}
                onChange={setArrivalTimeRange}
              />

              {/* Alliance */}
              <Text style={styles.label}>{t('monitors', 'preferredAlliance')}</Text>
              <TouchableOpacity
                style={[
                  styles.airlineDropdown,
                  allianceInclude && styles.airlineDropdownActive,
                ]}
                onPress={() => setAlliancePickerVisible(true)}
              >
                <Text
                  style={[
                    styles.airlineDropdownText,
                    allianceInclude && styles.airlineDropdownTextActive,
                  ]}
                >
                  {allianceInclude
                    ? AIRLINE_OPTIONS.find((o) => o.value === allianceInclude)?.label || allianceInclude
                    : `⭐ ${t('monitors', 'selectAlliance')}`}
                </Text>
                <Text style={styles.airlineDropdownArrow}>▼</Text>
              </TouchableOpacity>

              {/* Airline */}
              <Text style={styles.label}>{t('monitors', 'preferredAirline')}</Text>
              <TouchableOpacity
                style={[
                  styles.airlineDropdown,
                  airlineInclude && styles.airlineDropdownActive,
                ]}
                onPress={() => setAirlinePickerVisible(true)}
              >
                <Text
                  style={[
                    styles.airlineDropdownText,
                    airlineInclude && styles.airlineDropdownTextActive,
                  ]}
                >
                  {airlineInclude
                    ? AIRLINE_OPTIONS.find((o) => o.value === airlineInclude)?.label || airlineInclude
                    : `✈ ${t('monitors', 'selectAirline')}`}
                </Text>
                <Text style={styles.airlineDropdownArrow}>▼</Text>
              </TouchableOpacity>

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

              {/* Sort Strategy */}
              <Text style={styles.label}>{t('monitors', 'searchStrategy')}</Text>
              <View style={styles.strategySelector}>
                <TouchableOpacity
                  style={[
                    styles.strategyButton,
                    sortStrategy === 'best' && styles.strategyButtonActive,
                  ]}
                  onPress={() => setSortStrategy('best')}
                >
                  <Text style={styles.strategyEmoji}>⚖️</Text>
                  <Text
                    style={[
                      styles.strategyButtonText,
                      sortStrategy === 'best' && styles.strategyButtonTextActive,
                    ]}
                  >
                    {t('common', 'best')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.strategyButton,
                    sortStrategy === 'cheapest' && styles.strategyButtonActive,
                  ]}
                  onPress={() => setSortStrategy('cheapest')}
                >
                  <Text style={styles.strategyEmoji}>💰</Text>
                  <Text
                    style={[
                      styles.strategyButtonText,
                      sortStrategy === 'cheapest' && styles.strategyButtonTextActive,
                    ]}
                  >
                    {t('common', 'cheapest')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Alliance Picker Modal */}
            <AlliancePicker
              visible={alliancePickerVisible}
              onClose={() => setAlliancePickerVisible(false)}
              value={allianceInclude}
              onChange={setAllianceInclude}
              isNested={true}
            />

            {/* Airline Picker Modal */}
            <AirlinePicker
              visible={airlinePickerVisible}
              onClose={() => setAirlinePickerVisible(false)}
              value={airlineInclude}
              onChange={setAirlineInclude}
              isNested={true}
            />

            {/* Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>{t('common', 'cancel').toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (submitting || insufficientCredits) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting || insufficientCredits}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.colors.accentText} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {insufficientCredits
                      ? t('monitors', 'topUpNeeded')
                      : t('monitors', 'startMonitor').replace('{n}', String(estimatedCost))}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    scrollContent: {
      padding: 16,
    },
    modal: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      overflow: 'visible' as const,
      zIndex: 10,
      ...getShadowStyle(theme, 1),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
    },
    credits: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginBottom: 20,
    },
    label: {
      color: theme.colors.accent,
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
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      padding: 12,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      fontSize: 16,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    halfInput: {
      flex: 1,
    },
    selector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    selectorButton: {
      flex: 1,
      padding: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selectorButtonSmall: {
      flex: 1,
      padding: 8,
    },
    selectorButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    selectorText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
    },
    selectorTextSmall: {
      fontSize: 10,
    },
    selectorTextActive: {
      color: theme.colors.accentText,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      marginBottom: 12,
    },
    stepperBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.sm,
    },
    stepperBtnText: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
    },
    stepperValue: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    phase2Section: {
      backgroundColor: theme.colors.backgroundAlt,
      padding: 16,
      borderRadius: theme.radius.md,
      marginTop: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    sectionTitle: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 12,
    },
    frequencyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    frequencyButton: {
      width: '31%',
      padding: 10,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    frequencyButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    frequencyEmoji: {
      fontSize: 18,
      marginBottom: 4,
    },
    frequencyLabel: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    frequencyLabelActive: {
      color: theme.colors.accentText,
    },
    frequencyDesc: {
      color: theme.colors.textSoft,
      fontSize: 9,
      marginTop: 2,
    },
    frequencyDescActive: {
      color: theme.colors.accentText,
    },
    durationRow: {
      flexDirection: 'row',
      gap: 8,
    },
    durationButton: {
      flex: 1,
      padding: 10,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    durationButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    durationText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    durationTextActive: {
      color: theme.colors.accentText,
    },
    costBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
    },
    costBoxError: {
      borderColor: theme.colors.danger,
      backgroundColor: `${theme.colors.danger}22`,
    },
    costLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      marginBottom: 4,
    },
    costValue: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
    },
    costValueError: {
      color: theme.colors.danger,
    },
    costWarning: {
      color: theme.colors.danger,
      fontSize: 11,
      marginTop: 4,
      fontWeight: '600',
    },
    buttons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    submitButton: {
      flex: 2,
      backgroundColor: theme.colors.accent,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonText: {
      color: theme.colors.accentText,
      fontSize: 14,
      fontWeight: '700',
    },
    advancedSection: {
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      borderRadius: theme.radius.sm,
      marginTop: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stopsSelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    stopsButton: {
      flex: 1,
      padding: 10,
      borderRadius: 6,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stopsButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    stopsButtonText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    stopsButtonTextActive: {
      color: theme.colors.accentText,
    },
    airlineDropdown: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    airlineDropdownActive: {
      borderColor: theme.colors.borderStrong,
    },
    airlineDropdownText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      flex: 1,
    },
    airlineDropdownTextActive: {
      color: theme.colors.accent,
    },
    airlineDropdownArrow: {
      color: theme.colors.textSoft,
      fontSize: 12,
      marginLeft: 8,
    },
    strategySelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    strategyButton: {
      flex: 1,
      padding: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    strategyButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    strategyEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },
    strategyButtonText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    strategyButtonTextActive: {
      color: theme.colors.accentText,
    },
  });
