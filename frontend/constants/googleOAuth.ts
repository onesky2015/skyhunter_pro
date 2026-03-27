// filename: constants/googleOAuth.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** 从 app.json extra 或 EXPO_PUBLIC_* 读取 Google OAuth Client ID */
export function getGoogleOAuthClientIds(): {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
} {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return {
    webClientId: extra.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: extra.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: extra.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  };
}

/** 当前平台是否已配置可用的 Google Client ID */
export function isGoogleOAuthConfigured(): boolean {
  const ids = getGoogleOAuthClientIds();
  if (Platform.OS === 'web') return Boolean(ids.webClientId);
  if (Platform.OS === 'ios') return Boolean(ids.iosClientId);
  return Boolean(ids.androidClientId);
}
