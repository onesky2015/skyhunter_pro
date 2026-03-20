// filename: app/(tabs)/search.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useSearch } from '../../hooks/useSearch';
import { useMonitors } from '../../hooks/useMonitors';
import { HeatmapGrid } from '../../components/HeatmapGrid';
import { DatePicker } from '../../components/DatePicker';
import { AdvancedFilters } from '../../components/AdvancedFilters';
import { CreateMonitorModal, MonitorPrefillData } from '../../components/CreateMonitorModal';
import { TripTypeToggle } from '../../components/TripTypeToggle';
import { PassengerStepper } from '../../components/PassengerStepper';
import { CabinSelector } from '../../components/CabinSelector';
import { OriginDestInput } from '../../components/OriginDestInput';
import { getDefaultStartDate, getDefaultReturnDate, minutesToTimeStr, calculateSearchCost } from '../../constants/utils';
import { SearchRequestOptions } from '../../types';
import { useI18n } from '../../i18n';

export default function SearchScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { userToken, userInfo, isAuthenticated, handle401Error, refreshUserInfo } = useAuth();
  const { createMonitor } = useMonitors(userToken, handle401Error, refreshUserInfo);
  const [origin, setOrigin] = useState('JFK');
  const [destination, setDestination] = useState('PVG');
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultReturnDate());
  const [returnDate, setReturnDate] = useState(getDefaultReturnDate());
  const [searchMode, setSearchMode] = useState<'fixed' | 'range'>('range');
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');

  // Phase 2: Passenger & Cabin
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabinClass, setCabinClass] = useState('economy');

  // Phase 2: CreateMonitorModal integration
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [prefillData, setPrefillData] = useState<MonitorPrefillData | null>(null);
  
  // Advanced filters
  const [maxStops, setMaxStops] = useState<number | null>(null);
  const [departureTimeRange, setDepartureTimeRange] = useState<[number, number]>([0, 1440]);
  const [arrivalTimeRange, setArrivalTimeRange] = useState<[number, number]>([0, 1440]);
  const [airlineInclude, setAirlineInclude] = useState('');
  const [allianceInclude, setAllianceInclude] = useState('');
  const [excludedAirlines, setExcludedAirlines] = useState('');
  const [sortStrategy, setSortStrategy] = useState<'best' | 'cheapest'>('best');

  const { searchResult, loading, error, confirmAndSearch } = useSearch(
    userToken,
    userInfo?.credits ?? 0,
    handle401Error,
    refreshUserInfo,
    () => {} // onTopUp - 可以导航到 profile 页面
  );

  // 计算搜索天数
  const calculateDays = (): number => {
    if (searchMode === 'fixed') {
      return 1;
    }
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = end.getTime() - start.getTime();
      return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }
    return 30; // 默认值
  };

  const handleSearch = () => {
    // 日期验证
    if (searchMode === 'range' && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end <= start) {
        Alert.alert(t('common', 'error'), t('search', 'endDateAfterStart'));
        return;
      }
    }

    const days = calculateDays();

    // 构建高级筛选选项（Phase 2: 含乘客和舱位）
    const options: SearchRequestOptions = {
      tripType,
      sortStrategy,
      cabinClass,
      adults,
      children,
    };

    if (tripType === 'round_trip' && returnDate) {
      options.returnDate = returnDate;
    }
    if (maxStops !== null) {
      options.maxStops = maxStops;
    }
    if (departureTimeRange[0] > 0 || departureTimeRange[1] < 1440) {
      options.departureTimeMin = minutesToTimeStr(departureTimeRange[0]);
      options.departureTimeMax = minutesToTimeStr(departureTimeRange[1]);
    }
    if (arrivalTimeRange[0] > 0 || arrivalTimeRange[1] < 1440) {
      options.arrivalTimeMin = minutesToTimeStr(arrivalTimeRange[0]);
      options.arrivalTimeMax = minutesToTimeStr(arrivalTimeRange[1]);
    }
    // 航司优先：如果选择了航司，使用航司；否则使用联盟
    if (airlineInclude.trim()) {
      options.airlineInclude = airlineInclude;
    } else if (allianceInclude.trim()) {
      options.airlineInclude = allianceInclude;
    }
    if (excludedAirlines.trim()) {
      options.excludedAirlines = excludedAirlines.trim().replace(/\s+/g, ',').replace(/,+/g, ',');
    }

    confirmAndSearch(origin, destination, startDate, days, options);
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('search', 'pleaseLogin')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Search Card */}
      <View style={styles.searchCard}>
        <Text style={styles.title}>🔍 {t('search', 'title').toUpperCase()}</Text>

        {/* Trip Type Toggle */}
        <TripTypeToggle tripType={tripType} onChange={setTripType} />

        {/* Search Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'fixed' && styles.modeButtonActive]}
            onPress={() => setSearchMode('fixed')}
          >
            <Text style={[styles.modeText, searchMode === 'fixed' && styles.modeTextActive]}>
              📅 {t('search', 'fixedDate')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'range' && styles.modeButtonActive]}
            onPress={() => setSearchMode('range')}
          >
            <Text style={[styles.modeText, searchMode === 'range' && styles.modeTextActive]}>
              📊 {t('search', 'dateRange')} {searchMode === 'range' && startDate && endDate ? `(${calculateDays()} ${t('search', 'days')})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Origin & Destination */}
        <OriginDestInput origin={origin} setOrigin={setOrigin} destination={destination} setDestination={setDestination} />

        {/* Date Input */}
        <DatePicker
          value={startDate}
          onChange={setStartDate}
          label={searchMode === 'fixed' ? t('search', 'departureDate').toUpperCase() : t('search', 'startDate').toUpperCase()}
          style={styles.inputGroup}
        />

        {searchMode === 'range' && (
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            label={t('search', 'endDate').toUpperCase()}
            style={styles.inputGroup}
            minDate={startDate || undefined}
          />
        )}

        {/* Return Date (for round-trip) */}
        {tripType === 'round_trip' && (
          <DatePicker
            value={returnDate}
            onChange={setReturnDate}
            label={t('search', 'returnDate').toUpperCase()}
            style={styles.inputGroup}
          />
        )}

        {/* Phase 2: Passenger Stepper */}
        <View style={styles.passengerRow}>
          <PassengerStepper label={t('search', 'adults').toUpperCase()} value={adults} onChange={setAdults} min={1} />
          <View style={{width: 12}} />
          <PassengerStepper label={t('search', 'children').toUpperCase()} value={children} onChange={setChildren} />
        </View>

        {/* Phase 2: Cabin Selector */}
        <Text style={styles.inputLabel}>{t('search', 'cabinClass').toUpperCase()}</Text>
        <CabinSelector value={cabinClass} onChange={setCabinClass} />

        {/* Advanced Filters */}
        <AdvancedFilters
          maxStops={maxStops}
          onMaxStopsChange={setMaxStops}
          departureTimeRange={departureTimeRange}
          onDepartureTimeChange={setDepartureTimeRange}
          arrivalTimeRange={arrivalTimeRange}
          onArrivalTimeChange={setArrivalTimeRange}
          airlineInclude={airlineInclude}
          onAirlineChange={setAirlineInclude}
          allianceInclude={allianceInclude}
          onAllianceChange={setAllianceInclude}
          excludedAirlines={excludedAirlines}
          onExcludedAirlinesChange={setExcludedAirlines}
          sortStrategy={sortStrategy}
          onSortStrategyChange={setSortStrategy}
        />

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchButton, loading && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.searchButtonText}>
              {searchMode === 'fixed'
                ? t('search', 'searchFixedDate')
                : t('search', 'searchDateRange')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Cost Info */}
        <Text style={styles.costText}>
          {searchMode === 'fixed'
            ? t('search', 'fixedDateSearchCost').replace('{n}', String(calculateSearchCost(1)))
            : (() => {
                const days = calculateDays();
                const cost = calculateSearchCost(days);
                return t('search', 'searchingDaysCost').replace('{n}', String(days)).replace('{c}', String(cost));
              })()}
        </Text>

        {/* Credits Display */}
        <Text style={styles.creditsText}>💎 {userInfo?.credits ?? 0}</Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Search Results */}
      {searchResult && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>📊 {t('search', 'searchResults').toUpperCase()}</Text>
          <Text style={styles.resultsSubtitle}>
            {searchResult.origin} → {searchResult.destination}
          </Text>

          {/* Heatmap — Phase 2: 点击直接打开 CreateMonitorModal */}
          <HeatmapGrid
            cells={searchResult.heatmap_data}
            label={t('search', 'priceHeatmap')}
            onCreateMonitor={(date, price) => {
              const days = searchResult.days || calculateDays();
              setPrefillData({
                origin: searchResult.origin,
                destination: searchResult.destination,
                startDate: date,
                days,
                cabinClass,
                adults,
                children,
                tripType,
                returnDate: tripType === 'round_trip' ? returnDate : undefined,
                maxStops,
                departureTimeMin: departureTimeRange[0] > 0 ? minutesToTimeStr(departureTimeRange[0]) : undefined,
                departureTimeMax: departureTimeRange[1] < 1440 ? minutesToTimeStr(departureTimeRange[1]) : undefined,
                arrivalTimeMin: arrivalTimeRange[0] > 0 ? minutesToTimeStr(arrivalTimeRange[0]) : undefined,
                arrivalTimeMax: arrivalTimeRange[1] < 1440 ? minutesToTimeStr(arrivalTimeRange[1]) : undefined,
                airlineInclude: airlineInclude.trim() || allianceInclude.trim() || undefined,
                excludedAirlines: excludedAirlines.trim() || undefined,
                sortStrategy,
              });
              setCreateModalVisible(true);
            }}
          />

          {/* Best Flight */}
          {searchResult.best_flight && (
            <View style={styles.flightCard}>
              <Text style={styles.flightTitle}>✈ {t('search', 'bestFlight')}</Text>
              <Text style={styles.flightText}>
                {searchResult.best_flight.airline || '--'} {searchResult.best_flight.flight_number || '--'}
              </Text>
              <Text style={styles.flightText}>
                {searchResult.best_flight.departure_time || '--'} → {searchResult.best_flight.arrival_time || '--'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Phase 2: CreateMonitorModal (triggered from HeatmapGrid) */}
      <CreateMonitorModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setPrefillData(null);
        }}
        onSubmit={async (params, days) => {
          try {
            const success = await createMonitor(params, days, () => {
              // Post-creation: navigate to monitors
              router.push('/(tabs)/monitors');
            });
            return success;
          } catch (err) {
            Alert.alert(t('common', 'error'), err instanceof Error ? err.message : t('search', 'createMonitorFailed'));
            return false;
          }
        }}
        userCredits={userInfo?.credits ?? 0}
        prefillData={prefillData}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
  },
  searchCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00FF00',
    overflow: 'visible' as const,
    zIndex: 10,
  },
  title: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  modeButtonActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#00FF00',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#00FF00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  costText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  creditsText: {
    color: '#00FF00',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FF4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  resultsCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  resultsTitle: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultsSubtitle: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
  flightCard: {
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  flightTitle: {
    color: '#00FF00',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  flightText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  // Phase 2: Passenger Stepper
  passengerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  passengerGroup: {
    flex: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  stepperBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  stepperBtnText: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Phase 2: Cabin Selector
  cabinRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  cabinButton: {
    flex: 1,
    minWidth: 70,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  cabinButtonActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  cabinText: {
    color: '#666666',
    fontSize: 10,
    fontWeight: '600',
  },
  cabinTextActive: {
    color: '#000000',
  },
});
