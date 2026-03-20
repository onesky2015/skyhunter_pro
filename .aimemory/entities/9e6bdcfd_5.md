# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 75-148
# Type: Source Code

```typescript
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
```
