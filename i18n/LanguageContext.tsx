import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getLanguagePreference, setLanguagePreference as saveLang } from './index';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  mk: {
    'nav.home': 'Почетна',
    'nav.generator': 'AI Генератор',
    'nav.planner': 'Планер',
    'nav.analytics': 'Аналитика',
    'nav.mylessons': 'Мои подготовки',
    'nav.library': 'Библиотека',
    'nav.schooladmin': 'Училиште',
    'nav.settings': 'Поставки',
    'nav.explore': 'Истражи програма',
    'nav.graph': 'Интерактивен Граф',
    'nav.roadmap': 'Патна Мапа',
    'nav.assistant': 'AI Асистент',
    'nav.testgenerator': 'Генератор на Тестови',
    'nav.coverage': 'Анализа на покриеност',
    'nav.favorites': 'Омилени',
    'nav.gallery': 'Галерија'
  },
  sq: {
    'nav.home': 'Kreu',
    'nav.generator': 'AI Gjenerator',
    'nav.planner': 'Planifikuesi',
    'nav.analytics': 'Analiza',
    'nav.mylessons': 'Planet e mia',
    'nav.library': 'Biblioteka',
    'nav.schooladmin': 'Shkolla',
    'nav.settings': 'Cilësimet',
    'nav.explore': 'Eksploro programin',
    'nav.graph': 'Grafiku Interaktiv',
    'nav.roadmap': 'Harta e rrugës',
    'nav.assistant': 'Asistent AI',
    'nav.testgenerator': 'Gjenerator Testesh',
    'nav.coverage': 'Mbulimi i Kurrikulës',
    'nav.favorites': 'Të preferuarat',
    'nav.gallery': 'Galeria'
  },
  tr: {
    'nav.home': 'Ana Sayfa',
    'nav.generator': 'Yapay Zeka',
    'nav.planner': 'Planlayıcı',
    'nav.analytics': 'Analiz',
    'nav.myllessons': 'Planlarım',
    'nav.library': 'Kütüphane',
    'nav.schooladmin': 'Okul',
    'nav.settings': 'Ayarlar',
    'nav.explore': 'Programı Keşfet',
    'nav.graph': 'İnteraktif Grafik',
    'nav.roadmap': 'Yol Haritası',
    'nav.assistant': 'AI Asistanı',
    'nav.testgenerator': 'Test Oluşturucu',
    'nav.coverage': 'Müfredat Kapsamı',
    'nav.favorites': 'Favoriler',
    'nav.gallery': 'Galeri'
  }
};

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
    return translations[language]?.[key] || translations['mk'][key] || key;
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
