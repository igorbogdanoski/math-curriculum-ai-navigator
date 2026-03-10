export type Language = 'mk' | 'sq' | 'tr' | 'en';

export const LANGUAGES = [
  { code: 'mk', name: 'Македонски', flag: '🇲🇰' },
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
];

export const setLanguagePreference = (lang: Language) => {
  localStorage.setItem('preferred_language', lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('languagechange'));
};

export const getLanguagePreference = (): Language => {
  const stored = localStorage.getItem('preferred_language') as Language;
  if (stored && ['mk', 'sq', 'tr', 'en'].includes(stored)) return stored;

  if (navigator.language.startsWith('sq')) return 'sq';
  if (navigator.language.startsWith('tr')) return 'tr';
  if (navigator.language.startsWith('en')) return 'en';
  if (navigator.language.startsWith('en')) return 'en';
  return 'mk';
};
