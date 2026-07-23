import { describe, it, expect } from 'vitest';
import { applyManualGradeOverride, gradeMultipleChoiceDeterministic } from './examGrading';
import type { ExamQuestion } from '../services/firestoreService.types';

describe('applyManualGradeOverride', () => {
  const feedback = [
    { questionId: 'q1', correct: true, points: 5, feedback: 'Точно.' },
    { questionId: 'q2', correct: false, points: 0, feedback: 'Неточно.' },
    { questionId: 'q3', correct: true, points: 3, feedback: 'Делумно точно.' },
  ];

  it('overrides only the targeted question\'s points and stamps who overrode it', () => {
    const { feedback: updated } = applyManualGradeOverride(feedback, 'q2', 4, 'teacher-uid');
    const q2 = updated.find(f => f.questionId === 'q2')!;
    expect(q2.points).toBe(4);
    expect(q2.manuallyOverriddenBy).toBe('teacher-uid');
    // Untouched entries stay exactly as they were.
    expect(updated.find(f => f.questionId === 'q1')).toEqual(feedback[0]);
    expect(updated.find(f => f.questionId === 'q3')).toEqual(feedback[2]);
  });

  it('does not touch the `correct` flag — points alone don\'t reliably imply full/partial correctness', () => {
    const { feedback: updated } = applyManualGradeOverride(feedback, 'q2', 4, 'teacher-uid');
    expect(updated.find(f => f.questionId === 'q2')!.correct).toBe(false);
  });

  it('recomputes the total score as the sum of all (possibly overridden) points', () => {
    const { score } = applyManualGradeOverride(feedback, 'q2', 4, 'teacher-uid');
    expect(score).toBe(5 + 4 + 3);
  });

  it('re-overriding the same question again just replaces the previous override', () => {
    const first = applyManualGradeOverride(feedback, 'q1', 2, 'teacher-uid');
    const second = applyManualGradeOverride(first.feedback, 'q1', 5, 'teacher-uid');
    expect(second.feedback.find(f => f.questionId === 'q1')!.points).toBe(5);
    expect(second.score).toBe(5 + 0 + 3);
  });
});

describe('gradeMultipleChoiceDeterministic', () => {
  const mc = (id: string, answer: string, points = 1, options?: string[]): ExamQuestion => ({
    id, type: 'multiple_choice', question: 'Q', answer, points, options,
  });
  const openQ = (id: string, type: ExamQuestion['type'], points = 2): ExamQuestion => ({
    id, type, question: 'Q', answer: 'A', points,
  });

  it('grades a correct MC answer with full points', () => {
    const { mcFeedback, needsAi } = gradeMultipleChoiceDeterministic(
      [mc('q1', 'x = 5', 2, ['x = 5', 'x = 3'])],
      { q0: 'x = 5' },
    );
    expect(needsAi).toHaveLength(0);
    expect(mcFeedback[0]).toMatchObject({ questionId: 'q1', correct: true, points: 2 });
  });

  it('grades a wrong MC answer with zero points and reveals the correct answer', () => {
    const { mcFeedback } = gradeMultipleChoiceDeterministic([mc('q1', 'x = 5')], { q0: 'x = 3' });
    expect(mcFeedback[0].correct).toBe(false);
    expect(mcFeedback[0].points).toBe(0);
    expect(mcFeedback[0].feedback).toContain('x = 5');
  });

  it('treats an empty MC answer as wrong', () => {
    const { mcFeedback } = gradeMultipleChoiceDeterministic([mc('q1', 'x = 5')], {});
    expect(mcFeedback[0].correct).toBe(false);
    expect(mcFeedback[0].points).toBe(0);
  });

  it('normalizes case and whitespace when comparing', () => {
    const { mcFeedback } = gradeMultipleChoiceDeterministic([mc('q1', 'X =  5')], { q0: ' x = 5 ' });
    expect(mcFeedback[0].correct).toBe(true);
  });

  it('routes non-MC questions to the AI bucket untouched, in order', () => {
    const questions = [mc('q1', 'a'), openQ('q2', 'essay'), openQ('q3', 'calculation')];
    const { mcFeedback, needsAi } = gradeMultipleChoiceDeterministic(questions, { q0: 'a' });
    expect(mcFeedback).toHaveLength(1);
    expect(needsAi.map(q => q.id)).toEqual(['q2', 'q3']);
  });
});
