/**
 * S61-C5 — Tests for the `geometry_construct` question type plumbing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/gemini/core', () => ({
  DEFAULT_MODEL: 'mock-model',
  SAFETY_SETTINGS: [],
  callGeminiProxy: vi.fn(),
  checkDailyQuotaGuard: vi.fn(),
  getResolvedTextSystemInstruction: vi.fn(() => 'sys'),
  getAILanguageRule: vi.fn(() => 'македонски'),
  generateAndParseJSON: vi.fn(),
  Type: {},
}));

import { needsAIGrade, autoScore } from '../utils/duggaScoring';
import { duggaAPI } from '../services/gemini/dugga';
import { callGeminiProxy } from '../services/gemini/core';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

const baseQ: DuggaQuestion = {
  id: 'g1',
  type: 'geometry_construct',
  text: 'Конструирај средна точка на дадена дужина AB',
  dok: 3,
  points: 5,
  expectedConstruction: {
    description: 'Користи шестар за два круга и спој ги пресечните точки.',
    rubric: 'два круга • спојна линија • пресек',
  },
};

describe('S61-C5 geometry_construct — grading routing', () => {
  it('autoScore returns null (requires AI grading)', () => {
    expect(autoScore(baseQ, 'free-text notes')).toBeNull();
  });

  it('needsAIGrade returns true', () => {
    expect(needsAIGrade(baseQ)).toBe(true);
  });
});

describe('S61-C5 duggaAPI.gradeGeometryConstruction', () => {
  beforeEach(() => vi.mocked(callGeminiProxy).mockReset());

  it('forwards prompt and returns the trimmed response', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '\n  **Поени:** 4/5\nТочно изведени чекори: 3 \n  ',
    } as never);
    const out = await duggaAPI.gradeGeometryConstruction({
      question: baseQ.text,
      expectedDescription: baseQ.expectedConstruction!.description,
      studentNotes: 'Конструирав два круга и ги спојив пресеците.',
      rubric: baseQ.expectedConstruction!.rubric,
      maxPoints: baseQ.points,
    });
    expect(out.startsWith('**Поени:** 4/5')).toBe(true);
    expect(callGeminiProxy).toHaveBeenCalledTimes(1);

    const call = vi.mocked(callGeminiProxy).mock.calls[0][0];
    const txt = (call.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
    expect(txt).toContain('геометриска конструкција');
    expect(txt).toContain('Барана конструкција: ' + baseQ.expectedConstruction!.description);
    expect(txt).toContain('Рубрика: ' + baseQ.expectedConstruction!.rubric);
    expect(txt).toContain('Максимум поени: 5');
  });

  it('handles missing rubric and missing constructionState gracefully', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '**Поени:** 0/5',
    } as never);
    await duggaAPI.gradeGeometryConstruction({
      question: 'q',
      expectedDescription: 'd',
      studentNotes: '',
      maxPoints: 5,
    });
    const call = vi.mocked(callGeminiProxy).mock.calls[0][0];
    const txt = (call.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
    expect(txt).toContain('Белешки на ученик: (нема)');
    expect(txt).toContain('GeoGebra состојба: (не е достапна');
    expect(txt).not.toContain('Рубрика:');
  });

  it('truncates very long constructionState payloads', async () => {
    const huge = 'X'.repeat(8000);
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({ text: 'ok' } as never);
    await duggaAPI.gradeGeometryConstruction({
      question: 'q',
      expectedDescription: 'd',
      studentNotes: 'n',
      constructionState: huge,
      maxPoints: 5,
    });
    const call = vi.mocked(callGeminiProxy).mock.calls[0][0];
    const txt = (call.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
    // 4000-char cap on the embedded state
    const idx = txt.indexOf('XXXXX');
    expect(idx).toBeGreaterThan(-1);
    const slice = txt.slice(idx).replace(/\n[\s\S]*$/, '');
    expect(slice.length).toBeLessThanOrEqual(4000);
  });
});
