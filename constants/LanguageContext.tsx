import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getEvolutionName,
  getFullWeekdays,
  getMissionCopy,
  getSoundCategory,
  getSoundName,
  getWeekdays,
  isLanguage,
  Language,
  TranslationKey,
  translate,
  translateArray,
  translations,
} from './i18n';

export { Language, TranslationKey };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  ta: (key: TranslationKey) => string[];
  weekdays: string[];
  fullWeekdays: string[];
  missionCopy: (id?: string | null) => { label: string; verb: string; hint: string };
  soundName: (id?: string | null, fallback?: string) => string;
  soundCategory: (category: string) => string;
  evolutionName: (id: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  t: (key, params) => translate('es', key, params),
  ta: (key) => translateArray('es', key),
  weekdays: getWeekdays('es'),
  fullWeekdays: getFullWeekdays('es'),
  missionCopy: (id) => getMissionCopy('es', id),
  soundName: (id, fallback) => getSoundName('es', id, fallback),
  soundCategory: (category) => getSoundCategory('es', category),
  evolutionName: (id) => getEvolutionName('es', id),
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    AsyncStorage.getItem('app_language').then(lang => {
      if (isLanguage(lang)) {
        setLanguageState(lang);
      }
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('app_language', lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => translate(language, key, params);
  const ta = (key: TranslationKey): string[] => translateArray(language, key);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        ta,
        weekdays: getWeekdays(language),
        fullWeekdays: getFullWeekdays(language),
        missionCopy: (id) => getMissionCopy(language, id),
        soundName: (id, fallback) => getSoundName(language, id, fallback),
        soundCategory: (category) => getSoundCategory(language, category),
        evolutionName: (id) => getEvolutionName(language, id),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
