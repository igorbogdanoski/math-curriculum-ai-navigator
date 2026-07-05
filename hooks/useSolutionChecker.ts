import { useState, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { verifyExpressionEquivalenceRemote } from '../services/casVerificationClient';

export interface SolverStepResult {
  explanation: string;
  expression: string;
}

export type SolutionCheckStatus = 'correct' | 'incorrect' | 'inconclusive';

export interface SolutionCheckResult {
  status: SolutionCheckStatus;
  /** True only when the 'correct' verdict came from CAS symbolic comparison, not AI judgment. */
  verifiedByCas: boolean;
  hint: string;
  correctAnswer: string;
  steps: SolverStepResult[];
  strategy?: string;
}

/**
 * "Провери го решението" — lets a student check a final answer they already
 * worked out themselves, instead of asking the tutor to solve the problem for
 * them. Reuses two already-shipped, already-tested building blocks rather than
 * a new solver: geminiService.solveSpecificProblemStepByStep derives the
 * canonical solution internally (same call StepByStepSolver's callers already
 * make), and verifyExpressionEquivalenceRemote (the CAS engine already wired
 * into Dugga/Matura grading) compares the student's typed answer against the
 * last step's expression. The full step-by-step walkthrough is fetched either
 * way but only ever shown if the caller explicitly reveals it — checking an
 * answer never auto-discloses the solving method.
 */
export function useSolutionChecker() {
  const [result, setResult] = useState<SolutionCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (problemText: string, studentAnswer: string) => {
    if (!problemText.trim() || !studentAnswer.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const solved = await geminiService.solveSpecificProblemStepByStep(problemText);
      const steps = solved.steps ?? [];
      const correctAnswer = steps[steps.length - 1]?.expression ?? '';

      const cas = correctAnswer
        ? await verifyExpressionEquivalenceRemote(studentAnswer, correctAnswer)
        : { verdict: 'inconclusive' as const };

      if (cas.verdict === 'equivalent') {
        setResult({
          status: 'correct',
          verifiedByCas: true,
          hint: 'Твојот одговор е математички еквивалентен на точното решение.',
          correctAnswer,
          steps,
          strategy: solved.strategy,
        });
        return;
      }

      if (cas.verdict === 'not_equivalent') {
        // Confident mismatch — worth a real diagnosis of what likely went wrong.
        const diagnosis = await geminiService.diagnoseMisconception(problemText, correctAnswer, studentAnswer);
        setResult({
          status: 'incorrect',
          verifiedByCas: false,
          hint: diagnosis,
          correctAnswer,
          steps,
          strategy: solved.strategy,
        });
        return;
      }

      // CAS couldn't parse one side (e.g. a non-symbolic answer like "5 метри") —
      // we genuinely don't know if it's right, so we say so rather than guessing
      // or diagnosing an error that may not exist.
      setResult({
        status: 'inconclusive',
        verifiedByCas: false,
        hint: 'Не можев автоматски да го споредам форматот на твојот одговор. Спореди го рачно со точното решение подолу.',
        correctAnswer,
        steps,
        strategy: solved.strategy,
      });
    } catch {
      setError('Не успеав да го проверам решението. Обиди се повторно.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { check, result, loading, error, reset };
}
