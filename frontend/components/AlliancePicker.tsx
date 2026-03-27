// filename: components/AlliancePicker.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { AIRLINE_OPTIONS, AirlineOption } from '../constants/utils';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

interface AlliancePickerProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  isNested?: boolean;
}

// 仅联盟选项
const ALLIANCE_OPTIONS = AIRLINE_OPTIONS.filter((option) => option.type === 'alliance');

export const AlliancePicker: React.FC<AlliancePickerProps> = ({
  visible,
  onClose,
  value,
  onChange,
  isNested = false,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = ALLIANCE_OPTIONS.filter((option) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      option.label.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query)
    );
  });

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setSearchQuery('');
    onClose();
  };

  const content = (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('monitors', 'selectAllianceTitle')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <TextInput
          style={styles.searchInput}
          placeholder={t('monitors', 'searchAlliance')}
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />

        {/* Options List */}
        <ScrollView style={styles.list}>
          {filteredOptions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('monitors', 'noMatchesFound')}</Text>
            </View>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <TouchableOpacity
                  key={option.value || 'any'}
                  style={[
                    styles.optionItem,
                    isSelected && styles.optionItemSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Current Selection */}
        {value && (
          <View style={styles.currentSelection}>
            <Text style={styles.currentLabel}>Selected:</Text>
            <Text style={styles.currentValue}>
              {ALLIANCE_OPTIONS.find((o) => o.value === value)?.label || value}
            </Text>
          </View>
        )}

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
          <Text style={styles.closeButtonText}>{t('common', 'close') || 'CLOSE'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  if (!visible) return null;

  if (isNested) {
    return (
      <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 100 }]} pointerEvents="box-none">
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: 20,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, 1),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
    },
    closeButton: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '700',
    },
    searchInput: {
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      padding: 12,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      fontSize: 16,
      marginBottom: 16,
    },
    list: {
      maxHeight: 400,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 14,
    },
    optionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.surfaceMuted,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionItemSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    optionText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    optionTextSelected: {
      color: theme.colors.accentText,
      fontWeight: '700',
    },
    checkmark: {
      color: theme.colors.accentText,
      fontSize: 18,
      fontWeight: '700',
    },
    currentSelection: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      borderRadius: theme.radius.sm,
      marginTop: 16,
      marginBottom: 12,
    },
    currentLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginRight: 8,
    },
    currentValue: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    closeButtonBottom: {
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    closeButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });

