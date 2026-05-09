/**
 * S61-D1 — Tests for generateFromConcept (parser + normaliser + mocked call).
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

import {
  parseGeneratedQuestionsJson,
  normaliseGeneratedQuestion,
  duggaAPI,
} from '../services/gemini/dugga';
import { callGeminiProxy } from '../services/gemini/core';

describe('parseGeneratedQuestionsJson', () => {
  it('returns [] for empty', () => {
    expect(parseGeneratedQuestionsJson('')).toEqual([]);
  });
  it('parses a clean JSON array', () => {
    const arr = parseGeneratedQuestionsJson('[{"type":"essay","text":"A"}]');
    expect(arr).toHaveLength(1);
    expect(arr[0].type).toBe('essay');
  });
  it('strips ```json code fences', () => {
    const raw = '```json\n[{"type":"short_answer","text":"X"}]\n```';
    expect(parseGeneratedQuestionsJson(raw)).toHaveLength(1);
  });
  it('extracts an array embedded in surrounding prose', () => {
    const raw = 'Еве ги прашањата: [{"type":"true_false","text":"Y"}] — крај.';
    expect(parseGeneratedQuestionsJson(raw)).toEqual([{ type: 'true_false', text: 'Y' }]);
  });
  it('returns [] on irrecoverable junk', () => {
    expect(parseGeneratedQuestionsJson('{not json')).toEqual([]);
  });
});

describe('normaliseGeneratedQuestion', () => {
  it('falls back to short_answer + dok=2 when fields are missing', () => {
    const q = normaliseGeneratedQuestion({}, 'C1', 0);
    expect(q.type).toBe('short_answer');
    expect(q.dok).toBe(2);
    expect(q.points).toBe(2);
    expect(q.linkedConceptIds).toEqual(['C1']);
    expect(q.text).toBe('');
  });

  it('preserves valid fields and trims text', () => {
    const q = normaliseGeneratedQuestion({
      type: 'multiple_choice',
      dok: 3,
      points: 5,
      text: '  Колку е 2+2?  ',
      correctAnswer: '4',
      solution: '2+2=4',
      hint: 'едноцифрено',
    }, 'C2', 1);
    expect(q.type).toBe('multiple_choice');
    expect(q.dok).toBe(3);
    expect(q.points).toBe(5);
    expect(q.text).toBe('Колку е 2+2?');
    expect(q.correctAnswer).toBe('4');
    expect(q.solution).toBe('2+2=4');
    expect(q.hint).toBe('едноцифрено');
  });

  it('rejects unknown type and unknown dok', () => {
    const q = normaliseGeneratedQuestion({ type: 'fancy_pants', dok: 99 }, 'C1', 0);
    expect(q.type).toBe('short_answer');
    expect(q.dok).toBe(2);
  });

  it('falls back to default points by dok when points missing', () => {
    expect(normaliseGeneratedQuestion({ dok: 1 }, 'C', 0).points).toBe(1);
    expect(normaliseGeneratedQuestion({ dok: 4 }, 'C', 0).points).toBe(6);
  });

  it('normalises options from string array', () => {
    const q = normaliseGeneratedQuestion({
      type: 'multiple_choice',
      options: ['A', 'B', 'C'],
    }, 'C', 0);
    expect(q.options?.length).toBe(3);
    expect(q.options?.[0]).toEqual({ id: 'a', text: 'A' });
  });

  it('normalises options from object array with isCorrect', () => {
    const q = normaliseGeneratedQuestion({
      type: 'multiple_choice',
      options: [
        { id: 'x', text: 'one', isCorrect: true },
        { text: 'two' },
        { text: '' }, // dropped
      ],
    }, 'C', 0);
    expect(q.options?.length).toBe(2);
    expect(q.options?.[0]).toEqual({ id: 'x', text: 'one', isCorrect: true });
    expect(q.options?.[1]).toEqual({ id: 'b', text: 'two' });
  });

  it('always tags linkedConceptIds with the supplied concept', () => {
    const q = normaliseGeneratedQuestion({}, 'CONCEPT-XYZ', 7);
    expect(q.linkedConceptIds).toEqual(['CONCEPT-XYZ']);
  });
});

describe('duggaAPI.generateFromConcept (mocked)', () => {
  beforeEach(() => {
    vi.mocked(callGeminiProxy).mockReset();
  });

  it('returns parsed + normalised questions', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: JSON.stringify([
        { type: 'multiple_choice', dok: 1, points: 1, text: 'Q1', options: ['a', 'b'], correctAnswer: 'a' },
        { type: 'essay', dok: 3, points: 4, text: 'Q2' },
      ]),
    } as never);

    const out = await duggaAPI.generateFromConcept({
      conceptId: 'C42',
      conceptLabel: 'Линеарни равенки',
      gradeLevel: 8,
      count: 2,
    });

    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('multiple_choice');
    expect(out[0].linkedConceptIds).toEqual(['C42']);
    expect(out[1].type).toBe('essay');
    expect(out[1].points).toBe(4);
  });

  it('returns [] when the model returns nonsense', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: 'нема JSON овде',
    } as never);

    const out = await duggaAPI.generateFromConcept({
      conceptId: 'C1',
      conceptLabel: 'X',
      gradeLevel: 5,
      count: 3,
    });
    expect(out).toEqual([]);
  });

  it('respects allowedTypes restriction (passes them in prompt)', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '[{"type":"true_false","text":"T"}]',
    } as never);
    await duggaAPI.generateFromConcept({
      conceptId: 'C1',
      conceptLabel: 'X',
      gradeLevel: 5,
      count: 1,
      allowedTypes: ['true_false'],
    });
    const call = vi.mocked(callGeminiProxy).mock.calls[0][0];
    const promptText = (call.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts[0].text;
    expect(promptText).toContain('Дозволени типови:** true_false');
  });
});
