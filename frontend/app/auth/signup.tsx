// filename: app/auth/signup.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { OAuthButtons } from '../../components/OAuthButtons';
import { useTheme, getShadowStyle } from '../../theme';

export default function SignupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { signup } = useAuth();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common', 'error'), t('auth', 'errorEnterEmailPassword'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('common', 'error'), t('auth', 'passwordMin6'));
      return;
    }
    setLoading(true);
    const result = await signup(email.trim(), password, fullName.trim() || undefined);
    setLoading(false);
    if (result.success && result.requiresVerification) {
      router.replace(`/auth/verify-email?email=${encodeURIComponent(result.email || email.trim())}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>📝 {t('auth', 'signup')}</Text>

        <Text style={styles.label}>{t('auth', 'fullName')}</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('auth', 'fullNamePlaceholder')}
          placeholderTextColor="#666"
        />

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
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text style={styles.buttonText}>{t('auth', 'signup')}</Text>
          )}
        </TouchableOpacity>

        <OAuthButtons loading={loading} setLoading={setLoading} />

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.linkText}>{t('auth', 'hasAccount')}</Text>
          </TouchableOpacity>
        </View>
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
