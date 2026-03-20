# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 278-328
# Type: Function: MonitorsScreen

```typescript
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
```
