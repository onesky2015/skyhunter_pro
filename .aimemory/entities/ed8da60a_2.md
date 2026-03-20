# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 209-278
# Type: Function: MonitorsScreen

```typescript
<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF00" />
        }
      >
        <Text style={styles.title}>{"\uD83D\uDCCA MONITORS"}</Text>

        {/* Status Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'all' && styles.tabActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.tabText, filterStatus === 'all' && styles.tabTextActive]}>
              {`All${statusCounts.all > 0 ? ` (${statusCounts.all})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'active' && styles.tabActive]}
            onPress={() => setFilterStatus('active')}
          >
            <Text style={[styles.tabText, filterStatus === 'active' && styles.tabTextActive]}>
              {`Active${statusCounts.active > 0 ? ` (${statusCounts.active})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'paused' && styles.tabActive]}
            onPress={() => setFilterStatus('paused')}
          >
            <Text style={[styles.tabText, filterStatus === 'paused' && styles.tabTextActive]}>
              {`Paused${statusCounts.paused > 0 ? ` (${statusCounts.paused})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'found' && styles.tabActive]}
            onPress={() => setFilterStatus('found')}
          >
            <Text style={[styles.tabText, filterStatus === 'found' && styles.tabTextActive]}>
              {`Found${statusCounts.found > 0 ? ` (${statusCounts.found})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'expired' && styles.tabActive]}
            onPress={() => setFilterStatus('expired')}
          >
            <Text style={[styles.tabText, filterStatus === 'expired' && styles.tabTextActive]}>
              {`Expired${statusCounts.expired > 0 ? ` (${statusCounts.expired})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monitor 列表或空状态 */}
        {filteredMonitors.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {filterStatus === 'all' ? 'No monitors yet.' : `No ${filterStatus} monitors.`}
            </Text>
          </View>
        ) : (
          filteredMonitors.map(renderMonitorItem)
        )}
      </ScrollView>

      {/* FAB: Create Button（放在 ScrollView 外部确保 absolute 定位正确） */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.fabText}>{"+"}</Text>
      </TouchableOpacity>
```
