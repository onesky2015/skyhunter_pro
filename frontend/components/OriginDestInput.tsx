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

const DEBOUNCE_MS = 250;

const AirportInput: React.FC<AirportInputProps> = ({
  label,
  placeholder,
  value,
  onSelect,
  zIndex = 1,
}) => {
  const [inputText, setInputText] = useState(value);
  const [suggestions, setSuggestions] = useState<AirportSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isSelecting) {
      setInputText(value);
    }
  }, [value, isSelecting]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const results = await airportApi.search(query, 8);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      setIsSelecting(false);
      setInputText(text);

      const upper = text.toUpperCase();
      if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
        onSelect(upper);
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
    },
    [fetchSuggestions, onSelect],
  );

  const handleSelect = useCallback(
    (airport: AirportSearchResult) => {
      setIsSelecting(true);
      const display = `${airport.iata_code} - ${airport.municipality || airport.name}`;
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
              {item.name}
            </Text>
            <Text style={styles.cityCountry} numberOfLines={1}>
              {[item.municipality, item.iso_country].filter(Boolean).join(', ')}
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
        autoCapitalize="characters"
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

const styles = StyleSheet.create({
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
    color: '#00FF00',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#222222',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 14,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#00FF00',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 240,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 24px rgba(0, 255, 0, 0.15)' }
      : {
          shadowColor: '#00FF00',
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
    borderBottomColor: '#2A2A2A',
  },
  suggestionLeft: {
    width: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iataCode: {
    color: '#00FF00',
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
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 16,
  },
  cityCountry: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
});
