import { translations } from './translations';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getLanguagePreference, setLanguagePreference as saveLang } from './index';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLangState] = useState<Language>(getLanguagePreference());

  useEffect(() => {
    document.documentElement.lang = language;
    const handleLangChange = () => setLangState(getLanguagePreference());
    window.addEventListener('languagechange', handleLangChange);
    return () => window.removeEventListener('languagechange', handleLangChange);
  }, [language]);

  const setLanguage = (lang: Language) => {
    saveLang(lang);
    setLangState(lang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || (translations['mk'] ? translations['mk'][key] : undefined) || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
