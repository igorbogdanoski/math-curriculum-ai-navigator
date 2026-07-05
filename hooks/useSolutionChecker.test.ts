import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSolutionChecker } from './useSolutionChecker';
import { geminiService } from '../services/geminiService';
import { verifyExpressionEquivalenceRemote } from '../services/casVerificationClient';

vi.mock('../services/geminiService', () => ({
  geminiService: {
    solveSpecificProblemStepByStep: vi.fn(),
    diagnoseMisconception: vi.fn(),
  },
}));
vi.mock('../services/casVerificationClient', () => ({
  verifyExpressionEquivalenceRemote: vi.fn(),
}));

const solved = {
  problem: '2x + 5 = 13',
  strategy: 'Изолирај го x',
  steps: [
    { explanation: 'Одземи 5', expression: '2x = 8' },
    { explanation: 'Подели со 2', expression: 'x = 4' },
  ],
};

describe('useSolutionChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(geminiService.solveSpecificProblemStepByStep).mockResolvedValue(solved);
  });

  it('does nothing when the problem or answer is blank', async () => {
    const { result } = renderHook(() => useSolutionChecker());
    await act(async () => { await result.current.check('', 'x = 4'); });
    expect(geminiService.solveSpecificProblemStepByStep).not.toHaveBeenCalled();
    expect(result.current.result).toBeNull();
  });

  it('reports correct + verifiedByCas when CAS finds the answer equivalent', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'equivalent' });
    const { result } = renderHook(() => useSolutionChecker());

    await act(async () => { await result.current.check('2x + 5 = 13', 'x = 4'); });

    expect(result.current.result?.status).toBe('correct');
    expect(result.current.result?.verifiedByCas).toBe(true);
    expect(result.current.result?.correctAnswer).toBe('x = 4');
    expect(geminiService.diagnoseMisconception).not.toHaveBeenCalled();
  });

  it('reports incorrect and asks for a misconception diagnosis when CAS finds a mismatch', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'not_equivalent' });
    vi.mocked(geminiService.diagnoseMisconception).mockResolvedValue('Заборавил да подели со 2.');
    const { result } = renderHook(() => useSolutionChecker());

    await act(async () => { await result.current.check('2x + 5 = 13', 'x = 8'); });

    expect(result.current.result?.status).toBe('incorrect');
    expect(result.current.result?.verifiedByCas).toBe(false);
    expect(result.current.result?.hint).toBe('Заборавил да подели со 2.');
    expect(geminiService.diagnoseMisconception).toHaveBeenCalledWith('2x + 5 = 13', 'x = 4', 'x = 8');
  });

  it('reports inconclusive without diagnosing a misconception when CAS cannot parse the answer', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'inconclusive', detail: 'parse_error:a' });
    const { result } = renderHook(() => useSolutionChecker());

    await act(async () => { await result.current.check('2x + 5 = 13', 'четири') ; });

    expect(result.current.result?.status).toBe('inconclusive');
    expect(result.current.result?.correctAnswer).toBe('x = 4');
    expect(geminiService.diagnoseMisconception).not.toHaveBeenCalled();
  });

  it('surfaces a friendly error and clears loading when the solver call throws', async () => {
    vi.mocked(geminiService.solveSpecificProblemStepByStep).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useSolutionChecker());

    await act(async () => { await result.current.check('2x + 5 = 13', 'x = 4'); });

    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('reset clears a prior result and error', async () => {
    vi.mocked(verifyExpressionEquivalenceRemote).mockResolvedValue({ verdict: 'equivalent' });
    const { result } = renderHook(() => useSolutionChecker());
    await act(async () => { await result.current.check('2x + 5 = 13', 'x = 4'); });
    expect(result.current.result).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
