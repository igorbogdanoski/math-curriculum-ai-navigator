export type Language = 'mk' | 'sq' | 'tr';

export const LANGUAGES = [
  { code: 'mk', name: 'Македонски', flag: '🇲🇰' },
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
];

export const setLanguagePreference = (lang: Language) => {
  localStorage.setItem('preferred_language', lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('languagechange'));
};

export const getLanguagePreference = (): Language => {
  const stored = localStorage.getItem('preferred_language') as Language;
  if (stored && ['mk', 'sq', 'tr'].includes(stored)) return stored;
  
  if (navigator.language.startsWith('sq')) return 'sq';
  if (navigator.language.startsWith('tr')) return 'tr';
  return 'mk';
};