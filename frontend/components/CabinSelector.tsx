import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useI18n } from '../i18n';

interface CabinSelectorProps {
  value: string;
  onChange: (val: string) => void;
  small?: boolean;
}

export const CabinSelector: React.FC<CabinSelectorProps> = ({ value, onChange, small }) => {
  const { t } = useI18n();
  const options = [
    { value: 'economy', label: `💺 ${t('search', 'economy')}` },
    { value: 'premium_economy', label: `💺+ ${t('search', 'premiumEconomy')}` },
    { value: 'business', label: `💼 ${t('search', 'business')}` },
    { value: 'first', label: `💎 ${t('search', 'first')}` },
  ];

  return (
    <View style={styles.container}>
      {options.map((c) => (
        <TouchableOpacity
          key={c.value}
          style={[
            styles.button,
            small && styles.buttonSmall,
            value === c.value && styles.buttonActive,
          ]}
          onPress={() => onChange(c.value)}
        >
          <Text
            style={[
              styles.text,
              small && styles.textSmall,
              value === c.value && styles.textActive,
            ]}
          >
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  button: {
    flex: 1,
    minWidth: 70,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  buttonSmall: {
    padding: 8,
  },
  buttonActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  text: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
  textActive: {
    color: '#000000',
  },
});
