// filename: app/auth/verify-email.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const { verifyEmail, resendVerification } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = params.email || '';

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert(t('common', 'error'), t('auth', 'enterVerificationCode'));
      return;
    }
    setLoading(true);
    const success = await verifyEmail(email, code.trim());
    setLoading(false);
    if (success) {
      router.replace('/(tabs)/search');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const success = await resendVerification(email);
    if (success) {
      Alert.alert(t('auth', 'codeSentTitle'), t('auth', 'codeSentMessage'));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      timerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c)
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>✉️ {t('auth', 'verifyEmail')}</Text>

        <Text style={styles.subtitle}>
          {t('auth', 'verificationSentTo')}
        </Text>
        <Text style={styles.email}>{maskedEmail}</Text>

        <Text style={styles.label}>{t('auth', 'verificationCode')}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t('auth', 'codePlaceholder')}
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>{t('auth', 'verify')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resendCooldown > 0}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
            {resendCooldown > 0
              ? t('auth', 'resendCodeCountdown').replace('{s}', String(resendCooldown))
              : t('auth', 'resendCode')}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.linkText}>{t('auth', 'backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  title: {
    color: '#00FF00',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    color: '#00FF00',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  label: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#00FF00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: '#00FF00',
    fontSize: 14,
  },
  resendDisabled: {
    color: '#555555',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#00FF00',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
