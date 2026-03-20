import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { analyticsApi } from '../../services/api';
import { AnalyticsOverview, UserTrendsData, ApiUsageTrendsData, GeoDistributionData } from '../../types';
import { KpiCard } from './KpiCard';
import { TimeRangePicker } from './TimeRangePicker';

interface Props {
  userToken: string | null;
  on401: () => void;
}

const CHART_COLORS = ['#00FF00', '#1E90FF', '#FFD700', '#FF6347', '#9370DB', '#20B2AA', '#FF69B4', '#FFA500'];
const screenWidth = Dimensions.get('window').width;
const chartWidth = Math.min(screenWidth - 80, 600);

export const DashboardTab: React.FC<Props> = ({ userToken, on401 }) => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [userTrends, setUserTrends] = useState<UserTrendsData | null>(null);
  const [apiUsage, setApiUsage] = useState<ApiUsageTrendsData | null>(null);
  const [geo, setGeo] = useState<GeoDistributionData | null>(null);
  const [range, setRange] = useState('day');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      const [ov, ut, au, gd] = await Promise.all([
        analyticsApi.getOverview(userToken, on401),
        analyticsApi.getUserTrends(userToken, range, on401),
        analyticsApi.getApiUsage(userToken, range, on401),
        analyticsApi.getGeo(userToken, on401),
      ]);
      setOverview(ov);
      setUserTrends(ut);
      setApiUsage(au);
      setGeo(gd);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userToken, range, on401]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async (type: 'users' | 'api-usage' | 'costs' | 'audit-log') => {
    if (!userToken) return;
    try {
      const csv = await analyticsApi.exportCsv(userToken, type, range);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Export', `CSV data exported (${csv.length} bytes). Web download supported.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Export Error', msg);
      }
    }
  };

  if (loading && !overview) {
    return <ActivityIndicator size="large" color="#00FF00" style={{ marginTop: 40 }} />;
  }

  const trendLabels = userTrends?.data?.map(d => d.label) || [];
  const trendValues = userTrends?.data?.map(d => d.value) || [];
  const apiLabels = apiUsage?.total_calls?.map(d => d.label) || [];
  const apiValues = apiUsage?.total_calls?.map(d => d.value) || [];

  const maxTrendLabels = 8;
  const trendStep = Math.max(1, Math.ceil(trendLabels.length / maxTrendLabels));
  const displayTrendLabels = trendLabels.map((l, i) => i % trendStep === 0 ? l : '');
  const displayApiLabels = apiLabels.map((l, i) => i % trendStep === 0 ? l : '');

  const pieData = (geo?.data || []).slice(0, 6).map((item, idx) => ({
    name: item.country,
    population: item.count,
    color: CHART_COLORS[idx % CHART_COLORS.length],
    legendFontColor: '#CCC',
    legendFontSize: 11,
  }));

  const chartConfig = {
    backgroundGradientFrom: '#1A1A1A',
    backgroundGradientTo: '#1A1A1A',
    color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
    labelColor: () => '#888',
    decimalCount: 0,
    propsForDots: { r: '3', strokeWidth: '1', stroke: '#00FF00' },
    propsForBackgroundLines: { stroke: '#333' },
  };

  return (
    <View>
      {overview && (
        <>
          <View style={s.kpiRow}>
            <KpiCard label="Total Users" value={overview.total_users} />
            <KpiCard label="New Today" value={overview.today_new_users} color="#1E90FF" />
            <KpiCard label="Active Monitors" value={overview.active_monitors} color="#FFD700" />
          </View>
          <View style={s.kpiRow}>
            <KpiCard label="API Calls Today" value={overview.today_api_calls} color="#FF6347" />
            <KpiCard label="Searches Today" value={overview.today_searches} />
            <KpiCard
              label="Scheduler"
              value={overview.scheduler_status}
              color={overview.scheduler_status === 'Running' ? '#00FF00' : '#FF4444'}
            />
          </View>
          <View style={s.kpiRow}>
            <KpiCard label="DAU" value={overview.dau} color="#20B2AA" />
            <KpiCard label="WAU" value={overview.wau} color="#9370DB" />
            <KpiCard label="MAU" value={overview.mau} color="#FF69B4" />
          </View>
          <View style={s.kpiRow}>
            <KpiCard
              label="Avg Response"
              value={`${overview.avg_response_time_ms}ms`}
              color="#FFA500"
            />
            <KpiCard
              label="Error Rate"
              value={`${overview.error_rate_percent}%`}
              color={overview.error_rate_percent > 5 ? '#FF4444' : '#00FF00'}
            />
            <KpiCard label="Total Searches" value={overview.total_searches} color="#1E90FF" />
          </View>
        </>
      )}

      <TimeRangePicker value={range} onChange={setRange} />

      {trendValues.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>User Registration Trend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: displayTrendLabels,
                datasets: [{ data: trendValues.length > 0 ? trendValues : [0] }],
              }}
              width={Math.max(chartWidth, trendValues.length * 28)}
              height={180}
              chartConfig={chartConfig}
              bezier
              style={s.chart}
              withInnerLines={false}
              fromZero
            />
          </ScrollView>
        </View>
      )}

      {apiValues.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>API Usage Trend</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: displayApiLabels,
                datasets: [{ data: apiValues.length > 0 ? apiValues : [0], color: () => '#1E90FF' }],
              }}
              width={Math.max(chartWidth, apiValues.length * 28)}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`,
              }}
              bezier
              style={s.chart}
              withInnerLines={false}
              fromZero
            />
          </ScrollView>
        </View>
      )}

      {pieData.length > 0 && (
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>User Geographic Distribution</Text>
          <PieChart
            data={pieData}
            width={chartWidth}
            height={180}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="10"
            absolute
          />
          {geo && (
            <Text style={s.geoSub}>
              {geo.total_with_geo} with location · {geo.total_without_geo} unknown
            </Text>
          )}
        </View>
      )}

      <View style={s.exportSection}>
        <Text style={s.exportTitle}>Data Export</Text>
        <View style={s.exportRow}>
          <TouchableOpacity style={s.exportBtn} onPress={() => handleExport('users')}>
            <Text style={s.exportBtnText}>Users CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportBtn} onPress={() => handleExport('api-usage')}>
            <Text style={s.exportBtnText}>API Usage CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportBtn} onPress={() => handleExport('costs')}>
            <Text style={s.exportBtnText}>Costs CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportBtn} onPress={() => handleExport('audit-log')}>
            <Text style={s.exportBtnText}>Audit Log CSV</Text>
          </TouchableOpacity>
        </View>
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
  chartTitle: { color: '#00FF00', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chart: { borderRadius: 8 },
  geoSub: { color: '#666', fontSize: 10, marginTop: 6, textAlign: 'center' },
  exportSection: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  exportTitle: { color: '#00FF00', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportBtn: {
    backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 6, borderWidth: 1, borderColor: '#444',
  },
  exportBtnText: { color: '#CCC', fontSize: 12, fontWeight: '600' },
});
