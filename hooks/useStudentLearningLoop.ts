import { useState, useEffect, useCallback } from 'react';
import { tutorAPI } from '../services/gemini/tutor';
import { isDailyQuotaKnownExhausted } from '../services/geminiService';
import type { QuizResult } from '../components/student/quizSessionReducer';

export type LoopPhase = 'idle' | 'loading' | 'explaining' | 'next-step';

export interface LoopExplanation {
  steps: [string, string, string];
  commonMistake: string;
}

interface UseStudentLearningLoopParams {
  quizResult: QuizResult | null;
  conceptTitle: string;
  gradeLevel: number;
}

/**
 * Orchestrates the post-quiz learning loop for scores < 70%.
 * Automatically fetches a 3-step misconception explanation from AI
 * and guides the student through it step by step.
 */
export function useStudentLearningLoop({
  quizResult,
  conceptTitle,
  gradeLevel,
}: UseStudentLearningLoopParams) {
  const [phase, setPhase] = useState<LoopPhase>('idle');
  const [explanation, setExplanation] = useState<LoopExplanation | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const failed = quizResult !== null && quizResult.percentage < 70;
  const topMisconception = quizResult?.misconceptions?.[0];

  useEffect(() => {
    if (!failed || !topMisconception || phase !== 'idle') return;

    if (isDailyQuotaKnownExhausted() || !topMisconception.misconception) {
      setPhase('next-step');
      return;
    }

    setPhase('loading');
    setStepIndex(0);

    tutorAPI
      .explainMisconception(conceptTitle, topMisconception.misconception, gradeLevel)
      .then(result => {
        setExplanation(result);
        setPhase('explaining');
      })
      .catch(() => {
        setPhase('next-step');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizResult]);

  const advanceStep = useCallback(() => {
    if (stepIndex < 2) {
      setStepIndex(s => s + 1);
    } else {
      setPhase('next-step');
    }
  }, [stepIndex]);

  return { phase, explanation, stepIndex, advanceStep };
}
