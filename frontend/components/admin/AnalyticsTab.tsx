import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { analyticsApi } from '../../services/api';
import { UserActivityData, UserActivityItem, TopRouteItem } from '../../types';

interface Props {
  userToken: string | null;
  on401: () => void;
}

export const AnalyticsTab: React.FC<Props> = ({ userToken, on401 }) => {
  const [activity, setActivity] = useState<UserActivityData | null>(null);
  const [topRoutes, setTopRoutes] = useState<TopRouteItem[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      const [actData, routeData] = await Promise.all([
        analyticsApi.getUserActivity(userToken, { page, page_size: 15, q: search }, on401),
        analyticsApi.getTopRoutes(userToken, on401),
      ]);
      setActivity(actData);
      setTopRoutes(routeData.data || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userToken, page, search, on401]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = activity ? Math.max(1, Math.ceil(activity.total / activity.page_size)) : 1;

  return (
    <View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Top 10 Routes</Text>
        {topRoutes.length > 0 ? (
          topRoutes.map((r, i) => (
            <View key={`${r.origin}-${r.destination}`} style={s.routeRow}>
              <Text style={s.routeRank}>#{i + 1}</Text>
              <Text style={s.routeLabel}>{r.origin} → {r.destination}</Text>
              <Text style={s.routeCount}>{r.count}</Text>
            </View>
          ))
        ) : (
          <Text style={s.empty}>No route data yet</Text>
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>User Activity</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={(t) => { setSearch(t); setPage(1); }}
          placeholder="Search by email..."
          placeholderTextColor="#666"
        />

        {loading ? (
          <ActivityIndicator size="small" color="#00FF00" style={{ marginVertical: 20 }} />
        ) : (
          <>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 2.5 }]}>Email</Text>
              <Text style={[s.th, { flex: 1 }]}>Searches</Text>
              <Text style={[s.th, { flex: 1 }]}>Monitors</Text>
              <Text style={[s.th, { flex: 1 }]}>Consumed</Text>
              <Text style={[s.th, { flex: 1 }]}>Country</Text>
            </View>
            {(activity?.items || []).map((u) => (
              <View key={u.user_id} style={s.tableRow}>
                <Text style={[s.td, { flex: 2.5 }]} numberOfLines={1}>{u.email}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{u.search_count}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{u.monitor_count}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center', color: '#FFD700' }]}>{u.credits_consumed}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'center' }]}>{u.country || '-'}</Text>
              </View>
            ))}
            {(activity?.items || []).length === 0 && (
              <Text style={s.empty}>No users found</Text>
            )}

            <View style={s.pagination}>
              <TouchableOpacity
                style={[s.pageBtn, page <= 1 && s.pageBtnDisabled]}
                disabled={page <= 1}
                onPress={() => setPage(p => p - 1)}
              >
                <Text style={s.pageBtnText}>← Prev</Text>
              </TouchableOpacity>
              <Text style={s.pageInfo}>{page} / {totalPages} ({activity?.total || 0})</Text>
              <TouchableOpacity
                style={[s.pageBtn, page >= totalPages && s.pageBtnDisabled]}
                disabled={page >= totalPages}
                onPress={() => setPage(p => p + 1)}
              >
                <Text style={s.pageBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  section: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  sectionTitle: { color: '#00FF00', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  routeRank: { color: '#FFD700', fontSize: 12, fontWeight: '700', width: 30 },
  routeLabel: { color: '#CCC', fontSize: 13, flex: 1 },
  routeCount: { color: '#00FF00', fontSize: 13, fontWeight: '700', width: 50, textAlign: 'right' },
  searchInput: {
    backgroundColor: '#222', color: '#FFF', padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#333', fontSize: 13, marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1,
    borderBottomColor: '#444', marginBottom: 4,
  },
  th: { color: '#00FF00', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  td: { color: '#CCC', fontSize: 11 },
  empty: { color: '#666', fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  pagination: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 16, marginTop: 10,
  },
  pageBtn: { backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  pageBtnDisabled: { opacity: 0.3 },
  pageBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  pageInfo: { color: '#888', fontSize: 11 },
});
