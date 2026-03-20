// filename: app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useI18n } from '../i18n';

export default function RootLayout() {
  const { initLang } = useI18n();
  useEffect(() => {
    initLang();
  }, [initLang]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="auth/forgot" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="purchase" />
      </Stack>
    </>
  );
}

