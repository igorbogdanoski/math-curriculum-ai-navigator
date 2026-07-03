import { useState, useRef, useCallback } from 'react';
import { normalizeLabAnswer, type LabExercise } from '../types/labTypes';
import { logger } from '../utils/logger';

export type { LabExercise };

interface UseLabSessionReturn {
  // State
  exercises: LabExercise[];
  currentIdx: number;
  currentEx: LabExercise | null;
  userAnswer: string;
  submitted: boolean;
  correct: boolean | null;
  showHint: boolean;
  hintsUsed: number;
  score: number;
  sessionDone: boolean;
  saving: boolean;
  saveError: boolean;
  difficultyStreak: { correct: number; wrong: number };
  correctHistory: boolean[];
  // Actions
  setUserAnswer: (v: string) => void;
  loadExercises: (exs: LabExercise[]) => void;
  submitAnswer: () => void;
  useHint: () => void;
  nextExercise: () => void;
  resetSession: () => void;
  saveSession: (studentName: string) => Promise<void>;
}

export function useLabSession(labId: string, labTitle: string): UseLabSessionReturn {
  const [exercises,   setExercises]   = useState<LabExercise[]>([]);
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [userAnswer,  setUserAnswer]  = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [correct,     setCorrect]     = useState<boolean | null>(null);
  const [showHint,    setShowHint]    = useState(false);
  const [hintsUsed,   setHintsUsed]   = useState(0);
  const [score,       setScore]       = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState(false);
  const [difficultyStreak, setDifficultyStreak] = useState({ correct: 0, wrong: 0 });
  const [correctHistory, setCorrectHistory] = useState<boolean[]>([]);

  const startedAt = useRef<number>(Date.now());

  const currentEx = exercises[currentIdx] ?? null;

  const loadExercises = useCallback((exs: LabExercise[]) => {
    setExercises(exs);
    setCurrentIdx(0);
    setScore(0);
    setHintsUsed(0);
    setSessionDone(false);
    setSubmitted(false);
    setCorrect(null);
    setUserAnswer('');
    setShowHint(false);
    setDifficultyStreak({ correct: 0, wrong: 0 });
    setCorrectHistory([]);
    startedAt.current = Date.now();
  }, []);

  const submitAnswer = useCallback(() => {
    if (!currentEx || submitted) return;
    const isCorrect = normalizeLabAnswer(userAnswer, currentEx.correctAnswer);
    setCorrect(isCorrect);
    setSubmitted(true);
    setShowHint(false);
    setCorrectHistory(h => [...h, isCorrect]);
    if (isCorrect) {
      setScore(s => s + 1);
      setDifficultyStreak(d => ({ correct: d.correct + 1, wrong: 0 }));
    } else {
      setDifficultyStreak(d => ({ correct: 0, wrong: d.wrong + 1 }));
    }
  }, [currentEx, submitted, userAnswer]);

  const useHint = useCallback(() => {
    if (submitted || showHint) return;
    setShowHint(true);
    setHintsUsed(h => h + 1);
  }, [submitted, showHint]);

  const nextExercise = useCallback(() => {
    if (currentIdx + 1 >= exercises.length) {
      setSessionDone(true);
    } else {
      setCurrentIdx(i => i + 1);
      setUserAnswer('');
      setSubmitted(false);
      setCorrect(null);
      setShowHint(false);
    }
  }, [currentIdx, exercises.length]);

  const resetSession = useCallback(() => {
    loadExercises(exercises);
  }, [loadExercises, exercises]);

  const saveSession = useCallback(async (studentName: string) => {
    if (!studentName.trim() || saving || exercises.length === 0) return;
    setSaving(true);
    setSaveError(false);
    try {
      const pct = Math.round((score / exercises.length) * 100);
      const duration = Math.round((Date.now() - startedAt.current) / 1000);
      const { firestoreService } = await import('../services/firestoreService');
      await firestoreService.saveQuizResult({
        quizId:          `lab_${labId}_${Date.now()}`,
        quizTitle:       `Лабораторија: ${labTitle}`,
        quizType:        'lab',
        conceptId:       labId,
        studentName:     studentName.trim(),
        score,
        correctCount:    score,
        totalQuestions:  exercises.length,
        percentage:      pct,
        hintsUsed,
        durationSeconds: duration,
      });
      try { localStorage.setItem('studentName', studentName.trim()); } catch { /* incognito */ }
    } catch (err) {
      logger.error('[Lab] saveSession failed:', err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [saving, exercises.length, score, labId, labTitle, hintsUsed]);

  return {
    exercises, currentIdx, currentEx,
    userAnswer, submitted, correct, showHint, hintsUsed, score, sessionDone, saving, saveError,
    difficultyStreak, correctHistory,
    setUserAnswer, loadExercises, submitAnswer, useHint, nextExercise, resetSession, saveSession,
  };
}
