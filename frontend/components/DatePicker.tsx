// filename: components/DatePicker.tsx
import React, { useState, useRef, useEffect, useId } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform } from 'react-native';

// 条件导入 DateTimePicker（Web 平台不支持）
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (e) {
    console.warn('DateTimePicker not available:', e);
  }
}

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  style?: any;
  /** Web 端：最小可选日期 YYYY-MM-DD，默认今天 */
  minDate?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'YYYY-MM-DD',
  style,
  minDate,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const webContainerRef = useRef<HTMLElement | View | null>(null);
  const webContainerId = useId().replace(/:/g, '-');

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      onChange(dateStr);
      if (Platform.OS === 'ios') {
        setShowPicker(false);
      }
    }
  };

  if (Platform.OS === 'web') {
    // Web 端：通过 ref 注入真实 DOM 的 input[type=date]，绕过 RN Web 的组件限制
    const minDateStr = minDate || new Date().toISOString().split('T')[0];

    useEffect(() => {
      if (typeof document === 'undefined') return;
      let input: HTMLInputElement | null = null;
      let container: HTMLElement | null = null;

      const setup = () => {
        const raw = webContainerRef.current;
        container =
          raw instanceof HTMLElement ? raw : null;
        if (!container) {
          container = document.querySelector(
            `[data-datepicker-id="${webContainerId}"]`
          ) as HTMLElement | null;
        }
        if (!container) return;

        input = document.createElement('input');
        input.type = 'date';
        input.value = value || '';
        input.min = minDateStr;
        input.style.cssText = [
          'width:100%;min-height:44px;padding:12px;',
          'background:#222;color:#fff;border-radius:8px;border:1px solid #333;',
          'font-size:16px;font-weight:600;cursor:pointer;box-sizing:border-box;',
          'color-scheme:dark;',
        ].join('');

        const handleChange = (e: Event) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) onChange(v);
        };
        input.addEventListener('change', handleChange);
        container.appendChild(input);
      };

      const id = setTimeout(setup, 0);
      return () => {
        clearTimeout(id);
        if (input && container?.contains(input)) {
          container.removeChild(input);
        }
      };
    }, [minDateStr, onChange, webContainerId]);

    useEffect(() => {
      let container: HTMLElement | null =
        webContainerRef.current instanceof HTMLElement
          ? webContainerRef.current
          : null;
      if (!container && typeof document !== 'undefined') {
        container = document.querySelector(
          `[data-datepicker-id="${webContainerId}"]`
        ) as HTMLElement | null;
      }
      if (!container) return;
      const input = container.querySelector('input[type="date"]');
      if (input instanceof HTMLInputElement && input.value !== (value || '')) {
        input.value = value || '';
      }
    }, [value, webContainerId]);

    return (
      <View style={style}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View
          ref={(r) => {
            webContainerRef.current = r as HTMLElement | View | null;
          }}
          {...({ 'data-datepicker-id': webContainerId } as any)}
          style={[styles.webDateContainer, { width: '100%' }]}
          collapsable={false}
        />
      </View>
    );
  }

  if (!DateTimePicker) {
    return (
      <View style={style}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value || placeholder}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={value ? new Date(value) : new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>
    );
  }

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
      {Platform.OS === 'ios' && showPicker && (
        <View style={styles.iosButtons}>
          <TouchableOpacity
            style={styles.iosButton}
            onPress={() => setShowPicker(false)}
          >
            <Text style={styles.iosButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    color: '#00FF00',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  inputText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    color: '#666666',
  },
  iosButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: '#111111',
  },
  iosButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iosButtonText: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: '600',
  },
  webInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  webDateButton: {
    padding: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  webDateButtonText: {
    color: '#00FF00',
    fontSize: 18,
  },
});

