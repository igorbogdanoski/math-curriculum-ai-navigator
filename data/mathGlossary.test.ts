import { describe, it, expect } from 'vitest';
import { findTermsInText, getGlossaryEntry, GLOSSARY } from './mathGlossary';

describe('mathGlossary helpers', () => {
  it('finds an exact term', () => {
    const found = findTermsInText('Пресметај ја дискриминантата на равенката.');
    expect(found.length).toBe(1);
    expect(found[0].entry.term).toBe('дискриминанта');
  });

  it('matches case-insensitively', () => {
    const found = findTermsInText('Питагорова теорема е важна.');
    expect(found.some((f) => f.entry.term === 'питагорова теорема')).toBe(true);
  });

  it('deduplicates the same canonical term', () => {
    const text = 'Дискриминантата покажува… Дискриминантата исто така…';
    const found = findTermsInText(text);
    const occurrences = found.filter((f) => f.entry.term === 'дискриминанта');
    expect(occurrences.length).toBe(1);
  });

  it('preserves order of first occurrence', () => {
    const text = 'Изводот на функцијата мора да биде непрекинат.';
    const found = findTermsInText(text);
    const terms = found.map((f) => f.entry.term);
    expect(terms.indexOf('извод')).toBeLessThan(terms.indexOf('функција'));
  });

  it('skips math segments to avoid false positives', () => {
    // Cyrillic letters inside $...$ shouldn't count, only outside.
    const text = '$ \\sin x $ е тригонометриска. Синус.';
    const found = findTermsInText(text);
    // 'sin' alias inside math is stripped; outside, we still get 'синус'.
    expect(found.some((f) => f.entry.term === 'синус')).toBe(true);
  });

  it('matches Latin aliases too', () => {
    const found = findTermsInText('Решете log(8) = 3.');
    expect(found.some((f) => f.entry.term === 'логаритам')).toBe(true);
  });

  it('returns empty for empty text', () => {
    expect(findTermsInText('')).toEqual([]);
  });

  it('getGlossaryEntry resolves canonical and aliases', () => {
    expect(getGlossaryEntry('дискриминанта')?.term).toBe('дискриминанта');
    expect(getGlossaryEntry('Дискриминантата')?.term).toBe('дискриминанта');
    expect(getGlossaryEntry('log')?.term).toBe('логаритам');
    expect(getGlossaryEntry('nepostoecki termin')).toBeUndefined();
  });

  it('all glossary entries are well-formed', () => {
    for (const e of GLOSSARY) {
      expect(e.term.length).toBeGreaterThan(0);
      expect(e.definition.length).toBeGreaterThan(10);
      expect(['algebra', 'geometrija', 'analiza', 'kombinatorika', 'trigonometrija', 'opsto']).toContain(e.topic);
    }
  });

  it('prefers longer aliases when overlap exists', () => {
    // "Питагорова теорема" should match the long form before "Питагора".
    const found = findTermsInText('Питагорова теорема за правоаголен триаголник.');
    const term = found.find((f) => f.entry.term === 'питагорова теорема');
    expect(term?.surface.toLowerCase()).toContain('питагорова теорема');
  });
});
