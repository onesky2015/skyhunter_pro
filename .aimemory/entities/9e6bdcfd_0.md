# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 18-92
# Type: Object: DashboardTab

```typescript
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
```
