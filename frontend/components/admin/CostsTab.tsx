import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, ScrollView, Platform, Alert, Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { analyticsApi } from '../../services/api';
import { CostSummary, AdminBudgetRecord } from '../../types';
import { KpiCard } from './KpiCard';
import { TimeRangePicker } from './TimeRangePicker';

interface Props {
  userToken: string | null;
  on401: () => void;
}

const chartWidth = Math.min(Dimensions.get('window').width - 80, 600);

export const CostsTab: React.FC<Props> = ({ userToken, on401 }) => {
  const [costs, setCosts] = useState<CostSummary | null>(null);
  const [budgets, setBudgets] = useState<AdminBudgetRecord[]>([]);
  const [range, setRange] = useState('day');
  const [loading, setLoading] = useState(true);

  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetProvider, setBudgetProvider] = useState('serpapi');
  const [budgetDesc, setBudgetDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      const [costData, budgetData] = await Promise.all([
        analyticsApi.getCosts(userToken, range, on401),
        analyticsApi.getBudgets(userToken, on401),
      ]);
      setCosts(costData);
      setBudgets(budgetData);
    } catch (err) {
      console.error('Costs fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userToken, range, on401]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddBudget = async () => {
    if (!userToken) return;
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('Error', 'Please enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await analyticsApi.addBudget(userToken, {
        amount_usd: amount,
        provider: budgetProvider || 'serpapi',
        description: budgetDesc || undefined,
      }, on401);
      setBudgetAmount('');
      setBudgetDesc('');
      showAlert('Success', `$${amount} budget recorded`);
      fetchData();
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  if (loading && !costs) {
    return <ActivityIndicator size="large" color="#00FF00" style={{ marginTop: 40 }} />;
  }

  const trendLabels = costs?.trend?.map(d => d.label) || [];
  const trendValues = costs?.trend?.map(d => d.value) || [];
  const maxLabels = 8;
  const step = Math.max(1, Math.ceil(trendLabels.length / maxLabels));
  const displayLabels = trendLabels.map((l, i) => i % step === 0 ? l : '');

  return (
    <View>
      {costs && (
        <>
          <View style={s.kpiRow}>
            <KpiCard label="Total Budget" value={`$${costs.total_budget.toFixed(2)}`} color="#1E90FF" />
            <KpiCard label="Total Spent" value={`$${costs.total_spent.toFixed(4)}`} color="#FF6347" />
            <KpiCard label="Balance" value={`$${costs.balance.toFixed(2)}`} color={costs.balance > 0 ? '#00FF00' : '#FF4444'} />
          </View>
          <View style={s.kpiRow}>
            <KpiCard label="API Calls" value={costs.total_api_calls} />
            <KpiCard label="Avg Cost/Call" value={`$${costs.avg_cost_per_call.toFixed(5)}`} color="#FFD700" />
          </View>
        </>
      )}

      <TimeRangePicker value={range} onChange={setRange} />

      {trendValues.length > 0 && trendValues.some(v => v > 0) && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>Cost Trend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: displayLabels,
                datasets: [{ data: trendValues.length > 0 ? trendValues : [0] }],
              }}
              width={Math.max(chartWidth, trendValues.length * 28)}
              height={180}
              chartConfig={{
                backgroundGradientFrom: '#1A1A1A',
                backgroundGradientTo: '#1A1A1A',
                color: (opacity = 1) => `rgba(255, 99, 71, ${opacity})`,
                labelColor: () => '#888',
                decimalCount: 4,
                propsForDots: { r: '3', strokeWidth: '1', stroke: '#FF6347' },
                propsForBackgroundLines: { stroke: '#333' },
              }}
              bezier
              style={{ borderRadius: 8 }}
              withInnerLines={false}
              fromZero
            />
          </ScrollView>
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Add Budget Record</Text>
        <View style={s.formRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={budgetAmount}
            onChangeText={setBudgetAmount}
            placeholder="Amount (USD)"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={budgetProvider}
            onChangeText={setBudgetProvider}
            placeholder="Provider"
            placeholderTextColor="#666"
          />
        </View>
        <TextInput
          style={s.input}
          value={budgetDesc}
          onChangeText={setBudgetDesc}
          placeholder="Description (optional)"
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={s.addBtn} onPress={handleAddBudget} disabled={saving}>
          <Text style={s.addBtnText}>{saving ? 'Saving...' : '+ Add Budget'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Budget History</Text>
        {budgets.length > 0 ? (
          budgets.map((b) => (
            <View key={b.id} style={s.budgetRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.budgetAmount}>${b.amount_usd.toFixed(2)}</Text>
                <Text style={s.budgetMeta}>{b.provider}{b.description ? ` · ${b.description}` : ''}</Text>
              </View>
              <Text style={s.budgetDate}>{new Date(b.created_at).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={s.empty}>No budget records yet</Text>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chartCard: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  chartTitle: { color: '#FF6347', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  section: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  sectionTitle: { color: '#00FF00', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  formRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    backgroundColor: '#222', color: '#FFF', padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', fontSize: 13, marginBottom: 8,
  },
  addBtn: {
    backgroundColor: '#00FF00', paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  addBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  budgetAmount: { color: '#1E90FF', fontSize: 14, fontWeight: '700' },
  budgetMeta: { color: '#888', fontSize: 10, marginTop: 2 },
  budgetDate: { color: '#666', fontSize: 10 },
  empty: { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
});
