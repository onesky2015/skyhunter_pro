// filename: app/auth/forgot.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '../../services/api';
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';

export default function ForgotScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStep1 = async () => {
    if (!email.trim()) {
      setErrorMsg(t('auth', 'enterEmail'));
      return;
    }
    setLoading(true);
    setMessage(null);
    setErrorMsg(null);
    try {
      await authApi.forgotPassword(email.trim());
      setMessage(t('auth', 'codeSent'));
      setStep(2);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('auth', 'failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!code.trim() || !newPassword.trim()) {
      setErrorMsg(t('auth', 'enterCodeAndPassword'));
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg(t('auth', 'passwordMinLength'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), newPassword);
      setStep(3);
      setTimeout(() => router.replace('/auth/login'), 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('auth', 'failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>🔑 {t('auth', 'resetPassword')}</Text>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {step === 1 && (
          <>
            <Text style={styles.label}>{t('auth', 'email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setErrorMsg(null); }}
              placeholder={t('auth', 'emailPlaceholder')}
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleStep1}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.accentText} />
              ) : (
                <Text style={styles.buttonText}>{t('auth', 'sendCode')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            {message && <Text style={styles.message}>{message}</Text>}

            <Text style={styles.label}>{t('auth', 'verificationCode')}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(v) => { setCode(v); setErrorMsg(null); }}
              placeholder={t('auth', 'enterCodePlaceholder')}
              placeholderTextColor="#666"
              autoComplete="one-time-code"
            />

            <Text style={styles.label}>{t('auth', 'newPasswordLabel')}</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setErrorMsg(null); }}
              placeholder={t('auth', 'enterNewPasswordPlaceholder')}
              placeholderTextColor="#666"
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleStep2}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.accentText} />
              ) : (
                <Text style={styles.buttonText}>{t('auth', 'resetPassword')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>{t('auth', 'resetSuccess')}</Text>
            <Text style={styles.successSub}>{t('auth', 'redirectingToLogin')}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.buttonText}>{t('auth', 'goToLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step !== 3 && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.linkText}>{t('auth', 'backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        )}
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
      padding: 16,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.7 : 1),
    },
    title: {
      color: theme.colors.accent,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 24,
    },
    label: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      padding: 12,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      fontSize: 16,
      marginBottom: 16,
    },
    button: {
      backgroundColor: theme.colors.accent,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: theme.colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    message: {
      color: theme.colors.success,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
      backgroundColor: `${theme.colors.danger}22`,
      padding: 10,
      borderRadius: theme.radius.sm,
    },
    successBox: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    successIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    successTitle: {
      color: theme.colors.success,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      textAlign: 'center',
    },
    successSub: {
      color: theme.colors.textMuted,
      fontSize: 14,
      marginBottom: 20,
      textAlign: 'center',
    },
    footer: {
      marginTop: 24,
      alignItems: 'center',
    },
    linkText: {
      color: theme.colors.accent,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
  });
