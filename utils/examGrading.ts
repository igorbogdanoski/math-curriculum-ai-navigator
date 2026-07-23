import type { ExamResponse, ExamQuestion } from '../services/firestoreService.types';

type AiFeedback = NonNullable<ExamResponse['aiFeedback']>;

type FeedbackEntry = { questionId: string; correct: boolean; points: number; feedback: string };

function normalizeMc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Deterministically grade the multiple-choice questions of an exam response by exact
 * (normalized) match against each question's correct answer, and return the non-MC
 * questions that still need LLM grading. MC answers are stored as the full selected
 * option text (ExamVariantPlayer stores `opt`) and `q.answer` is the correct option text,
 * so an exact match is a reliable grade. Digital Exam previously sent EVERY question —
 * even MC — to one LLM call, which occasionally misgraded MC; this removes that error
 * class and reserves the LLM for short_answer / essay / calculation.
 */
export function gradeMultipleChoiceDeterministic(
  questions: ExamQuestion[],
  answers: Record<string, string>,
): { mcFeedback: FeedbackEntry[]; needsAi: ExamQuestion[] } {
  const mcFeedback: FeedbackEntry[] = [];
  const needsAi: ExamQuestion[] = [];
  questions.forEach((q, i) => {
    if (q.type !== 'multiple_choice') {
      needsAi.push(q);
      return;
    }
    const student = normalizeMc(answers[`q${i}`] ?? '');
    const correct = normalizeMc(q.answer ?? '');
    const isCorrect = student !== '' && student === correct;
    mcFeedback.push({
      questionId: q.id,
      correct: isCorrect,
      points: isCorrect ? q.points : 0,
      feedback: isCorrect ? 'Точен одговор.' : `Точниот одговор е: ${q.answer}.`,
    });
  });
  return { mcFeedback, needsAi };
}

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
