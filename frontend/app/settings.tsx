import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../i18n';
import { ThemeName, themes, useTheme, getShadowStyle } from '../theme';

const themeOrder: ThemeName[] = ['tactical', 'light', 'glass'];

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { theme, themeName, updateTheme } = useTheme();

  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.75}>
        <Text style={styles.backButtonText}>← {t('common', 'back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('settings', 'title')}</Text>
      <Text style={styles.subtitle}>{t('settings', 'subtitle')}</Text>

      <View style={styles.currentThemeCard}>
        <Text style={styles.cardLabel}>{t('settings', 'currentTheme')}</Text>
        <Text style={styles.currentThemeName}>{t('settings', themeName)}</Text>
      </View>

      {themeOrder.map((option) => {
        const optionTheme = themes[option];
        const selected = option === themeName;

        return (
          <View
            key={option}
            style={[
              styles.optionCard,
              selected && styles.optionCardSelected,
              option === 'glass' && styles.optionCardGlassPreview,
            ]}
          >
            <View style={styles.optionHeader}>
              <View>
                <Text style={styles.optionTitle}>{t('settings', option)}</Text>
                <Text style={styles.optionDesc}>{t('settings', `${option}Desc`)}</Text>
              </View>
              <View
                style={[
                  styles.previewDot,
                  {
                    backgroundColor: optionTheme.colors.accent,
                    borderColor: optionTheme.colors.borderStrong,
                  },
                ]}
              />
            </View>

            <View style={styles.previewRow}>
              <View
                style={[
                  styles.previewSurface,
                  {
                    backgroundColor: optionTheme.colors.surface,
                    borderColor: optionTheme.colors.borderStrong,
                    borderRadius: optionTheme.radius.md,
                  },
                ]}
              />
              <View
                style={[
                  styles.previewButton,
                  {
                    backgroundColor: optionTheme.colors.accent,
                    borderRadius: optionTheme.radius.sm,
                  },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[styles.applyButton, selected && styles.applyButtonSelected]}
              onPress={() => void updateTheme(option)}
              activeOpacity={0.8}
            >
              <Text style={[styles.applyButtonText, selected && styles.applyButtonTextSelected]}>
                {selected ? t('settings', 'applied') : t('settings', 'applyTheme')}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (theme: (typeof themes)[ThemeName]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    backButton: {
      alignSelf: 'flex-start',
      marginBottom: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backButtonText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    title: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 8,
    },
    subtitle: {
      color: theme.colors.textSoft,
      fontSize: 14,
      marginBottom: 20,
    },
    currentThemeCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 16,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.8 : 1),
    },
    cardLabel: {
      color: theme.colors.textSoft,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    currentThemeName: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
    },
    optionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 16,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.8 : 1),
    },
    optionCardSelected: {
      borderColor: theme.colors.borderStrong,
    },
    optionCardGlassPreview: {
      overflow: 'hidden',
    },
    optionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
    },
    optionTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 4,
    },
    optionDesc: {
      color: theme.colors.textSoft,
      fontSize: 13,
      lineHeight: 18,
      maxWidth: '90%',
    },
    previewDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    previewSurface: {
      flex: 1,
      height: 54,
      borderWidth: 1,
      opacity: 0.95,
    },
    previewButton: {
      width: 72,
      height: 18,
      opacity: 0.95,
    },
    applyButton: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    applyButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    applyButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    applyButtonTextSelected: {
      color: theme.colors.accentText,
    },
  });
