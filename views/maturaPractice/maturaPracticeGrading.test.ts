/**
 * Tests for views/maturaPractice/maturaPracticeGrading.ts (T1.4).
 *
 * gradePart2/gradePart3 grading now happens server-side via /api/matura-grade (see that
 * file's header comment for why — the matura_ai_grades cache key is a deterministic hash,
 * so a client-side grade+cache-write would let a student precompute the key for their own
 * wrong answer and write a fabricated "correct" grade). These tests mock fetch + getAuthToken
 * to drive the cache-check → server-call pipeline deterministically. explainWrongAnswer is
 * unaffected by that move (no scored/cached grade is written) and still calls Gemini directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/gemini/core', () => ({
  callGeminiProxy: vi.fn(),
  DEFAULT_MODEL: 'gemini-test-model',
  getAuthToken: vi.fn(async () => 'test-token'),
}));

vi.mock('../../services/firestoreService.matura', async () => {
  const actual = await vi.importActual<typeof import('../../services/firestoreService.matura')>(
    '../../services/firestoreService.matura',
  );
  return {
    ...actual,
    getCachedAIGrade: vi.fn(),
  };
});

const recordMaturaSpacedReview = vi.fn(async (_uid: string, _examId: string, _questionNumber: number, _percentage: number) => {});
vi.mock('../../services/firestoreService.maturaSpacedRep', () => ({
  recordMaturaSpacedReview: (...args: Parameters<typeof recordMaturaSpacedReview>) => recordMaturaSpacedReview(...args),
}));

import { callGeminiProxy } from '../../services/gemini/core';
import {
  getCachedAIGrade,
  type MaturaQuestion,
} from '../../services/firestoreService.matura';
import { gradePart2, gradePart3, explainWrongAnswer, recordMcSpacedReview } from './maturaPracticeGrading';

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

function mockServerGrade(body: Record<string, unknown>, ok = true) {
  const origFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => (ok ? body : { error: 'Grading failed' }),
  })) as unknown as typeof fetch;
  return () => { globalThis.fetch = origFetch; };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedAIGrade).mockResolvedValue(null);
});

// ─── gradePart2 ───────────────────────────────────────────────────────────────

describe('gradePart2', () => {
  it('returns cached result without calling the server', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k', score: 3, maxPoints: 4, feedback: 'ok',
    });
    const restore = mockServerGrade({});
    try {
      const out = await gradePart2(makeQ(), 'x = 2');
      expect(out).toEqual({ score: 3, maxScore: 4, feedback: 'ok' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally { restore(); }
  });

  it('calls /api/matura-grade and returns its result when no cache hit', async () => {
    const restore = mockServerGrade({ score: 3, maxScore: 4, feedback: 'супер', correct: true });
    try {
      const out = await gradePart2(makeQ({ points: 4 }), 'x = ±2');
      expect(out.score).toBe(3);
      expect(out.maxScore).toBe(4);
      expect(out.feedback).toBe('супер');
      expect(out.correct).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/matura-grade', expect.objectContaining({ method: 'POST' }));
    } finally { restore(); }
  });

  it('throws when the server responds with a non-OK status', async () => {
    const restore = mockServerGrade({}, false);
    try {
      await expect(gradePart2(makeQ(), 'x')).rejects.toThrow('Grading failed');
    } finally { restore(); }
  });

  it('treats imageUrl in cache key (different cache keys for text vs photo)', async () => {
    // First call (text only) → cache hit with score 1
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k1', score: 1, maxPoints: 4, feedback: 'a',
    });
    // Second call (with image) → cache miss → falls through to the server
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce(null);
    const restore = mockServerGrade({ score: 3, maxScore: 4, feedback: 'img', correct: true });
    try {
      const out1 = await gradePart2(makeQ(), 'answer');
      expect(out1.score).toBe(1);
      const out2 = await gradePart2(makeQ(), 'answer', 'http://example.com/img.png');
      expect(out2.score).toBe(3);
      expect(out2.feedback).toBe('img');
    } finally { restore(); }
  });
});

// ─── gradePart3 ───────────────────────────────────────────────────────────────

describe('gradePart3', () => {
  it('returns cached result without calling the server', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k', score: 2, maxPoints: 4, feedback: 'cached',
    });
    const restore = mockServerGrade({});
    try {
      const out = await gradePart3(makeQ({ points: 4 }), 'description');
      expect(out).toEqual({ score: 2, maxScore: 4, feedback: 'cached' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally { restore(); }
  });

  it('returns the server-graded result and reflects q.points as maxScore', async () => {
    const restore = mockServerGrade({ score: 5, maxScore: 5, feedback: 'perfect' });
    try {
      const out = await gradePart3(makeQ({ points: 5 }), 'desc');
      expect(out.score).toBe(5);
      expect(out.maxScore).toBe(5);
      expect(out.feedback).toBe('perfect');
    } finally { restore(); }
  });

  it('throws when the server responds with a non-OK status', async () => {
    const restore = mockServerGrade({}, false);
    try {
      await expect(gradePart3(makeQ(), 'd')).rejects.toThrow('Grading failed');
    } finally { restore(); }
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

// ─── recordMcSpacedReview ───────────────────────────────────────────────────────
// 2026-07-18 (audit_2026_07_18_full_app_review, Wave 4): officially voided questions
// (correctAnswer: null) must never be scored or fed into spaced repetition.

describe('recordMcSpacedReview', () => {
  it('does not record anything for a voided question, regardless of what was selected', () => {
    const q = makeQ({ part: 1, questionType: 'mc', correctAnswer: null as unknown as string, voided: true, voidedReason: 'два точни одговори' });
    recordMcSpacedReview('u1', q, 'А');
    expect(recordMaturaSpacedReview).not.toHaveBeenCalled();
  });

  // 2026-07-19 (audit_2026_07_18_full_app_review, Wave 4 follow-up): needsReview questions
  // (our own ingested data is internally inconsistent — not a state-committee void) get the
  // same never-score treatment as voided.
  it('does not record anything for a needsReview question, regardless of what was selected', () => {
    const q = makeQ({ part: 1, questionType: 'mc', correctAnswer: null as unknown as string, needsReview: true, reviewReason: 'изборите не одговараат на премисата' });
    recordMcSpacedReview('u1', q, 'А');
    expect(recordMaturaSpacedReview).not.toHaveBeenCalled();
  });

  it('records a correct MC answer normally for a non-voided question', () => {
    const q = makeQ({ part: 1, questionType: 'mc', correctAnswer: 'А', points: 1 });
    recordMcSpacedReview('u1', q, 'А');
    expect(recordMaturaSpacedReview).toHaveBeenCalledWith('u1', 'exam-1', 5, 100);
  });

  it('records an incorrect MC answer as 0%', () => {
    const q = makeQ({ part: 1, questionType: 'mc', correctAnswer: 'А', points: 1 });
    recordMcSpacedReview('u1', q, 'Б');
    expect(recordMaturaSpacedReview).toHaveBeenCalledWith('u1', 'exam-1', 5, 0);
  });

  it('does nothing without a uid', () => {
    const q = makeQ({ part: 1, questionType: 'mc', correctAnswer: 'А' });
    recordMcSpacedReview(undefined, q, 'А');
    expect(recordMaturaSpacedReview).not.toHaveBeenCalled();
  });
});
