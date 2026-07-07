/**
 * Tests for views/maturaSimulation/maturaSimUtils.ts's gradePart2/gradePart3 and
 * splitTwoPartAnswer helper. Grading (including the CAS pre-gate) now happens
 * server-side via /api/matura-grade (see that file's header comment for why) — these
 * tests mock fetch + getAuthToken to drive the cache-check → server-call pipeline.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/gemini/core', () => ({
  getAuthToken: vi.fn(async () => 'test-token'),
}));

vi.mock('../../services/firestoreService.matura', async () => {
  const actual = await vi.importActual<typeof import('../../services/firestoreService.matura')>(
    '../../services/firestoreService.matura',
  );
  return { ...actual, getCachedAIGrade: vi.fn() };
});

import { getCachedAIGrade, type MaturaQuestion } from '../../services/firestoreService.matura';
import { gradePart2, gradePart3, splitTwoPartAnswer } from './maturaSimUtils';

function makeQ(over: Partial<MaturaQuestion> = {}): MaturaQuestion {
  return {
    examId: 'exam-1', year: 2024, session: 'june', language: 'mk',
    questionNumber: 3, part: 2, points: 2, questionType: 'open',
    questionText: 'Реши го системот', correctAnswer: 'A. 96, B. 10',
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

describe('splitTwoPartAnswer', () => {
  it('splits "A. x, B. y" format', () => {
    expect(splitTwoPartAnswer('A. 96, B. 10')).toEqual({ a: '96', b: '10' });
  });

  it('splits Cyrillic "А: x, Б: y" format', () => {
    expect(splitTwoPartAnswer('А: 2x+1, Б: x-3')).toEqual({ a: '2x+1', b: 'x-3' });
  });

  it('returns null for a format it does not recognize', () => {
    expect(splitTwoPartAnswer('96 and 10')).toBeNull();
    expect(splitTwoPartAnswer('')).toBeNull();
  });
});

describe('gradePart2 (two-part)', () => {
  it('returns cached result without calling the server', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 3, inputHash: 'k', score: 2, maxPoints: 2, feedback: 'cached',
    });
    const restore = mockServerGrade({});
    try {
      const out = await gradePart2(makeQ(), '96', '10');
      expect(out).toEqual({ score: 2, maxScore: 2, feedback: 'cached' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally { restore(); }
  });

  it('calls /api/matura-grade in sim-part2 mode and returns its result', async () => {
    const restore = mockServerGrade({ score: 2, maxScore: 2, partA: true, partB: true, feedback: 'добро', verifiedByCas: true });
    try {
      const out = await gradePart2(makeQ(), '96', '10');
      expect(out.score).toBe(2);
      expect(out.partA).toBe(true);
      expect(out.partB).toBe(true);
      expect(out.verifiedByCas).toBe(true);
      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
      const sentBody = JSON.parse((init as RequestInit).body as string);
      expect(sentBody.mode).toBe('sim-part2');
      expect(sentBody.answer).toBe('96');
      expect(sentBody.answerB).toBe('10');
    } finally { restore(); }
  });

  it('throws when the server responds with a non-OK status', async () => {
    const restore = mockServerGrade({}, false);
    try {
      await expect(gradePart2(makeQ(), '96', 'wrong')).rejects.toThrow('Grading failed');
    } finally { restore(); }
  });
});

describe('gradePart3', () => {
  it('returns cached result without calling the server', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 3, inputHash: 'k', score: 4, maxPoints: 4, feedback: 'cached',
    });
    const restore = mockServerGrade({});
    try {
      const out = await gradePart3(makeQ({ points: 4 }), 'опис на решение');
      expect(out).toEqual({ score: 4, maxScore: 4, feedback: 'cached' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally { restore(); }
  });

  it('calls /api/matura-grade in part3 mode and returns its result', async () => {
    const restore = mockServerGrade({ score: 3, maxScore: 4, feedback: 'добро' });
    try {
      const out = await gradePart3(makeQ({ points: 4 }), 'опис на решение');
      expect(out.score).toBe(3);
      expect(out.maxScore).toBe(4);
      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
      const sentBody = JSON.parse((init as RequestInit).body as string);
      expect(sentBody.mode).toBe('part3');
    } finally { restore(); }
  });
});
