import { describe, it, expect } from 'vitest';
import { verifyDeterministicQuestions, type VerifQuestion } from './duggaVerification';

describe('verifyDeterministicQuestions', () => {
  it('matches a correct multiple_choice + true_false submission', () => {
    const questions: VerifQuestion[] = [
      { id: 'q1', type: 'multiple_choice', points: 5, options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B' }] },
      { id: 'q2', type: 'true_false', points: 3, correctAnswer: 'точно' },
    ];
    const result = verifyDeterministicQuestions(questions, { q1: 'a', q2: 'Точно' });
    expect(result.verifiedEarned).toBe(8);
    expect(result.verifiedMax).toBe(8);
    expect(result.unverifiedQuestionIds).toEqual([]);
  });

  it('catches a fabricated 100% on a multiple_choice question the student actually got wrong', () => {
    const questions: VerifQuestion[] = [
      { id: 'q1', type: 'multiple_choice', points: 10, options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B' }] },
    ];
    // Student actually selected the wrong option "b" — server recomputes 0, regardless
    // of whatever score/percentage the client submitted alongside this.
    const result = verifyDeterministicQuestions(questions, { q1: 'b' });
    expect(result.verifiedEarned).toBe(0);
    expect(result.verifiedMax).toBe(10);
  });

  it('catches the duplicate-id checklist exploit (fixed client-side earlier — verified here too)', () => {
    const questions: VerifQuestion[] = [
      { id: 'q1', type: 'checklist', points: 10, options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: true }] },
    ];
    const result = verifyDeterministicQuestions(questions, { q1: 'a,a' });
    expect(result.verifiedEarned).toBeLessThan(10);
  });

  it('lists CAS-dependent/complex-grader question types as unverified rather than guessing', () => {
    const questions: VerifQuestion[] = [
      { id: 'q1', type: 'fill_blanks', points: 5, correctAnswer: '2x+2' },
      { id: 'q2', type: 'student_chart', points: 5 },
    ];
    const result = verifyDeterministicQuestions(questions, { q1: '2+2x', q2: '{}' });
    expect(result.unverifiedQuestionIds).toEqual(['q1', 'q2']);
    expect(result.verifiedMax).toBe(0);
  });

  it('handles ordering, multi_match, and list_items', () => {
    const questions: VerifQuestion[] = [
      { id: 'q1', type: 'ordering', points: 4, orderItems: ['first', 'second', 'third'] },
      { id: 'q2', type: 'multi_match', points: 4, matchPairs: [{ left: 'x', right: 'y' }] },
      { id: 'q3', type: 'list_items', points: 4, correctAnswer: 'apple, banana' },
    ];
    const result = verifyDeterministicQuestions(questions, {
      q1: 'first|second|third',
      q2: JSON.stringify({ x: 'y' }),
      q3: JSON.stringify(['apple', 'banana']),
    });
    expect(result.verifiedEarned).toBe(12);
    expect(result.verifiedMax).toBe(12);
  });
});
