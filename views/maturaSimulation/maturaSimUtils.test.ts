/**
 * Tests for views/maturaSimulation/maturaSimUtils.ts's gradePart2 CAS pre-gate and
 * splitTwoPartAnswer helper. Mirrors views/maturaPractice/maturaPracticeGrading.test.ts's
 * mocking strategy.
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
  return { ...actual, getCachedAIGrade: vi.fn(), saveAIGrade: vi.fn() };
});

vi.mock('../../services/casVerificationClient', () => ({
  verifyExpressionEquivalenceRemote: vi.fn(),
}));

import { callGeminiProxy } from '../../services/gemini/core';
import { getCachedAIGrade, saveAIGrade, type MaturaQuestion } from '../../services/firestoreService.matura';
import { verifyExpressionEquivalenceRemote } from '../../services/casVerificationClient';
import { gradePart2, splitTwoPartAnswer } from './maturaSimUtils';

function makeQ(over: Partial<MaturaQuestion> = {}): MaturaQuestion {
  return {
    examId: 'exam-1', year: 2024, session: 'june', language: 'mk',
    questionNumber: 3, part: 2, points: 2, questionType: 'open',
    questionText: 'Реши го системот', correctAnswer: 'A. 96, B. 10',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedAIGrade).mockResolvedValue(null);
  vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'inconclusive' });
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

describe('gradePart2 (two-part) — CAS pre-gate', () => {
  it('awards full 2/2 credit and skips Gemini when both parts are CAS-confirmed', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote)
      .mockResolvedValueOnce({ verdict: 'equivalent' })
      .mockResolvedValueOnce({ verdict: 'equivalent' });
    const out = await gradePart2(makeQ(), '96', '10');
    expect(out.score).toBe(2);
    expect(out.partA).toBe(true);
    expect(out.partB).toBe(true);
    expect(out.verifiedByCas).toBe(true);
    expect(callGeminiProxy).not.toHaveBeenCalled();
    expect(saveAIGrade).toHaveBeenCalled();
  });

  it('falls through to Gemini when only one part is CAS-confirmed', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote)
      .mockResolvedValueOnce({ verdict: 'equivalent' })
      .mockResolvedValueOnce({ verdict: 'not_equivalent' });
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":1,"partA":true,"partB":false,"feedback":"делумно"}',
    } as any);
    const out = await gradePart2(makeQ(), '96', 'wrong');
    expect(callGeminiProxy).toHaveBeenCalled();
    expect(out.score).toBe(1);
    expect(out.verifiedByCas).toBeUndefined();
  });

  it('falls through to Gemini when correctAnswer is not in a splittable format', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":2,"partA":true,"partB":true,"feedback":"добро"}',
    } as any);
    const out = await gradePart2(makeQ({ correctAnswer: '96 and 10' }), '96', '10');
    expect(verifyExpressionEquivalenceRemote).not.toHaveBeenCalled();
    expect(callGeminiProxy).toHaveBeenCalled();
    expect(out.score).toBe(2);
  });

  it('returns cached result without calling Gemini or CAS', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 3, inputHash: 'k', score: 2, maxPoints: 2, feedback: 'cached',
    });
    const out = await gradePart2(makeQ(), '96', '10');
    expect(out).toEqual({ score: 2, maxScore: 2, feedback: 'cached' });
    expect(callGeminiProxy).not.toHaveBeenCalled();
    expect(verifyExpressionEquivalenceRemote).not.toHaveBeenCalled();
  });
});
