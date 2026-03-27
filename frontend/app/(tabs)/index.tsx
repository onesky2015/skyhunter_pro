import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useMonitors } from '../../hooks/useMonitors';
import { monitorApi } from '../../services/api';
import { MonitorTask, TaskReportItem } from '../../types';
import { formatPrice, timeAgoLocalized } from '../../constants/utils';
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';
import { API_URL } from '../../constants/api';

const eagleLogo = require('../../assets/eagle-logo.png');

type FeedItem = {
  id: string;
  route: string;
  checkedAt: string;
  price?: number;
};

const toTimestamp = (isoStr: string | null | undefined): number => {
  if (!isoStr) return 0;
  const normalized = /[Zz]$/.test(isoStr) || /[+-]\d{2}:\d{2}$/.test(isoStr) ? isoStr : `${isoStr}Z`;
  const ts = new Date(normalized).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const CyberShimmerText = ({ text, baseStyle, glowColor, baseColor }: { text: string, baseStyle: any, glowColor: string, baseColor: string }) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(2000), // delay before sweep 2s
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1500, // sweeping duration 1.5s
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, [animValue]);

  const chars = text.split('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {chars.map((char, i) => {
        const ratio = i / Math.max(1, chars.length - 1);
        const opacity = animValue.interpolate({
          inputRange: [ratio - 0.2, ratio, ratio + 0.2],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });

        return (
          <View key={i} style={{ position: 'relative' }}>
            <Text style={[baseStyle, { color: baseColor }]}>{char}</Text>
            <Animated.Text
              style={[
                baseStyle,
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  color: glowColor,
                  textShadowColor: glowColor,
                  textShadowRadius: 8,
                  opacity,
                },
              ]}
            >
              {char}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
};

export default function DashboardScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const timeT = useCallback((section: string, key: string) => t(section as keyof ReturnType<typeof useI18n>['t'] extends never ? never : any, key), [t]);
  const router = useRouter();
  const { userToken, userInfo, isAuthenticated, handle401Error, refreshUserInfo } = useAuth();
  const {
    monitors,
    loading,
    refreshing,
    fetchMonitors,
    setRefreshing,
  } = useMonitors(userToken, handle401Error, refreshUserInfo);

  const [feedLoading, setFeedLoading] = useState(false);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);

  const [popularLoading, setPopularLoading] = useState(false);
  const [popularFlights, setPopularFlights] = useState<any[]>([]);

  const lastFeedRequestRef = useRef(0);
  const isFirstFocus = useRef(true);

  const loadDashboard = useCallback(() => {
    if (!isAuthenticated) return;
    fetchMonitors();
    refreshUserInfo().catch(() => {
      // 用户信息刷新失败不阻断首页渲染
    });
  }, [isAuthenticated, fetchMonitors, refreshUserInfo]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let mounted = true;
    const fetchPopular = async () => {
      if (!isAuthenticated) return;
      setPopularLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/v1/flights/popular`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (mounted && Array.isArray(data)) setPopularFlights(data);
        } else {
          console.warn('Popular API response not OK', response.status);
        }
      } catch (err) {
        console.warn('Failed to fetch popular flights', err);
      } finally {
        if (mounted) setPopularLoading(false);
      }
    };
    fetchPopular();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      loadDashboard();
    }, [isAuthenticated, loadDashboard])
  );

  useEffect(() => {
    if (!isAuthenticated || monitors.length === 0) {
      setLiveFeed([]);
      setTotalSavings(0);
      return;
    }

    const requestId = Date.now();
    lastFeedRequestRef.current = requestId;
    setFeedLoading(true);

    const fetchReports = async () => {
      try {
        const reportGroups = await Promise.all(
          monitors.map(async (task) => {
            try {
              const items = await monitorApi.getTaskReport(userToken, task.id, handle401Error, 10);
              return { task, items };
            } catch {
              return { task, items: [] as TaskReportItem[] };
            }
          })
        );

        if (lastFeedRequestRef.current !== requestId) return;

        const feedItems: FeedItem[] = [];
        let savingsSum = 0;

        reportGroups.forEach(({ task, items }) => {
          items.forEach((item, index) => {
            if (item.event_type !== 'price_check') return;

            if (item.previous_price != null && item.price != null && item.previous_price > item.price) {
              savingsSum += item.previous_price - item.price;
            }

            feedItems.push({
              id: `${task.id}-${item.event_at}-${index}`,
              route: `${task.origin}→${task.destination}`,
              checkedAt: item.event_at,
              price: item.price,
            });
          });
        });

        feedItems.sort((a, b) => toTimestamp(b.checkedAt) - toTimestamp(a.checkedAt));
        setLiveFeed(feedItems.slice(0, 3));
        setTotalSavings(savingsSum);
      } finally {
        if (lastFeedRequestRef.current === requestId) {
          setFeedLoading(false);
        }
      }
    };

    fetchReports();
  }, [isAuthenticated, monitors, userToken, handle401Error]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard, setRefreshing]);

  const activeProbes = useMemo(
    () => monitors.filter((task) => task.status === 'active' || task.status === 'found').length,
    [monitors]
  );

  const foundCount = useMemo(
    () => monitors.filter((task) => task.status === 'found').length,
    [monitors]
  );

  const successRate = useMemo(() => {
    if (monitors.length === 0) return '0%';
    return `${Math.round((foundCount / monitors.length) * 100)}%`;
  }, [foundCount, monitors.length]);

  const latestMonitors = useMemo(() => {
    const sorted = [...monitors].sort((a, b) => {
      const bTs = toTimestamp(b.last_checked_at) || toTimestamp(b.created_at);
      const aTs = toTimestamp(a.last_checked_at) || toTimestamp(a.created_at);
      return bTs - aTs;
    });
    return sorted.slice(0, 3);
  }, [monitors]);

  if (!isAuthenticated) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>{t('dashboard', 'pleaseLogin')}</Text>
      </View>
    );
  }

  if (loading && monitors.length === 0) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.logoWrap}>
          <Image source={eagleLogo} style={styles.eagleLogo} resizeMode="contain" />
          <CyberShimmerText 
            text="SKYHUNTER" 
            baseStyle={styles.brandText} 
            baseColor={theme.colors.textMuted} 
            glowColor={theme.colors.accent} 
          />
        </View>
        <View style={styles.creditsWrap}>
          <Text style={styles.creditsLabel}>{t('dashboard', 'credits')}</Text>
          <Text style={styles.creditsValue}>💎 {userInfo?.credits ?? 0}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.heroCard}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/search')}
      >
        <Text style={styles.heroEyebrow}>{t('dashboard', 'heroEyebrow')}</Text>
        <Text style={styles.heroTitle}>{t('dashboard', 'newHunt')}</Text>
        <Text style={styles.heroSubtitle}>{t('dashboard', 'heroSubtitle')}</Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.miniCard, styles.miniCardPrimary]}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/monitors')}
        >
          <Text style={styles.miniLabel}>{t('dashboard', 'activeProbes')}</Text>
          <Text style={styles.miniValue}>{activeProbes}</Text>
          <Text style={styles.miniHint}>{t('dashboard', 'activeProbesHint')}</Text>
        </TouchableOpacity>

        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>{t('dashboard', 'successRate')}</Text>
          <Text style={styles.miniValue}>{successRate}</Text>
          <Text style={styles.miniHint}>{t('dashboard', 'foundCount').replace('{n}', String(foundCount))}</Text>
        </View>

        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>{t('dashboard', 'totalSavings')}</Text>
          <Text style={styles.miniValueSmall}>{formatPrice(totalSavings)}</Text>
          <Text style={styles.miniHint}>{t('dashboard', 'historyBased')}</Text>
        </View>
      </View>

      {/* 热门航线 */}
      <View style={[styles.sectionCard, { marginBottom: 16 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{(t('dashboard', 'popularRoutes') as string) || '热门航线'}</Text>
          {popularLoading ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
        </View>

        {popularFlights.length > 0 ? (
          popularFlights.map((route, idx) => (
            <View key={idx} style={styles.feedItem}>
              <View style={styles.feedPulse} />
              <View style={styles.feedTextWrap}>
                <Text style={styles.feedRoute}>
                  {route.origin} → {route.destination}
                </Text>
                <Text style={styles.feedMeta}>
                  {route.price != null
                    ? (t('dashboard', 'feedPrice') as string).replace('{price}', formatPrice(route.price))
                    : t('dashboard', 'pricePending')}
                </Text>
              </View>
            </View>
          ))
        ) : !popularLoading ? (
          <Text style={styles.emptyText}>{t('dashboard', 'noLiveFeed')}</Text>
        ) : null}
      </View>

      {/* 实时动态 */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard', 'liveFeed')}</Text>
          {feedLoading ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
        </View>

        {liveFeed.length > 0 ? (
          liveFeed.map((item) => (
            <View key={item.id} style={styles.feedItem}>
              <View style={styles.feedPulse} />
              <View style={styles.feedTextWrap}>
                <Text style={styles.feedRoute}>
                  {item.route}: {t('dashboard', 'scanned')} {timeAgoLocalized(item.checkedAt, timeT)}
                </Text>
                <Text style={styles.feedMeta}>
                  {item.price != null
                    ? t('dashboard', 'feedPrice').replace('{price}', formatPrice(item.price))
                    : t('dashboard', 'pricePending')}
                </Text>
              </View>
            </View>
          ))
        ) : latestMonitors.length > 0 ? (
          latestMonitors.map((task) => (
            <View key={task.id} style={styles.feedItem}>
              <View style={styles.feedPulse} />
              <View style={styles.feedTextWrap}>
                <Text style={styles.feedRoute}>
                  {task.origin}→{task.destination}: {t('dashboard', 'scanned')} {timeAgoLocalized(task.last_checked_at ?? task.created_at, timeT)}
                </Text>
                <Text style={styles.feedMeta}>
                  {task.current_price != null
                    ? t('dashboard', 'feedPrice').replace('{price}', formatPrice(task.current_price))
                    : t('dashboard', 'pricePending')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t('dashboard', 'noLiveFeed')}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 16,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: 24,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 16,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 72,
    },
    headerSpacer: {
      width: 72,
    },
    logoWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eagleLogo: {
      width: 36,
      height: 36,
      borderRadius: 10,
    },
    brandText: {
      marginTop: 4,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 4,
    },
    creditsWrap: {
      width: 72,
      alignItems: 'flex-end',
      gap: 2,
    },
    creditsLabel: {
      color: theme.colors.textSoft,
      fontSize: 10,
      textTransform: 'uppercase',
    },
    creditsValue: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: '700',
    },
    heroCard: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.lg,
      paddingVertical: 24,
      paddingHorizontal: 18,
      alignItems: 'center',
      ...getShadowStyle(theme, 1),
    },
    heroEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.4,
      marginBottom: 10,
    },
    heroTitle: {
      color: theme.colors.accentText,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      fontSize: 22,
      fontWeight: '800',
      overflow: 'hidden',
      textAlign: 'center',
      width: '100%',
    },
    heroSubtitle: {
      marginTop: 10,
      color: theme.colors.textMuted,
      fontSize: 12,
      letterSpacing: 0.5,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    miniCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      minHeight: 110,
      justifyContent: 'space-between',
      ...getShadowStyle(theme, theme.name === 'light' ? 0.6 : 1),
    },
    miniCardPrimary: {
      borderColor: theme.colors.borderStrong,
    },
    miniLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    miniValue: {
      color: theme.colors.accent,
      fontSize: 26,
      fontWeight: '800',
    },
    miniValueSmall: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '800',
    },
    miniHint: {
      color: theme.colors.textSoft,
      fontSize: 11,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.6 : 1),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: '700',
    },
    feedItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    feedPulse: {
      width: 8,
      height: 8,
      marginTop: 6,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
    },
    feedTextWrap: {
      flex: 1,
    },
    feedRoute: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    feedMeta: {
      marginTop: 4,
      color: theme.colors.textMuted,
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 13,
      paddingVertical: 10,
    },
  });
