import { describe, expect, it } from 'vitest';
import {
  buildExtractionBundle,
  evaluateExtractionQuality,
  detectLatexFormulas,
  mergeExtractionBundles,
  inferDokForBundle,
  extractionSignature,
  summarizeExtractionBundle,
  type ExtractedContentBundle,
} from '../utils/extractionBundle';

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

describe('detectLatexFormulas', () => {
  it('extracts inline, display, and LaTeX-bracketed formulas', () => {
    const text = 'See $a^2+b^2=c^2$ and $$\\int_0^1 x\\,dx$$ and \\(\\sin x\\) and \\[e^{i\\pi}=-1\\].';
    const out = detectLatexFormulas(text);
    expect(out.some((s) => s.includes('a^2+b^2=c^2'))).toBe(true);
    expect(out.some((s) => s.includes('\\int_0^1'))).toBe(true);
    expect(out.some((s) => s.includes('\\sin x'))).toBe(true);
    expect(out.some((s) => s.includes('e^{i\\pi}'))).toBe(true);
  });

  it('returns empty array for text without LaTeX', () => {
    expect(detectLatexFormulas('plain sentence no math')).toEqual([]);
    expect(detectLatexFormulas('')).toEqual([]);
  });
});

describe('mergeExtractionBundles', () => {
  it('dedupes across channels and preserves order', () => {
    const a: ExtractedContentBundle = {
      formulas: ['a=b', 'c=d'],
      theories: ['Def X'],
      tasks: ['Task 1'],
      rawSnippet: 'alpha',
    };
    const b: ExtractedContentBundle = {
      formulas: ['a=b', 'e=f'],
      theories: ['Def Y'],
      tasks: ['Task 2'],
      rawSnippet: 'beta',
    };
    const merged = mergeExtractionBundles([a, b]);
    expect(merged.formulas).toEqual(['a=b', 'c=d', 'e=f']);
    expect(merged.theories).toEqual(['Def X', 'Def Y']);
    expect(merged.tasks.length).toBe(2);
    expect(merged.rawSnippet).toContain('alpha');
    expect(merged.rawSnippet).toContain('beta');
  });

  it('returns empty bundle for empty input', () => {
    const merged = mergeExtractionBundles([]);
    expect(merged.formulas).toEqual([]);
    expect(merged.rawSnippet).toBe('');
  });
});

describe('inferDokForBundle', () => {
  it('returns 4 for research verbs', () => {
    const b: ExtractedContentBundle = {
      formulas: [], theories: [],
      tasks: ['Истражи како се менува функцијата', 'генерализирај го правилото'],
      rawSnippet: '',
    };
    expect(inferDokForBundle(b)).toBe(4);
  });

  it('returns 3 for proof verbs', () => {
    const b: ExtractedContentBundle = {
      formulas: [], theories: [],
      tasks: ['Докажи дека a^2+b^2=c^2', 'изведи ја формулата'],
      rawSnippet: '',
    };
    expect(inferDokForBundle(b)).toBe(3);
  });

  it('returns 1 for minimal content', () => {
    const b: ExtractedContentBundle = {
      formulas: [], theories: [], tasks: [], rawSnippet: '',
    };
    expect(inferDokForBundle(b)).toBe(1);
  });

  it('returns 2 for standard compute tasks', () => {
    const b: ExtractedContentBundle = {
      formulas: ['a=b'], theories: ['Def'],
      tasks: ['Пресметај y за x=2'],
      rawSnippet: '',
    };
    expect(inferDokForBundle(b)).toBe(2);
  });
});

describe('extractionSignature', () => {
  it('is stable and order-independent within each channel slice', () => {
    const b: ExtractedContentBundle = {
      formulas: ['a', 'b'], theories: ['c'], tasks: ['d'], rawSnippet: '',
    };
    const sig = extractionSignature(b);
    expect(typeof sig).toBe('string');
    expect(sig.split('::').length).toBe(3);
    expect(extractionSignature(b)).toBe(sig);
  });
});

describe('summarizeExtractionBundle', () => {
  it('counts items and flags content types', () => {
    const b: ExtractedContentBundle = {
      formulas: ['a=b'], theories: ['x'], tasks: ['solve me please'],
      rawSnippet: '',
    };
    const s = summarizeExtractionBundle(b);
    expect(s.totalItems).toBe(3);
    expect(s.hasMath).toBe(true);
    expect(s.hasTheory).toBe(true);
    expect(s.hasTasks).toBe(true);
    expect(s.longestTaskChars).toBe('solve me please'.length);
  });
});
