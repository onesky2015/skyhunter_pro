// filename: components/GoogleSignInButton.tsx
import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { useRouter } from 'expo-router';
import { getGoogleOAuthClientIds } from '../constants/googleOAuth';
import { useTheme } from '../theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * 已配置 Client ID 时：走 Google OIDC，取 id_token 调后端 /auth/oauth/google。
 */
export function GoogleSignInConfiguredButton({
  loading,
  setLoading,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { oauthLogin } = useAuth();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const ids = getGoogleOAuthClientIds();
  const handledRef = useRef<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: ids.webClientId,
    iosClientId: ids.iosClientId,
    androidClientId: ids.androidClientId,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type !== 'success') {
      if (response.type === 'error') {
        Alert.alert(t('auth', 'signInGoogle'), t('auth', 'failed'));
      }
      return;
    }
    const idToken = (response as { params?: { id_token?: string } }).params?.id_token;
    const sig = idToken ? idToken.slice(0, 24) : '';
    if (!idToken || handledRef.current === sig) return;
    handledRef.current = sig;

    (async () => {
      setLoading(true);
      try {
        const ok = await oauthLogin('google', idToken);
        if (ok) router.replace('/(tabs)/search');
        else Alert.alert(t('auth', 'signInGoogle'), t('auth', 'failed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [response, oauthLogin, router, setLoading, t]);

  const onPress = async () => {
    try {
      await promptAsync();
    } catch (e: unknown) {
      Alert.alert(t('auth', 'signInGoogle'), e instanceof Error ? e.message : t('auth', 'failed'));
    }
  };

  return (
    <TouchableOpacity
      style={[styles.oauthButton, styles.googleButton, loading && styles.disabled]}
      onPress={onPress}
      disabled={loading || !request}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <>
          <Text style={styles.oauthIcon}>G</Text>
          <Text style={styles.oauthButtonText}>{t('auth', 'signInGoogle')}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** 未配置 Client ID：提示用户在 app.json 或环境变量中填写 */
export function GoogleSignInStubButton({ loading }: { loading: boolean }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <TouchableOpacity
      style={[styles.oauthButton, styles.googleButton, loading && styles.disabled]}
      onPress={() => {
        Alert.alert(t('auth', 'signInGoogle'), t('auth', 'googleSignInConfig'));
      }}
      disabled={loading}
    >
      <Text style={styles.oauthIcon}>G</Text>
      <Text style={styles.oauthButtonText}>{t('auth', 'signInGoogle')}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    oauthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      padding: 14,
      borderRadius: theme.radius.sm,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    googleButton: {
      backgroundColor: theme.colors.surfaceAlt,
    },
    disabled: {
      opacity: 0.5,
    },
    oauthIcon: {
      fontSize: 18,
      fontWeight: '700',
      marginRight: 10,
      color: theme.colors.text,
    },
    oauthButtonText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
  });
