import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';

export default function PaymentCancelScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>❌</Text>
        <Text style={styles.title}>{t('purchase', 'paymentCancelled') || 'Payment Cancelled'}</Text>
        <Text style={styles.subtitle}>
          {t('purchase', 'noCharges') || 'No charges were made. You can try again anytime.'}
        </Text>

        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={() => router.replace('/purchase')}
        >
          <Text style={styles.buttonPrimaryText}>
            {t('purchase', 'tryAgain') || 'Try Again'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.buttonSecondaryText}>
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
      color: theme.colors.danger,
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
      marginBottom: 24,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      width: '100%',
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonPrimaryText: {
      color: theme.colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    buttonSecondary: {
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: theme.radius.md,
      width: '100%',
      alignItems: 'center',
    },
    buttonSecondaryText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
  });
