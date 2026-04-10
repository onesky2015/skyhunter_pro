import React, { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react';
import { Alert } from 'react-native';
import { storage } from '../services/storage';
import { TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../constants/api';
import { UserInfo } from '../types';
import { authApi, userApi, handle401 } from '../services/api';

export interface SignupReturn {
  success: boolean;
  requiresVerification?: boolean;
  email?: string;
}

export interface LoginReturn {
  success: boolean;
  requiresVerification?: boolean;
  requiresTotp?: boolean;
  email?: string;
}

interface AuthContextValue {
  userToken: string | null;
  userInfo: UserInfo | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<LoginReturn>;
  signup: (email: string, password: string, fullName?: string) => Promise<SignupReturn>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  resendVerification: (email: string) => Promise<boolean>;
  oauthLogin: (provider: 'apple' | 'google', idToken: string, fullName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUserInfo: () => Promise<void>;
  handle401Error: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const [token, userStr] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
        ]);
        if (token && userStr) {
          setUserToken(token);
          setUserInfo(JSON.parse(userStr));
        }
      } catch (err) {
        console.error('加载存储的认证信息失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  const handle401Error = useCallback(async () => {
    setUserToken(null);
    setUserInfo(null);
    await handle401();
  }, []);

  const login = useCallback(async (email: string, password: string, totpCode?: string): Promise<LoginReturn> => {
    try {
      const data = await authApi.login(email, password, totpCode);
      setUserToken(data.access_token);
      setUserInfo(data.user);
      await storage.setItem(TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        await storage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }
      await storage.setItem(USER_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      if (err instanceof Error && (err as any).requiresVerification) {
        return { success: false, requiresVerification: true, email: (err as any).email };
      }
      if (err instanceof Error && (err as any).requiresTotp) {
        return { success: false, requiresTotp: true, email: (err as any).email };
      }
      Alert.alert('Login Failed', err instanceof Error ? err.message : 'Unknown error');
      return { success: false };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, fullName?: string): Promise<SignupReturn> => {
    try {
      const data = await authApi.signup(email, password, fullName);
      if (data.requiresVerification) {
        return { success: true, requiresVerification: true, email: data.email };
      }
      return { success: true };
    } catch (err: unknown) {
      Alert.alert('Signup Failed', err instanceof Error ? err.message : 'Unknown error');
      return { success: false };
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string): Promise<boolean> => {
    try {
      const data = await authApi.verifyEmail(email, code);
      setUserToken(data.access_token);
      setUserInfo(data.user);
      await storage.setItem(TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        await storage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }
      await storage.setItem(USER_KEY, JSON.stringify(data.user));
      return true;
    } catch (err: unknown) {
      Alert.alert('Verification Failed', err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const resendVerification = useCallback(async (email: string): Promise<boolean> => {
    try {
      await authApi.resendVerification(email);
      return true;
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to resend code');
      return false;
    }
  }, []);

  const oauthLogin = useCallback(async (provider: 'apple' | 'google', idToken: string, fullName?: string): Promise<boolean> => {
    try {
      const data = provider === 'apple'
        ? await authApi.oauthApple(idToken, fullName)
        : await authApi.oauthGoogle(idToken);
      setUserToken(data.access_token);
      setUserInfo(data.user);
      await storage.setItem(TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        await storage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }
      await storage.setItem(USER_KEY, JSON.stringify(data.user));
      return true;
    } catch (err: unknown) {
      Alert.alert('OAuth Login Failed', err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.serverLogout();
    setUserToken(null);
    setUserInfo(null);
    await handle401();
  }, []);

  const refreshUserInfo = useCallback(async () => {
    if (!userToken) return;
    try {
      const info = await userApi.getMe(userToken, handle401Error);
      setUserInfo(info);
      await storage.setItem(USER_KEY, JSON.stringify(info));
    } catch (err) {
      console.error('刷新用户信息失败:', err);
    }
  }, [userToken, handle401Error]);

  const value = useMemo<AuthContextValue>(() => ({
    userToken,
    userInfo,
    loading,
    isAuthenticated: !!userToken && !!userInfo,
    login,
    signup,
    verifyEmail,
    resendVerification,
    oauthLogin,
    logout,
    refreshUserInfo,
    handle401Error,
  }), [
    userToken, userInfo, loading,
    login, signup, verifyEmail, resendVerification,
    oauthLogin, logout, refreshUserInfo, handle401Error,
  ]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
