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

export default function ForgotScreen() {
  const { t } = useI18n();
  const router = useRouter();
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
                <ActivityIndicator color="#000" />
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
                <ActivityIndicator color="#000" />
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
    marginBottom: 24,
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
    fontSize: 16,
    marginBottom: 16,
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
  message: {
    color: '#00FF00',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,68,68,0.1)',
    padding: 10,
    borderRadius: 8,
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
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSub: {
    color: '#a1a1aa',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
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
