# Source: frontend/app/(tabs)/monitors.tsx
# Lines: 1-90
# Type: Source Code

```typescript
// filename: app/(tabs)/monitors.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useMonitors } from '../../hooks/useMonitors';
import { MonitorTask, MonitorUpdatePayload } from '../../types';
import { MonitorCard } from '../../components/MonitorCard';
import { monitorApi } from '../../services/api';
import { CreateMonitorModal } from '../../components/CreateMonitorModal';
import { EditMonitorModal } from '../../components/EditMonitorModal';
import { TrashModal } from '../../components/TrashModal';

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
```
