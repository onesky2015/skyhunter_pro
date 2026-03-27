// filename: components/OAuthButtons.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { isGoogleOAuthConfigured } from '../constants/googleOAuth';
import { GoogleSignInConfiguredButton, GoogleSignInStubButton } from './GoogleSignInButton';
import { useTheme } from '../theme';

/**
 * 登录 / 注册页共用的第三方 OAuth 区块。
 * 包含「或」分隔线、Apple（仅 iOS）和 Google 按钮。
 * 后端 _oauth_login_or_create 会自动判断：有账号则登录，无账号则注册。
 */
export function OAuthButtons({
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
        const fullName =
          [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean)
            .join(' ') || undefined;
        setLoading(true);
        try {
          const ok = await oauthLogin('apple', credential.identityToken, fullName);
          if (ok) router.replace('/(tabs)/search');
        } finally {
          setLoading(false);
        }
      }
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('auth', 'signInApple'), err?.message || t('auth', 'failed'));
      }
    }
  };

  return (
    <View>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('common', 'or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.oauthButton, loading && styles.disabled]}
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          <Text style={styles.oauthIcon}>{'\uF8FF'}</Text>
          <Text style={styles.oauthButtonText}>{t('auth', 'signInApple')}</Text>
        </TouchableOpacity>
      )}

      {isGoogleOAuthConfigured() ? (
        <GoogleSignInConfiguredButton loading={loading} setLoading={setLoading} />
      ) : (
        <GoogleSignInStubButton loading={loading} />
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
      marginHorizontal: 12,
    },
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
