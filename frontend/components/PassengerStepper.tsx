import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface PassengerStepperProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

export const PassengerStepper: React.FC<PassengerStepperProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 9,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    label: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
    },
    stepperBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.sm,
    },
    stepperBtnText: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
    },
    stepperValue: {
      flex: 1,
      textAlign: 'center',
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });
