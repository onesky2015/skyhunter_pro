// filename: components/AirlinePicker.tsx
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

interface AirlinePickerProps {
  visible: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
}

// 仅航司选项（排除联盟）
const AIRLINE_OPTIONS_ONLY = AIRLINE_OPTIONS.filter((option) => option.type === 'airline');

export const AirlinePicker: React.FC<AirlinePickerProps> = ({
  visible,
  onClose,
  value,
  onChange,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = AIRLINE_OPTIONS_ONLY.filter((option) => {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('monitors', 'selectAirlineTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <TextInput
            style={styles.searchInput}
            placeholder={t('monitors', 'searchAirline')}
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
                {AIRLINE_OPTIONS_ONLY.find((o) => o.value === value)?.label || value}
              </Text>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
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
    color: '#666666',
    fontSize: 14,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#222222',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  optionItemSelected: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  checkmark: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  currentSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  currentLabel: {
    color: '#999999',
    fontSize: 12,
    marginRight: 8,
  },
  currentValue: {
    color: '#00FF00',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButtonBottom: {
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

