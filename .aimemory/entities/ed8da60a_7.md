# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 181-252
# Type: Source Code

```typescript
archived: monitors.filter((t) => t.status === 'archived').length,
  };

  const renderMonitorItem = (task: MonitorTask) => (
    <MonitorCard
      key={task.id}
      task={task}
      onPress={() => {
        setSelectedMonitor(task);
        setEditModalVisible(true);
      }}
      onLongPress={() => handleDeleteConfirm(task)}
      onPauseResume={() => {
        const newStatus = task.status === 'paused' ? 'active' : 'paused';
        updateMonitorStatus(task.id, newStatus);
      }}
      onDelete={() => deleteMonitor(task.id)}
      onArchive={() => archiveMonitor(task.id)}
      onFetchReport={fetchTaskReport}
    />
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
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
```
