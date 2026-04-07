import { describe, expect, it } from 'vitest';
import type { PresentationSlide } from '../types';
import {
  deriveContextualFormulas,
  inferPriorFormulas,
  inferSlideFormulas,
  looksLikeFormula,
  normalizeFormula,
  resolveSlideConcept,
} from '../utils/gammaContext';

const baseSlide: PresentationSlide = {
  title: 'Тест',
  type: 'content',
  content: [],
};

describe('gammaContext utilities', () => {
  it('normalizes formula whitespace', () => {
    expect(normalizeFormula('  y   =  mx +  b  ')).toBe('y = mx + b');
  });

  it('detects formula-like content', () => {
    expect(looksLikeFormula('a^2 + b^2 = c^2')).toBe(true);
    expect(looksLikeFormula('\\frac{1}{2}')).toBe(true);
    expect(looksLikeFormula('Ова е само текст.')).toBe(false);
  });

  it('prefers explicit formulas on slide', () => {
    const slide: PresentationSlide = {
      ...baseSlide,
      formulas: [' y = 2x + 3 ', 'y = 2x + 3'],
      content: ['Текст без формула'],
    };
    expect(inferSlideFormulas(slide)).toEqual(['y = 2x + 3']);
  });

  it('infers formulas from content and solution when explicit are missing', () => {
    const slide: PresentationSlide = {
      ...baseSlide,
      type: 'example',
      content: ['Реши: x + 2 = 7', 'Чекор 1'],
      solution: ['x = 5'],
    };
    expect(inferSlideFormulas(slide)).toEqual(['Реши: x + 2 = 7', 'x = 5']);
  });

  it('infers prior formulas from previous slides', () => {
    const slides: PresentationSlide[] = [
      { ...baseSlide, type: 'formula-centered', content: ['a^2 + b^2 = c^2'] },
      { ...baseSlide, type: 'content', content: ['Текст'] },
      { ...baseSlide, type: 'example', content: ['Примени a^2 + b^2 = c^2'] },
    ];
    expect(inferPriorFormulas(slides, 2)).toContain('a^2 + b^2 = c^2');
  });

  it('uses explicit priorFormulas when provided', () => {
    const slides: PresentationSlide[] = [
      { ...baseSlide, type: 'formula-centered', content: ['x + y = z'] },
      { ...baseSlide, type: 'example', content: ['Решение'], priorFormulas: ['  F = ma  '] },
    ];

    expect(deriveContextualFormulas(slides, slides[1], 1)).toEqual(['F = ma']);
  });

  it('resolves concept from slide metadata or topic fallback', () => {
    const withConcept: PresentationSlide = { ...baseSlide, type: 'step-by-step', concept: 'Линеарни равенки' };
    const withoutConcept: PresentationSlide = { ...baseSlide, type: 'example' };
    const neutral: PresentationSlide = { ...baseSlide, type: 'summary' };

    expect(resolveSlideConcept(withConcept, 'Алгебра')).toBe('Линеарни равенки');
    expect(resolveSlideConcept(withoutConcept, 'Алгебра')).toBe('Алгебра');
    expect(resolveSlideConcept(neutral, 'Алгебра')).toBe('');
  });
});
