# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 252-364
# Type: Source Code

```typescript
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

      {/* FAB: Trash Button */}
      <TouchableOpacity
        style={styles.trashButton}
        onPress={() => {
          fetchTrashMonitors();
          setTrashModalVisible(true);
        }}
      >
        <Text style={styles.trashButtonText}>{"\uD83D\uDDD1\uFE0F"}</Text>
      </TouchableOpacity>

      {/* Create Monitor Modal */}
      <CreateMonitorModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={createMonitor}
        userCredits={userInfo?.credits ?? 0}
      />

      {/* Edit Monitor Modal */}
      <EditMonitorModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedMonitor(null);
        }}
        monitor={selectedMonitor}
        onSubmit={async (id, params: MonitorUpdatePayload) => {
          return await updateMonitor(id, params);
        }}
        userCredits={userInfo?.credits ?? 0}
        onTopUp={() => {
          setEditModalVisible(false);
          setSelectedMonitor(null);
          router.push('/(tabs)/profile');
        }}
      />

      {/* Trash Modal */}
      <TrashModal
        visible={trashModalVisible}
        onClose={() => setTrashModalVisible(false)}
        monitors={trashMonitors}
        loading={trashLoading}
        onRestore={restoreMonitor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    paddingBottom: 100,
  },
  title: {
    color: '#00FF00',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyText: {
    color: '#666666',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444444',
    fontSize: 14,
  },
  errorText: {
```
