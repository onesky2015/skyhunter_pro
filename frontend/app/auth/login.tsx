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
import { OAuthButtons } from '../../components/OAuthButtons';
import { useTheme, getShadowStyle } from '../../theme';

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>{t('auth', 'login')}</Text>
          )}
        </TouchableOpacity>

        <OAuthButtons loading={loading} setLoading={setLoading} />

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
                <ActivityIndicator color={theme.colors.accentText} />
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
    footer: {
      marginTop: 24,
      alignItems: 'center',
      gap: 12,
    },
    linkText: {
      color: theme.colors.accent,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, 1),
    },
    modalTitle: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
    },
    modalDesc: {
      color: theme.colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 20,
    },
    totpInput: {
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      padding: 16,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
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
      color: theme.colors.textMuted,
      fontSize: 14,
    },
    legalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    legalLink: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textDecorationLine: 'underline',
    },
    legalSep: {
      color: theme.colors.textSoft,
      fontSize: 12,
      marginHorizontal: 8,
    },
  });
