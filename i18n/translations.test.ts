import { describe, it, expect } from 'vitest';
import { translations } from './translations';

/**
 * Guards against silently missing translation keys — the exact bug class behind
 * `analytics.bulletinPlaceholder` rendering as a raw key in production: a key present
 * in `mk` (the fallback language) but absent from another language just falls back
 * silently and is easy to miss; a key missing from `mk` too renders the raw key string
 * with no fallback at all.
 */
describe('translation dictionaries', () => {
  const languages = Object.keys(translations) as (keyof typeof translations)[];
  const mkKeys = new Set(Object.keys(translations.mk ?? {}));

  it('every language defines every key that mk defines', () => {
    for (const lang of languages) {
      if (lang === 'mk') continue;
      const dict = translations[lang] ?? {};
      const missing = [...mkKeys].filter((k) => !(k in dict));
      expect(missing, `${lang} is missing keys present in mk: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('mk defines every key that every other language defines (no orphaned translations)', () => {
    for (const lang of languages) {
      if (lang === 'mk') continue;
      const dict = translations[lang] ?? {};
      const extra = Object.keys(dict).filter((k) => !mkKeys.has(k));
      expect(extra, `${lang} defines keys missing from mk: ${extra.join(', ')}`).toEqual([]);
    }
  });

  it('no dictionary contains an empty-string value', () => {
    for (const lang of languages) {
      const dict = translations[lang] ?? {};
      const empty = Object.entries(dict).filter(([, v]) => v.trim() === '').map(([k]) => k);
      expect(empty, `${lang} has empty-string values for: ${empty.join(', ')}`).toEqual([]);
    }
  });
});
