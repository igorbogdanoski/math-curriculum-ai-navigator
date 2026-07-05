/**
 * Tests for components/matura/maturaLibrary.constants.ts's gradePart2 CAS pre-gate.
 * Mirrors views/maturaPractice/maturaPracticeGrading.test.ts's mocking strategy.
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
import { getCachedAIGrade, saveAIGrade } from '../../services/firestoreService.matura';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import { verifyExpressionEquivalenceRemote } from '../../services/casVerificationClient';
import { gradePart2 } from './maturaLibrary.constants';

function makeQ(over: Partial<MaturaQuestion> = {}): MaturaQuestion {
  return {
    examId: 'exam-1', year: 2024, session: 'june', language: 'mk',
    questionNumber: 5, part: 2, points: 4, questionType: 'open',
    questionText: 'Реши x² - 4 = 0', correctAnswer: '2+2x',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedAIGrade).mockResolvedValue(null);
  vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'inconclusive' });
});

describe('gradePart2 (Matura Library) — CAS pre-gate', () => {
  it('skips Gemini and awards full credit when CAS confirms equivalence', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValueOnce({ verdict: 'equivalent' });
    const out = await gradePart2(makeQ({ points: 4 }), '2x+2');
    expect(out.score).toBe(4);
    expect(out.correct).toBe(true);
    expect(out.verifiedByCas).toBe(true);
    expect(callGeminiProxy).not.toHaveBeenCalled();
    expect(saveAIGrade).toHaveBeenCalled();
  });

  it('falls through to Gemini unchanged when CAS says not_equivalent', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValueOnce({ verdict: 'not_equivalent' });
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":0,"correct":false,"feedback":"погрешно"}',
    } as any);
    const out = await gradePart2(makeQ(), 'wrong');
    expect(callGeminiProxy).toHaveBeenCalled();
    expect(out.verifiedByCas).toBeUndefined();
  });

  it('falls through to Gemini unchanged when CAS is inconclusive', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":2,"correct":false,"feedback":"делумно"}',
    } as any);
    const out = await gradePart2(makeQ(), 'some prose answer');
    expect(callGeminiProxy).toHaveBeenCalled();
    expect(out.score).toBe(2);
  });

  it('never attempts CAS when the question has no stored correctAnswer', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValueOnce({
      text: '{"score":1,"correct":false,"feedback":"x"}',
    } as any);
    await gradePart2(makeQ({ correctAnswer: undefined as unknown as string }), 'an answer');
    expect(verifyExpressionEquivalenceRemote).not.toHaveBeenCalled();
  });

  it('returns cached result without calling Gemini or CAS', async () => {
    vi.mocked(getCachedAIGrade).mockResolvedValueOnce({
      examId: 'exam-1', questionNumber: 5, inputHash: 'k', score: 3, maxPoints: 4, feedback: 'cached',
    });
    const out = await gradePart2(makeQ(), 'x = 2');
    expect(out).toEqual({ score: 3, maxScore: 4, feedback: 'cached' });
    expect(callGeminiProxy).not.toHaveBeenCalled();
    expect(verifyExpressionEquivalenceRemote).not.toHaveBeenCalled();
  });
});
