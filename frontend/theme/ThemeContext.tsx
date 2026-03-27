import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';
import { type AppTheme, type ThemeName, themes } from './themes';

const THEME_STORAGE_KEY = 'skyhunter_theme';

interface ThemeContextValue {
  themeName: ThemeName;
  theme: AppTheme;
  updateTheme: (name: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('tactical');

  useEffect(() => {
    const initTheme = async () => {
      const saved = await storage.getItem(THEME_STORAGE_KEY);
      if (saved === 'tactical' || saved === 'light' || saved === 'glass') {
        setThemeName(saved);
      }
    };

    void initTheme();
  }, []);

  const updateTheme = useCallback(async (name: ThemeName) => {
    setThemeName(name);
    await storage.setItem(THEME_STORAGE_KEY, name);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeName,
      theme: themes[themeName],
      updateTheme,
    }),
    [themeName, updateTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
