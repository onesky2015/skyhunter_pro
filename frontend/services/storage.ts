// filename: services/storage.ts
import { Platform } from 'react-native';

const SENSITIVE_KEYS = ['skyhunter_token', 'skyhunter_refresh_token'];

async function _getSecureStore() {
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    if (SENSITIVE_KEYS.includes(key)) {
      const SecureStore = await _getSecureStore();
      if (SecureStore) {
        try { return await SecureStore.getItemAsync(key); } catch { /* fallback below */ }
      }
    }
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    if (SENSITIVE_KEYS.includes(key)) {
      const SecureStore = await _getSecureStore();
      if (SecureStore) {
        try { await SecureStore.setItemAsync(key, value); return; } catch { /* fallback below */ }
      }
    }
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    if (SENSITIVE_KEYS.includes(key)) {
      const SecureStore = await _getSecureStore();
      if (SecureStore) {
        try { await SecureStore.deleteItemAsync(key); } catch {}
      }
    }
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

