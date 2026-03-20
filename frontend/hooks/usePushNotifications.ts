// filename: hooks/usePushNotifications.ts
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { userApi } from '../services/api';

export function usePushNotifications(userToken: string | null, on401?: () => void) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userToken || registered.current || Platform.OS === 'web') return;

    const registerForPush = async () => {
      try {
        const Notifications = await import('expo-notifications');
        const Device = await import('expo-device');

        if (!Device.isDevice) return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        const pushToken = tokenResponse.data;
        const platform = Platform.OS;

        await userApi.registerPushToken(userToken, pushToken, platform, on401);
        registered.current = true;

        if (Platform.OS === 'android') {
          Notifications.setNotificationChannelAsync('default', {
            name: 'SkyHunter Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }
      } catch (err) {
        console.warn('Push notification registration failed:', err);
      }
    };

    registerForPush();
  }, [userToken, on401]);
}
