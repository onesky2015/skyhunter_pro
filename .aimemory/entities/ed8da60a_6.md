# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 90-181
# Type: Source Code

```typescript
{ text: 'Delete', style: 'destructive', onPress: () => deleteMonitor(task.id) },
          ]
        );
      }
    },
    [deleteMonitor]
  );

  const fetchTaskReport = useCallback(
    (monitorId: number) => monitorApi.getTaskReport(userToken, monitorId, handle401Error),
    [userToken, handle401Error]
  );

  // --- 未登录状态 ---
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{"Please login to view monitors"}</Text>
      </View>
    );
  }

  // --- 加载中状态 ---
  if (loading && monitors.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00FF00" />
      </View>
    );
  }

  // --- 空列表状态 ---
  if (monitors.length === 0) {
    return (
      <View style={styles.wrapper}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF00" />
          }
        >
          <Text style={styles.emptyText}>{"No monitors yet."}</Text>
          <Text style={styles.emptySubtext}>{"Tap + to create a monitor"}</Text>
        </ScrollView>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setCreateModalVisible(true)}
        >
          <Text style={styles.fabText}>{"+"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.trashButton}
          onPress={() => {
            fetchTrashMonitors();
            setTrashModalVisible(true);
          }}
        >
          <Text style={styles.trashButtonText}>{"\uD83D\uDDD1\uFE0F"}</Text>
        </TouchableOpacity>
        <CreateMonitorModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSubmit={createMonitor}
          userCredits={userInfo?.credits ?? 0}
        />
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

  // Active Tab 包含 active + found（两者均在监控中，found 只是已触发通知）
  const filteredMonitors = monitors.filter((task) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return task.status === 'active' || task.status === 'found';
    return task.status === filterStatus;
  });

  // 统计各状态任务数量（Active 计数包含 found）
  const statusCounts = {
    all: monitors.length,
    active: monitors.filter((t) => t.status === 'active' || t.status === 'found').length,
    paused: monitors.filter((t) => t.status === 'paused').length,
    found: monitors.filter((t) => t.status === 'found').length,
    expired: monitors.filter((t) => t.status === 'expired').length,
```
