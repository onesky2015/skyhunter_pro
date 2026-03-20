# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 148-226
# Type: Source Code

```typescript
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
```
