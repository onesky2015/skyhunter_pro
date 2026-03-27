import { type ViewStyle } from 'react-native';

export type ThemeName = 'tactical' | 'light' | 'glass';

export interface AppTheme {
  name: ThemeName;
  isDark: boolean;
  colors: {
    background: string;
    backgroundAlt: string;
    surface: string;
    surfaceAlt: string;
    surfaceMuted: string;
    inputBg: string;
    inputBorder: string;
    border: string;
    borderStrong: string;
    text: string;
    textMuted: string;
    textSoft: string;
    accent: string;
    accentText: string;
    tabBg: string;
    tabBorder: string;
    tabInactive: string;
    overlay: string;
    danger: string;
    warning: string;
    success: string;
    shadow: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  effects: {
    blurTint: 'light' | 'dark' | 'default';
    blurIntensity: number;
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

export const themes: Record<ThemeName, AppTheme> = {
  tactical: {
    name: 'tactical',
    isDark: true,
    colors: {
      background: '#000000',
      backgroundAlt: '#050505',
      surface: '#111111',
      surfaceAlt: '#1A1A1A',
      surfaceMuted: '#222222',
      inputBg: '#222222',
      inputBorder: '#333333',
      border: '#333333',
      borderStrong: '#00FF00',
      text: '#FFFFFF',
      textMuted: '#A3A3A3',
      textSoft: '#666666',
      accent: '#00FF00',
      accentText: '#000000',
      tabBg: '#000000',
      tabBorder: '#00FF00',
      tabInactive: '#666666',
      overlay: 'rgba(0, 0, 0, 0.72)',
      danger: '#FF4444',
      warning: '#EAB308',
      success: '#00FF00',
      shadow: '#00FF00',
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
    },
    effects: {
      blurTint: 'dark',
      blurIntensity: 18,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  light: {
    name: 'light',
    isDark: false,
    colors: {
      background: '#F5F7FA',
      backgroundAlt: '#EEF2F7',
      surface: '#FFFFFF',
      surfaceAlt: '#F8FAFC',
      surfaceMuted: '#E2E8F0',
      inputBg: '#FFFFFF',
      inputBorder: '#D6DEE8',
      border: '#D6DEE8',
      borderStrong: '#3B82F6',
      text: '#0F172A',
      textMuted: '#475569',
      textSoft: '#94A3B8',
      accent: '#3B82F6',
      accentText: '#FFFFFF',
      tabBg: '#FFFFFF',
      tabBorder: '#D6DEE8',
      tabInactive: '#94A3B8',
      overlay: 'rgba(15, 23, 42, 0.28)',
      danger: '#DC2626',
      warning: '#F59E0B',
      success: '#16A34A',
      shadow: '#0F172A',
    },
    radius: {
      sm: 10,
      md: 14,
      lg: 18,
      xl: 24,
    },
    effects: {
      blurTint: 'light',
      blurIntensity: 22,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
  },
  glass: {
    name: 'glass',
    isDark: true,
    colors: {
      background: '#1B1743',
      backgroundAlt: '#131034',
      surface: 'rgba(255, 255, 255, 0.12)',
      surfaceAlt: 'rgba(255, 255, 255, 0.18)',
      surfaceMuted: 'rgba(255, 255, 255, 0.10)',
      inputBg: 'rgba(255, 255, 255, 0.10)',
      inputBorder: 'rgba(255, 255, 255, 0.18)',
      border: 'rgba(255, 255, 255, 0.14)',
      borderStrong: 'rgba(255, 255, 255, 0.26)',
      text: '#FFFFFF',
      textMuted: 'rgba(255, 255, 255, 0.86)',
      textSoft: 'rgba(255, 255, 255, 0.62)',
      accent: '#A78BFA',
      accentText: '#FFFFFF',
      tabBg: 'rgba(17, 24, 39, 0.88)',
      tabBorder: 'rgba(255, 255, 255, 0.16)',
      tabInactive: 'rgba(255, 255, 255, 0.56)',
      overlay: 'rgba(8, 10, 24, 0.42)',
      danger: '#FB7185',
      warning: '#FBBF24',
      success: '#34D399',
      shadow: '#8B5CF6',
    },
    radius: {
      sm: 14,
      md: 18,
      lg: 24,
      xl: 32,
    },
    effects: {
      blurTint: 'dark',
      blurIntensity: 50,
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 6,
    },
  },
};

export function getShadowStyle(theme: AppTheme, opacityMultiplier = 1): ViewStyle {
  return {
    shadowColor: theme.colors.shadow,
    shadowOpacity: theme.effects.shadowOpacity * opacityMultiplier,
    shadowRadius: theme.effects.shadowRadius,
    shadowOffset: { width: 0, height: 6 },
    elevation: theme.effects.elevation,
  };
}

export function getStatusBarStyle(theme: AppTheme): 'light' | 'dark' {
  return theme.isDark ? 'light' : 'dark';
}
