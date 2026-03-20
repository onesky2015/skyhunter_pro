// filename: i18n/index.ts
import { useState, useCallback, createContext, useContext } from 'react';
import en from './en';
import zh from './zh';
import { storage } from '../services/storage';

const LANG_KEY = 'skyhunter_lang';

type Translations = typeof en;
type Language = 'en' | 'zh';

const translations: Record<Language, Translations> = { en, zh };

let _currentLang: Language = 'en';

export function t(section: keyof Translations, key: string): string {
  const sect = translations[_currentLang]?.[section] as Record<string, string> | undefined;
  if (sect && key in sect) return sect[key];
  const fallback = translations['en'][section] as Record<string, string> | undefined;
  return fallback?.[key] ?? key;
}

export function useI18n() {
  const [lang, setLangState] = useState<Language>(_currentLang);

  const setLang = useCallback(async (newLang: Language) => {
    _currentLang = newLang;
    setLangState(newLang);
    await storage.setItem(LANG_KEY, newLang);
  }, []);

  const initLang = useCallback(async () => {
    const saved = await storage.getItem(LANG_KEY);
    if (saved === 'zh' || saved === 'en') {
      _currentLang = saved;
      setLangState(saved);
    }
  }, []);

  return {
    lang,
    setLang,
    initLang,
    t: (section: keyof Translations, key: string) => t(section, key),
  };
}

export type { Language, Translations };
