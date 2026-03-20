// filename: hooks/useSearch.ts
import { useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { SearchResponse, SearchRequestOptions, SearchRequestPayload } from '../types';
import { searchApi } from '../services/api';
import { calculateSearchCost } from '../constants/utils';

export const useSearch = (
  userToken: string | null,
  userCredits: number,
  on401: () => void,
  refreshUserInfo: () => Promise<void>,
  onTopUp?: () => void
) => {
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 询价
  const fetchQuote = useCallback(async (days: number) => {
    try {
      return await searchApi.quote(userToken, days, on401);
    } catch {
      return null;
    }
  }, [userToken, on401]);

  // 执行搜索
  const performSearch = useCallback(async (
    from: string,
    to: string,
    startDate: string,
    days: number = 30,
    options?: SearchRequestOptions
  ) => {
    setLoading(true);
    setError(null);
    try {
      const body: SearchRequestPayload = {
        origin: from.toUpperCase(),
        destination: to.toUpperCase(),
        start_date: startDate,
        days,
        cabin_class: options?.cabinClass || 'economy',
        adults: options?.adults ?? 1,
        children: options?.children ?? 0,
        trip_type: options?.tripType || 'one_way',
        sort_strategy: options?.sortStrategy || 'best',
      };

      if (options?.tripType === 'round_trip' && options?.returnDate) {
        body.return_date = options.returnDate;
      }
      if (options?.maxStops !== undefined) {
        body.max_stops = options.maxStops;
      }
      if (options?.departureTimeMin) {
        body.departure_time_min = options.departureTimeMin;
      }
      if (options?.departureTimeMax) {
        body.departure_time_max = options.departureTimeMax;
      }
      if (options?.arrivalTimeMin) {
        body.arrival_time_min = options.arrivalTimeMin;
      }
      if (options?.arrivalTimeMax) {
        body.arrival_time_max = options.arrivalTimeMax;
      }
      if (options?.airlineInclude) {
        body.airline_include = options.airlineInclude;
      }
      if (options?.excludedAirlines?.trim()) {
        body.excluded_airlines = options.excludedAirlines.trim().replace(/\s+/g, ',').replace(/,+/g, ',');
      }

      const response = await searchApi.search(userToken, body, on401);
      setSearchResult(response);
      await refreshUserInfo();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('402') || errorMessage.includes('Insufficient')) {
        const cost = calculateSearchCost(days);
        Alert.alert(
          '💎 Insufficient Credits',
          `This search costs ${cost} credit(s). Please top up first.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Top Up', onPress: onTopUp },
          ],
        );
      } else {
        setError(errorMessage);
        setSearchResult(null);
      }
    } finally {
      setLoading(false);
    }
  }, [userToken, on401, refreshUserInfo, onTopUp]);

  // 确认后搜索（先询价，再弹窗确认）
  const confirmAndSearch = useCallback(async (
    from: string,
    to: string,
    startDate: string,
    days: number = 30,
    options?: SearchRequestOptions
  ) => {
    const trimFrom = from.trim().toUpperCase();
    const trimTo = to.trim().toUpperCase();
    const trimDate = startDate.trim();

    if (trimFrom.length !== 3 || trimTo.length !== 3) {
      Alert.alert('Error', 'IATA code must be 3 letters (e.g. JFK, PVG)');
      return;
    }
    if (trimFrom === trimTo) {
      Alert.alert('Error', 'Origin and destination cannot be the same');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimDate)) {
      Alert.alert('Error', 'Date must be YYYY-MM-DD format');
      return;
    }

    // 先询价获取真实费用
    const quote = await fetchQuote(days);
    const cost = quote?.cost ?? calculateSearchCost(days);
    const balance = quote?.user_credits ?? userCredits;
    const sufficient = quote?.sufficient ?? (balance >= cost);

    if (!sufficient) {
      Alert.alert(
        '💎 Insufficient Credits',
        `This search costs ${cost} credit(s).\nYour balance: 💎 ${balance}\n\nPlease top up first.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Top Up', onPress: onTopUp },
        ],
      );
      return;
    }

    const modeLabel = days === 1 ? 'Fixed Date' : `Range ${days} Days`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Search ${trimFrom} → ${trimTo} from ${trimDate}?\n\nMode: ${modeLabel}\nThis [${modeLabel}] search will cost ${cost} Credit(s). Continue?\n\nBalance: 💎 ${balance}\nAfter: 💎 ${balance - cost}`,
      );
      if (confirmed) performSearch(trimFrom, trimTo, trimDate, days, options);
    } else {
      Alert.alert(
        '🔍 Confirm Search',
        `${trimFrom} → ${trimTo} from ${trimDate}\n\nMode: ${modeLabel}\nThis [${modeLabel}] search will cost ${cost} Credit(s). Continue?\n\nBalance: 💎 ${balance}\nAfter: 💎 ${balance - cost}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Search', onPress: () => performSearch(trimFrom, trimTo, trimDate, days, options) },
        ],
      );
    }
  }, [fetchQuote, userCredits, performSearch, onTopUp]);

  return {
    searchResult,
    loading,
    error,
    fetchQuote,
    performSearch,
    confirmAndSearch,
    setSearchResult,
  };
};

