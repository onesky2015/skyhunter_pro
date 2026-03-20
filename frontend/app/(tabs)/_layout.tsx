// filename: app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useI18n } from '../../i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  const { userToken, handle401Error } = useAuth();
  usePushNotifications(userToken, handle401Error);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#00FF00',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#00FF00',
        tabBarInactiveTintColor: '#666666',
      }}
    >
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

