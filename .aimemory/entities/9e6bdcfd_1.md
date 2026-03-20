# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 92-171
# Type: Object: DashboardTab

```typescript
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
```
