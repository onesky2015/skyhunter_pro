// filename: components/AdvancedFilters.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { TimeRangeSlider } from './TimeRangeSlider';
import { AirlinePicker } from './AirlinePicker';
import { AlliancePicker } from './AlliancePicker';
import { AIRLINE_OPTIONS } from '../constants/utils';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

interface AdvancedFiltersProps {
  maxStops: number | null;
  onMaxStopsChange: (value: number | null) => void;
  departureTimeRange: [number, number];
  onDepartureTimeChange: (value: [number, number]) => void;
  arrivalTimeRange: [number, number];
  onArrivalTimeChange: (value: [number, number]) => void;
  airlineInclude: string;
  onAirlineChange: (value: string) => void;
  allianceInclude: string;
  onAllianceChange: (value: string) => void;
  excludedAirlines: string;
  onExcludedAirlinesChange: (value: string) => void;
  sortStrategy: 'best' | 'cheapest';
  onSortStrategyChange: (value: 'best' | 'cheapest') => void;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  maxStops,
  onMaxStopsChange,
  departureTimeRange,
  onDepartureTimeChange,
  arrivalTimeRange,
  onArrivalTimeChange,
  airlineInclude,
  onAirlineChange,
  allianceInclude,
  onAllianceChange,
  excludedAirlines,
  onExcludedAirlinesChange,
  sortStrategy,
  onSortStrategyChange,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [visible, setVisible] = useState(false);
  const [airlinePickerVisible, setAirlinePickerVisible] = useState(false);
  const [alliancePickerVisible, setAlliancePickerVisible] = useState(false);

  const hasFiltersSet =
    maxStops !== null ||
    departureTimeRange[0] > 0 ||
    departureTimeRange[1] < 1440 ||
    arrivalTimeRange[0] > 0 ||
    arrivalTimeRange[1] < 1440 ||
    airlineInclude.trim() !== '' ||
    allianceInclude.trim() !== '' ||
    excludedAirlines.trim() !== '' ||
    sortStrategy !== 'best';

  return (
    <>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible(!visible)}
        activeOpacity={0.7}
      >
        <Text style={styles.toggleText}>
          {visible ? '▼' : '▶'} {t('monitors', 'advancedSettings')}
        </Text>
        {hasFiltersSet && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('monitors', 'set')}</Text>
          </View>
        )}
      </TouchableOpacity>

      {visible && (
        <View style={styles.container}>
          {/* Max Stops */}
          <Text style={styles.label}>{t('monitors', 'maxStopsLabel')}</Text>
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
                onPress={() => onMaxStopsChange(opt.value)}
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
            onChange={onDepartureTimeChange}
          />

          {/* Arrival Time */}
          <TimeRangeSlider
            label={t('monitors', 'arrivalTime')}
            value={arrivalTimeRange}
            onChange={onArrivalTimeChange}
          />

          {/* Alliance Picker */}
          <Text style={styles.label}>{t('monitors', 'preferredAllianceLabel')}</Text>
          <TouchableOpacity
            style={[
              styles.airlineDropdown,
              allianceInclude && styles.airlineDropdownActive,
            ]}
            onPress={() => setAlliancePickerVisible(true)}
            activeOpacity={0.7}
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

          {/* Airline Picker */}
          <Text style={styles.label}>{t('monitors', 'preferredAirlineLabel')}</Text>
          <TouchableOpacity
            style={[
              styles.airlineDropdown,
              airlineInclude && styles.airlineDropdownActive,
            ]}
            onPress={() => setAirlinePickerVisible(true)}
            activeOpacity={0.7}
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
          <Text style={styles.label}>{t('monitors', 'excludedAirlinesLabel')}</Text>
          <TextInput
            style={styles.excludedInput}
            value={excludedAirlines}
            onChangeText={onExcludedAirlinesChange}
            placeholder={t('monitors', 'excludedPlaceholder')}
            placeholderTextColor="#666"
            autoCapitalize="characters"
          />

          {/* Search Strategy */}
          <Text style={styles.label}>{t('monitors', 'searchStrategyLabel')}</Text>
          <View style={styles.strategySelector}>
            <TouchableOpacity
              style={[
                styles.strategyButton,
                sortStrategy === 'best' && styles.strategyButtonActive,
              ]}
              onPress={() => onSortStrategyChange('best')}
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
              <Text style={styles.strategyDesc}>{t('monitors', 'priceDuration')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.strategyButton,
                sortStrategy === 'cheapest' && styles.strategyButtonActive,
              ]}
              onPress={() => onSortStrategyChange('cheapest')}
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
              <Text style={styles.strategyDesc}>{t('monitors', 'lowestPriceOnly')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Alliance Picker Modal */}
      <AlliancePicker
        visible={alliancePickerVisible}
        onClose={() => setAlliancePickerVisible(false)}
        value={allianceInclude}
        onChange={onAllianceChange}
      />

      {/* Airline Picker Modal */}
      <AirlinePicker
        visible={airlinePickerVisible}
        onClose={() => setAirlinePickerVisible(false)}
        value={airlineInclude}
        onChange={onAirlineChange}
      />
    </>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.sm,
      marginTop: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    toggleText: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    badge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    badgeText: {
      color: theme.colors.accentText,
      fontSize: 10,
      fontWeight: '700',
    },
    container: {
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      borderRadius: theme.radius.sm,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    label: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 12,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    stopsSelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    stopsButton: {
      flex: 1,
      padding: 12,
      borderRadius: theme.radius.sm,
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
      fontSize: 12,
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
      fontSize: 14,
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
    excludedInput: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      marginBottom: 12,
    },
    strategySelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    strategyButton: {
      flex: 1,
      padding: 16,
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
      fontSize: 24,
      marginBottom: 8,
    },
    strategyButtonText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    strategyButtonTextActive: {
      color: theme.colors.accentText,
    },
    strategyDesc: {
      color: theme.colors.textSoft,
      fontSize: 10,
    },
  });

