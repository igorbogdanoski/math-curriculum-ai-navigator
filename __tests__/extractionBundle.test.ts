import { describe, expect, it } from 'vitest';
import { buildExtractionBundle } from '../utils/extractionBundle';

describe('buildExtractionBundle', () => {
  it('extracts formulas, theory lines and tasks from mixed educational text', () => {
    const text = [
      'Теорема: За правоаголен триаголник важи a^2 + b^2 = c^2.',
      'Дефиниција: Линеарна функција е y = mx + b.',
      'Задача 1: Пресметај y за x = 2.',
      'Објаснување: m е наклон, b е пресек со y-оска.',
    ].join('\n');

    const bundle = buildExtractionBundle(text);

    expect(bundle.formulas.some((f) => f.includes('a^2 + b^2 = c^2'))).toBe(true);
    expect(bundle.theories.some((t) => t.toLowerCase().includes('дефиниција'))).toBe(true);
    expect(bundle.tasks.some((t) => t.toLowerCase().includes('задача'))).toBe(true);
    expect(bundle.rawSnippet.length).toBeGreaterThan(20);
  });
});
