// filename: app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

export default function Index() {
  const { t } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    if (loading) return;
    
    // 等待路由系统就绪后再跳转
    const performNavigation = () => {
      try {
        if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/login');
        }
      } catch (err) {
        console.error('路由跳转失败:', err);
        // 如果路由未就绪，延迟重试
        setTimeout(performNavigation, 100);
      }
    };

    // 使用 requestAnimationFrame 确保在下一帧执行，此时路由系统应该已初始化
    requestAnimationFrame(performNavigation);
  }, [isAuthenticated, loading, router]);

  // 显示加载状态
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SKYHUNTER</Text>
      <ActivityIndicator size="large" color={theme.colors.accent} style={{ marginTop: 20 }} />
      <Text style={styles.loadingText}>{t('index', 'initializing')}</Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    logo: {
      color: theme.colors.accent,
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: 4,
      ...getShadowStyle(theme, theme.name === 'glass' ? 1.2 : 1),
    },
    loadingText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      marginTop: 12,
      letterSpacing: 2,
    },
  });
