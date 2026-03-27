import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TripType } from '../types';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

interface TripTypeToggleProps {
  tripType: TripType;
  onChange: (type: TripType) => void;
  style?: object;
}

export const TripTypeToggle: React.FC<TripTypeToggleProps> = ({ tripType, onChange, style }) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={[styles.modeToggle, style]}>
      <TouchableOpacity
        style={[styles.modeButton, tripType === 'one_way' && styles.modeButtonActive]}
        onPress={() => onChange('one_way')}
      >
        <Text style={[styles.modeText, tripType === 'one_way' && styles.modeTextActive]}>
          → {t('search', 'oneWayShort')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.modeButton, tripType === 'round_trip' && styles.modeButtonActive]}
        onPress={() => onChange('round_trip')}
      >
        <Text style={[styles.modeText, tripType === 'round_trip' && styles.modeTextActive]}>
          ⇄ {t('search', 'roundTripShort')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    modeToggle: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 8,
    },
    modeButton: {
      flex: 1,
      padding: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    modeText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
    },
    modeTextActive: {
      color: theme.colors.accentText,
    },
  });
