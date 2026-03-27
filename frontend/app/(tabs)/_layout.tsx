// filename: app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Image, Text } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';

const eagleLogo = require('../../assets/eagle-logo.png');

export default function TabsLayout() {
  const { t } = useI18n();
  const { userToken, handle401Error } = useAuth();
  const { theme } = useTheme();
  usePushNotifications(userToken, handle401Error);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBg,
          borderTopColor: theme.colors.tabBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.tabInactive,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard', 'tabTitle'),
          tabBarIcon: () => <Image source={eagleLogo} style={{ width: 20, height: 20, borderRadius: 5 }} resizeMode="contain" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('search', 'tabTitle'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="monitors"
        options={{
          title: t('monitors', 'tabTitle'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile', 'tabTitle'),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

