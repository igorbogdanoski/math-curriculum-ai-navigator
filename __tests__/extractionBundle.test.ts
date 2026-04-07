import { describe, expect, it } from 'vitest';
import { buildExtractionBundle, evaluateExtractionQuality } from '../utils/extractionBundle';

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

  it('computes a higher quality score for rich extraction bundles', () => {
    const rich = buildExtractionBundle([
      'Теорема: a^2 + b^2 = c^2',
      'Дефиниција: Линеарна функција y = mx + b',
      'Задача: Реши x + 2 = 11',
      'Задача: Пресметај површина',
      'Објаснување: Прво изолирај ја променливата.',
    ].join('\n'));

    const poor = buildExtractionBundle('Краток текст без многу структура.');

    const richScore = evaluateExtractionQuality(rich, { textLength: 1200, extractionMode: 'html-static' });
    const poorScore = evaluateExtractionQuality(poor, { textLength: 90, truncated: true });

    expect(richScore.score).toBeGreaterThan(poorScore.score);
    expect(richScore.label === 'good' || richScore.label === 'excellent').toBe(true);
    expect(poorScore.label).toBe('poor');
  });
});
