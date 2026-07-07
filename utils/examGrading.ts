import type { ExamResponse } from '../services/firestoreService.types';

type AiFeedback = NonNullable<ExamResponse['aiFeedback']>;

/**
 * Applies a teacher's manual point override to one question's AI-graded feedback entry
 * and recomputes the response's total score. Digital Exam grades EVERY question type
 * (even multiple-choice) via a single LLM call with no deterministic cross-check and,
 * until this, no way for a teacher to correct a wrong AI-assigned score. `correct` is
 * deliberately left untouched here — points alone don't reliably imply full/partial
 * correctness for essay-style questions, so we don't infer it.
 */
export function applyManualGradeOverride(
  feedback: AiFeedback,
  questionId: string,
  points: number,
  graderUid: string,
): { feedback: AiFeedback; score: number } {
  const updated = feedback.map(f => f.questionId === questionId
    ? { ...f, points, manuallyOverriddenBy: graderUid }
    : f);
  const score = updated.reduce((s, f) => s + f.points, 0);
  return { feedback: updated, score };
}
