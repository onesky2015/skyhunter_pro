// filename: components/TimeRangeSlider.tsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { minutesToTimeStr } from '../constants/utils';
import { useTheme } from '../theme';

interface TimeRangeSliderProps {
  label: string;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const SLIDER_LENGTH = Platform.OS === 'web' ? 300 : 250;

export const TimeRangeSlider: React.FC<TimeRangeSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1440,
  step = 30,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valueText}>
        {minutesToTimeStr(value[0])} — {minutesToTimeStr(value[1])}
      </Text>
      <View style={styles.sliderWrapper}>
        <Text style={styles.boundLabel}>00:00</Text>
        <View style={styles.sliderContainer}>
          <MultiSlider
            values={value}
            min={min}
            max={max}
            step={step}
            sliderLength={SLIDER_LENGTH}
            onValuesChange={(values: number[]) => onChange([values[0], values[1]])}
            selectedStyle={{ backgroundColor: theme.colors.accent, height: 4 }}
            unselectedStyle={{ backgroundColor: theme.colors.border, height: 4 }}
            trackStyle={{ height: 4, backgroundColor: theme.colors.border }}
            markerStyle={{
              backgroundColor: theme.colors.text,
              height: 28,
              width: 28,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: theme.colors.accent,
              elevation: 6,
            }}
            minMarkerOverlapDistance={40}
            snapped
          />
        </View>
        <Text style={styles.boundLabel}>24:00</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      marginBottom: 20,
    },
    label: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    valueText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    sliderWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    boundLabel: {
      color: theme.colors.textSoft,
      fontSize: 10,
      width: 40,
      textAlign: 'center',
    },
    sliderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

