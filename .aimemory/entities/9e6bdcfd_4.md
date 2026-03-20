# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 1-75
# Type: Source Code

```typescript
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
```
