import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';

export default function PaymentSuccessScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const { refreshUserInfo, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    const refresh = async () => {
      try {
        if (isAuthenticated) {
          await refreshUserInfo();
        }
      } finally {
        setRefreshing(false);
      }
    };
    refresh();
  }, [isAuthenticated, refreshUserInfo]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>{t('purchase', 'paymentSuccess') || 'Payment Successful'}</Text>
        <Text style={styles.subtitle}>
          {t('purchase', 'creditsWillBeAdded') || 'Your credits have been added to your account.'}
        </Text>

        {refreshing ? (
          <ActivityIndicator color={theme.colors.accent} size="small" style={{ marginTop: 16 }} />
        ) : (
          <Text style={styles.hint}>
            {t('purchase', 'balanceUpdated') || 'Your balance has been updated.'}
          </Text>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonText}>
            {t('purchase', 'backToDashboard') || 'Back to Dashboard'}
          </Text>
        </TouchableOpacity>
      </View>
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
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, 1),
    },
    icon: {
      fontSize: 48,
      marginBottom: 16,
    },
    title: {
      color: theme.colors.accent,
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
    hint: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    button: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      marginTop: 16,
      width: '100%',
      alignItems: 'center',
    },
    buttonText: {
      color: theme.colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
  });
