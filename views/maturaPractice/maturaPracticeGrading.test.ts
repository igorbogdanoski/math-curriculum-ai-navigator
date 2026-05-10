/**
 * Tests for views/maturaPractice/maturaPracticeGrading.ts (T1.4).
 *
 * Strategy: mock callGeminiProxy + getCachedAIGrade/saveAIGrade so we can drive
 * the cache → call → parse → save pipeline deterministically.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/gemini/core', () => ({
  callGeminiProxy: vi.fn(),
  DEFAULT_MODEL: 'gemini-test-model',
}));

vi.mock('../../services/firestoreService.matura', async () => {
  const actual = await vi.importActual<typeof import('../../services/firestoreService.matura')>(
    '../../services/firestoreService.matura',
  );
  return {
    ...actual,
    getCachedAIGrade: vi.fn(),
    saveAIGrade: vi.fn(),
  };
});

import { callGeminiProxy } from '../../services/gemini/core';
import {
  getCachedAIGrade,
  saveAIGrade,
  type MaturaQuestion,
} from '../../services/firestoreService.matura';
import { gradePart2, gradePart3, explainWrongAnswer } from './maturaPracticeGrading';

function makeQ(over: Partial<MaturaQuestion> = {}): MaturaQuestion {
  return {
    examId: 'exam-1',
    year: 2024,
    session: 'june',
    language: 'mk',
    questionNumber: 5,
    part: 2,
    points: 4,
    questionType: 'open',
    questionText: 'Реши x² - 4 = 0',
    correctAnswer: 'x = ±2',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedAIGrade).mockResolvedValue(null);
});

// ─── gradePart2 ───────────────────────────────────────────────────────────────

describe('gradePart2', () => {
  it('returns cached result without calling Gemini', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k', score: 3, maxPoints: 4, feedback: 'ok',
    });
    const out = await gradePart2(makeQ(), 'x = 2');
    expect(out).toEqual({ score: 3, maxScore: 4, feedback: 'ok' });
    expect(callGeminiProxy).not.toHaveBeenCalled();
  });

  it('calls Gemini and parses JSON when no cache hit', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: 'Some preamble {"score":3,"correct":true,"comment":"добро","feedback":"супер"} trailing',
    } as any);
    const out = await gradePart2(makeQ({ points: 4 }), 'x = ±2');
    expect(out.score).toBe(3);
    expect(out.maxScore).toBe(4);
    expect(out.feedback).toBe('супер');
    expect(out.correct).toBe(true);
    expect(saveAIGrade).toHaveBeenCalled();
  });

  it('clamps score to maxPoints (= q.points)', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":99,"correct":true,"feedback":"x"}',
    } as any);
    const out = await gradePart2(makeQ({ points: 4 }), 'answer');
    expect(out.score).toBe(4);
  });

  it('uses default 4 max points when q.points is unset', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":2,"correct":false,"feedback":"x"}',
    } as any);
    const out = await gradePart2(makeQ({ points: undefined as unknown as number }), 'a');
    expect(out.maxScore).toBe(4);
  });

  it('throws on unparseable Gemini response', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({ text: 'not json at all' } as any);
    await expect(gradePart2(makeQ(), 'x')).rejects.toThrow('Parse error');
  });

  it('treats imageUrl in cache key (different cache keys for text vs photo)', async () => {
    // First call (text only) → cache hit with score 1
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k1', score: 1, maxPoints: 4, feedback: 'a',
    });
    // Second call (with image) → cache miss → falls through to Gemini
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce(null);
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":3,"correct":true,"feedback":"img"}',
    } as any);

    // Stub fetch to fail so urlToBase64 returns null (we don't actually need image data,
    // just need to verify a *different* cache key is used).
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('no network'); }) as any;
    try {
      await gradePart2(makeQ(), 'answer');
      const out2 = await gradePart2(makeQ(), 'answer', 'http://example.com/img.png');
      expect(out2.score).toBe(3);
      expect(out2.feedback).toBe('img');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ─── gradePart3 ───────────────────────────────────────────────────────────────

describe('gradePart3', () => {
  it('returns cached result without calling Gemini', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k', score: 2, maxPoints: 4, feedback: 'cached',
    });
    const out = await gradePart3(makeQ({ points: 4 }), 'description');
    expect(out).toEqual({ score: 2, maxScore: 4, feedback: 'cached' });
    expect(callGeminiProxy).not.toHaveBeenCalled();
  });

  it('parses JSON, clamps score, persists via saveAIGrade', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":99,"feedback":"perfect"}',
    } as any);
    const out = await gradePart3(makeQ({ points: 5 }), 'desc');
    expect(out.score).toBe(5);
    expect(out.maxScore).toBe(5);
    expect(out.feedback).toBe('perfect');
    expect(saveAIGrade).toHaveBeenCalled();
  });

  it('uses 0 score when score field missing', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"feedback":"no score"}',
    } as any);
    const out = await gradePart3(makeQ({ points: 4 }), 'desc');
    expect(out.score).toBe(0);
    expect(out.feedback).toBe('no score');
  });

  it('throws on unparseable Gemini response', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({ text: 'still not json' } as any);
    await expect(gradePart3(makeQ(), 'd')).rejects.toThrow('Parse error');
  });
});

// ─── explainWrongAnswer ───────────────────────────────────────────────────────

describe('explainWrongAnswer', () => {
  it('returns Gemini text trimmed', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '   Не — забораволе да го избереш правилниот концепт. Обиди се повторно.   ',
    } as any);
    const out = await explainWrongAnswer(makeQ(), 'Б', 'x = 4');
    expect(out).toBe('Не — забораволе да го избереш правилниот концепт. Обиди се повторно.');
  });

  it('returns Macedonian fallback when Gemini text is missing', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({ text: undefined } as any);
    const out = await explainWrongAnswer(makeQ(), 'Б', 'x = 4');
    expect(out).toBe('Не можев да генерирам објаснување.');
  });
});
