import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export const KpiCard: React.FC<Props> = ({ label, value, sub, color = '#00FF00' }) => (
  <View style={s.card}>
    <Text style={[s.value, { color }]}>{String(value)}</Text>
    <Text style={s.label}>{label}</Text>
    {sub ? <Text style={s.sub}>{sub}</Text> : null}
  </View>
);

const s = StyleSheet.create({
  card: {
    flex: 1, minWidth: 100, backgroundColor: '#1A1A1A', borderRadius: 10,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  value: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: '600', textAlign: 'center' },
  sub: { fontSize: 9, color: '#666', marginTop: 2, textAlign: 'center' },
});
