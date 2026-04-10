import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  Keyboard,
} from 'react-native';
import { AirportSearchResult } from '../types';
import { airportApi } from '../services/api';
import { t } from '../i18n';
import { useTheme } from '../theme';

interface OriginDestProps {
  origin: string;
  setOrigin: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
}

interface AirportInputProps {
  label: string;
  placeholder: string;
  value: string;
  onSelect: (iataCode: string) => void;
  zIndex?: number;
}

const DEBOUNCE_MS = 350;

const AirportInput: React.FC<AirportInputProps> = ({
  label,
  placeholder,
  value,
  onSelect,
  zIndex = 1,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [inputText, setInputText] = useState(value);
  const [suggestions, setSuggestions] = useState<AirportSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composingRef = useRef(false);
  const latestTextRef = useRef(value);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isSelecting) {
      setInputText(value);
    }
  }, [value, isSelecting]);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const results = await airportApi.search(trimmed, 8, controller.signal);
      if (controller.signal.aborted) return;
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch {
      if (controller.signal.aborted) return;
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!composingRef.current) {
          fetchSuggestions(text);
        }
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions],
  );

  const handleChangeText = useCallback(
    (text: string) => {
      setIsSelecting(false);
      setInputText(text);
      latestTextRef.current = text;

      const upper = text.trim().toUpperCase();
      if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
        onSelect(upper);
      }

      if (!composingRef.current) {
        scheduleSearch(text);
      }
    },
    [scheduleSearch, onSelect],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (inputRef.current as any)?._node ?? (inputRef.current as any);
    if (!node?.addEventListener) return;

    const onStart = () => { composingRef.current = true; };
    const onEnd = () => {
      composingRef.current = false;
      scheduleSearch(latestTextRef.current);
    };
    node.addEventListener('compositionstart', onStart);
    node.addEventListener('compositionend', onEnd);
    return () => {
      node.removeEventListener('compositionstart', onStart);
      node.removeEventListener('compositionend', onEnd);
    };
  }, [scheduleSearch]);

  const handleSelect = useCallback(
    (airport: AirportSearchResult) => {
      setIsSelecting(true);
      const city = airport.municipality_zh || airport.municipality;
      const display = `${airport.iata_code} - ${city || airport.name}`;
      setInputText(display);
      onSelect(airport.iata_code);
      setSuggestions([]);
      setShowDropdown(false);
      if (Platform.OS !== 'web') {
        Keyboard.dismiss();
      }
    },
    [onSelect],
  );

  const handleFocus = useCallback(() => {
    if (inputText && inputText.includes(' - ')) {
      setInputText('');
    }
    if (suggestions.length > 0) {
      setShowDropdown(true);
    }
  }, [inputText, suggestions]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowDropdown(false);
      if (!inputText || inputText.trim() === '') {
        setInputText(value);
      }
    }, 200);
  }, [inputText, value]);

  const renderSuggestion = useCallback(
    ({ item }: { item: AirportSearchResult }) => {
      const typeLabel =
        item.airport_type === 'large_airport'
          ? '✈'
          : item.airport_type === 'medium_airport'
            ? '🛩'
            : '•';

      const displayName = item.name_zh || item.name;
      const displayCity = item.municipality_zh || item.municipality;

      return (
        <TouchableOpacity
          style={styles.suggestionItem}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <View style={styles.suggestionLeft}>
            <Text style={styles.iataCode}>{item.iata_code}</Text>
            <Text style={styles.typeIcon}>{typeLabel}</Text>
          </View>
          <View style={styles.suggestionRight}>
            <Text style={styles.airportName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.cityCountry} numberOfLines={1}>
              {[displayCity, item.iso_country].filter(Boolean).join(', ')}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelect],
  );

  return (
    <View style={[styles.halfInput, { zIndex }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={inputText}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.iata_code}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.dropdownList}
          />
        </View>
      )}
    </View>
  );
};

export const OriginDestInput: React.FC<OriginDestProps> = ({
  origin,
  setOrigin,
  destination,
  setDestination,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.row}>
      <AirportInput
        label={t('common', 'originLabel')}
        placeholder={t('common', 'originPlaceholder')}
        value={origin}
        onSelect={setOrigin}
        zIndex={3}
      />
      <AirportInput
        label={t('common', 'destinationLabel')}
        placeholder={t('common', 'destinationPlaceholder')}
        value={destination}
        onSelect={setDestination}
        zIndex={2}
      />
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
      zIndex: 10,
    },
    halfInput: {
      flex: 1,
      position: 'relative',
    },
    label: {
      color: theme.colors.accent,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      color: theme.colors.text,
      padding: 12,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
      fontSize: 14,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      borderRadius: theme.radius.sm,
      marginTop: 4,
      maxHeight: 240,
      ...(Platform.OS === 'web'
        ? { boxShadow: `0 8px 24px ${theme.colors.overlay}` }
        : {
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
          }),
    },
    dropdownList: {
      maxHeight: 236,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    suggestionLeft: {
      width: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iataCode: {
      color: theme.colors.accent,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    typeIcon: {
      fontSize: 10,
    },
    suggestionRight: {
      flex: 1,
      marginLeft: 8,
    },
    airportName: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    cityCountry: {
      color: theme.colors.textSoft,
      fontSize: 11,
      lineHeight: 14,
      marginTop: 1,
    },
  });
