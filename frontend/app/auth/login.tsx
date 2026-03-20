// filename: app/auth/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { login, oauthLogin, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/search');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (totpOverride?: string) => {
    const loginEmail = pendingEmail || email.trim();
    const loginPassword = pendingPassword || password;
    if (!loginEmail || !loginPassword) {
      Alert.alert(t('common', 'error'), t('auth', 'errorEnterEmailPassword'));
      return;
    }
    setLoading(true);
    const result = await login(loginEmail, loginPassword, totpOverride);
    setLoading(false);
    if (result.success) {
      setShowTotpModal(false);
      setTotpCode('');
      setPendingEmail('');
      setPendingPassword('');
      router.replace('/(tabs)/search');
    } else if (result.requiresVerification) {
      router.replace(`/auth/verify-email?email=${encodeURIComponent(result.email || loginEmail)}`);
    } else if (result.requiresTotp) {
      setPendingEmail(result.email || loginEmail);
      setPendingPassword(result.password || loginPassword);
      setShowTotpModal(true);
    }
  };

  const handleTotpSubmit = () => {
    if (totpCode.length !== 6) return;
    handleLogin(totpCode);
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const AppleAuth = await import('expo-apple-authentication');
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(' ') || undefined;
        setLoading(true);
        const success = await oauthLogin('apple', credential.identityToken, fullName);
        setLoading(false);
        if (success) router.replace('/(tabs)/search');
      }
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('auth', 'signInApple'), err?.message || t('auth', 'failed'));
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const AuthSession = await import('expo-auth-session/providers/google');
      Alert.alert(t('auth', 'signInGoogle'), t('auth', 'googleSignInConfig'));
    } catch (err: any) {
      Alert.alert(t('auth', 'signInGoogle'), err?.message || t('auth', 'failed'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('auth', 'login')}</Text>

        <Text style={styles.label}>{t('auth', 'email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth', 'emailPlaceholder')}
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('auth', 'password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth', 'passwordPlaceholder')}
          placeholderTextColor="#666"
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleLogin()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>{t('auth', 'login')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('common', 'or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.oauthButton}
            onPress={handleAppleSignIn}
            disabled={loading}
          >
            <Text style={styles.oauthIcon}>{'\uF8FF'}</Text>
            <Text style={styles.oauthButtonText}>{t('auth', 'signInApple')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.oauthButton, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Text style={styles.oauthIcon}>G</Text>
          <Text style={styles.oauthButtonText}>{t('auth', 'signInGoogle')}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/auth/signup')}>
            <Text style={styles.linkText}>{t('auth', 'noAccount')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/auth/forgot')}>
            <Text style={styles.linkText}>{t('auth', 'forgotPassword')}</Text>
          </TouchableOpacity>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => router.push('/legal?tab=privacy')}>
              <Text style={styles.legalLink}>{t('auth', 'privacyPolicy')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}>|</Text>
            <TouchableOpacity onPress={() => router.push('/legal?tab=terms')}>
              <Text style={styles.legalLink}>{t('auth', 'termsOfService')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showTotpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTotpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('auth', 'totpTitle')}</Text>
            <Text style={styles.modalDesc}>
              {t('auth', 'totpDesc')}
            </Text>
            <TextInput
              style={styles.totpInput}
              value={totpCode}
              onChangeText={setTotpCode}
              placeholder={t('auth', 'totpPlaceholder')}
              placeholderTextColor="#555"
              maxLength={6}
              keyboardType="number-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, (loading || totpCode.length !== 6) && styles.buttonDisabled]}
              onPress={handleTotpSubmit}
              disabled={loading || totpCode.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>{t('auth', 'verify')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setShowTotpModal(false);
                setTotpCode('');
                setPendingEmail('');
                setPendingPassword('');
              }}
            >
              <Text style={styles.cancelText}>{t('common', 'cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    color: '#00FF00',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  modalTitle: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDesc: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  totpInput: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00FF00',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    color: '#999',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
  },
  oauthIcon: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 10,
    color: '#000000',
  },
  oauthButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  legalLink: {
    color: '#666',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: '#444',
    fontSize: 12,
    marginHorizontal: 8,
  },
});
