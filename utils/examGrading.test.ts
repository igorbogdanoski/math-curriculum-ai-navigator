import { describe, it, expect } from 'vitest';
import { applyManualGradeOverride } from './examGrading';

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
