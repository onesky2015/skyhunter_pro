# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 25-126
# Type: Function: MonitorsScreen

```typescript
export default function MonitorsScreen() {
  const router = useRouter();
  const { userToken, userInfo, isAuthenticated, handle401Error, refreshUserInfo } = useAuth();
  const {
    monitors,
    loading,
    refreshing,
    trashMonitors,
    trashLoading,
    fetchMonitors,
    fetchTrashMonitors,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    restoreMonitor,
    updateMonitorStatus,
    archiveMonitor,
    setRefreshing,
  } = useMonitors(userToken, handle401Error, refreshUserInfo);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [trashModalVisible, setTrashModalVisible] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorTask | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'found' | 'expired' | 'archived'>('all');

  // 初始加载：仅 mount 时拉取一次
  useEffect(() => {
    if (isAuthenticated) {
      fetchMonitors();
    }
  }, [isAuthenticated, fetchMonitors]);

  // 从其他 tab 返回时刷新（跳过首次 mount，避免与 useEffect 重复请求导致一直 loading）
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      fetchMonitors();
    }, [isAuthenticated, fetchMonitors])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMonitors();
  }, [setRefreshing, fetchMonitors]);

  const handleDeleteConfirm = useCallback(
    (task: MonitorTask) => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const confirmed = window.confirm(
          `Delete Monitor #${task.id}?\n${task.origin} → ${task.destination}`
        );
        if (confirmed) {
          deleteMonitor(task.id);
        }
      } else {
        Alert.alert(
          `Delete Monitor #${task.id}?`,
          `${task.origin} → ${task.destination}`,
          [
            { text: 'Cancel', style: 'cancel' },
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
```
