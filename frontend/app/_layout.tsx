import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useI18n } from '../i18n';
import { ThemeProvider, useTheme, getStatusBarStyle } from '../theme';
import { initSentry, wrapSentry } from '../utils/sentry';

initSentry();

function RootNavigator() {
  const { initLang } = useI18n();
  const { theme } = useTheme();

  useEffect(() => {
    void initLang();
  }, [initLang]);

  return (
    <>
      <StatusBar style={getStatusBarStyle(theme)} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="auth/forgot" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="purchase" />
      </Stack>
    </>
  );
}

function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

export default wrapSentry(RootLayout);

