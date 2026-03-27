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
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';

export default function MonitorsScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
          `${t('monitors', 'deleteConfirm').replace('{id}', String(task.id))}\n${t('monitors', 'deleteRoute').replace('{origin}', task.origin).replace('{destination}', task.destination)}`
        );
        if (confirmed) {
          deleteMonitor(task.id);
        }
      } else {
        Alert.alert(
          t('monitors', 'deleteConfirm').replace('{id}', String(task.id)),
          t('monitors', 'deleteRoute').replace('{origin}', task.origin).replace('{destination}', task.destination),
          [
            { text: t('common', 'cancel'), style: 'cancel' },
            { text: t('common', 'delete'), style: 'destructive', onPress: () => deleteMonitor(task.id) },
          ]
        );
      }
    },
    [deleteMonitor, t]
  );

  const fetchTaskReport = useCallback(
    (monitorId: number) => monitorApi.getTaskReport(userToken, monitorId, handle401Error),
    [userToken, handle401Error]
  );

  // --- 未登录状态 ---
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('monitors', 'pleaseLogin')}</Text>
      </View>
    );
  }

  // --- 加载中状态 ---
  if (loading && monitors.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
        >
          <Text style={styles.emptyText}>{t('monitors', 'noMonitorsYet')}</Text>
          <Text style={styles.emptySubtext}>{t('monitors', 'tapToCreate')}</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
        }
      >
        <Text style={styles.title}>📊 {t('monitors', 'title').toUpperCase()}</Text>

        {/* Status Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'all' && styles.tabActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.tabText, filterStatus === 'all' && styles.tabTextActive]}>
              {`${t('monitors', 'all')}${statusCounts.all > 0 ? ` (${statusCounts.all})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'active' && styles.tabActive]}
            onPress={() => setFilterStatus('active')}
          >
            <Text style={[styles.tabText, filterStatus === 'active' && styles.tabTextActive]}>
              {`${t('monitors', 'active')}${statusCounts.active > 0 ? ` (${statusCounts.active})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'paused' && styles.tabActive]}
            onPress={() => setFilterStatus('paused')}
          >
            <Text style={[styles.tabText, filterStatus === 'paused' && styles.tabTextActive]}>
              {`${t('monitors', 'paused')}${statusCounts.paused > 0 ? ` (${statusCounts.paused})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'found' && styles.tabActive]}
            onPress={() => setFilterStatus('found')}
          >
            <Text style={[styles.tabText, filterStatus === 'found' && styles.tabTextActive]}>
              {`${t('monitors', 'found')}${statusCounts.found > 0 ? ` (${statusCounts.found})` : ''}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filterStatus === 'expired' && styles.tabActive]}
            onPress={() => setFilterStatus('expired')}
          >
            <Text style={[styles.tabText, filterStatus === 'expired' && styles.tabTextActive]}>
              {`${t('monitors', 'expired')}${statusCounts.expired > 0 ? ` (${statusCounts.expired})` : ''}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monitor 列表或空状态 */}
        {filteredMonitors.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {filterStatus === 'all' ? t('monitors', 'noMonitorsYet') : t('monitors', 'noFilteredMonitors').replace('{status}', t('monitors', filterStatus))}
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

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 16,
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 16,
      marginBottom: 8,
    },
    emptySubtext: {
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 16,
      textAlign: 'center',
      marginTop: 32,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 80,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, 1),
    },
    fabText: {
      color: theme.colors.accentText,
      fontSize: 32,
      fontWeight: '700',
    },
    trashButton: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    trashButtonText: {
      fontSize: 24,
    },
    tabContainer: {
      flexDirection: 'row',
      marginBottom: 16,
      gap: 8,
      flexWrap: 'wrap',
    },
    tab: {
      flex: 1,
      minWidth: 80,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    tabText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
    },
    tabTextActive: {
      color: theme.colors.accentText,
      fontWeight: '700',
    },
    emptyState: {
      padding: 32,
      alignItems: 'center',
    },
  });
