/**
 * Tests for duggaResultsScoring.ts's isAnswerCorrect() — the independent recompute used
 * in the teacher-facing results/analytics panel. Must stay consistent with
 * utils/duggaScoring.ts's autoScore for fill_blanks/short_answer, since both grade the
 * same submissions and disagreeing would confuse teachers.
 */
import { describe, it, expect } from 'vitest';
import { isAnswerCorrect } from './duggaResultsScoring';
import type { DuggaQuestion } from '../../services/firestoreService.dugga';

function makeQ(over: Partial<DuggaQuestion> = {}): DuggaQuestion {
  return {
    id: 'q1', text: 'Test?', dok: 1, points: 4,
    type: 'fill_blanks',
    ...over,
  } as DuggaQuestion;
}

describe('isAnswerCorrect — fill_blanks CAS fallback (consistency with autoScore)', () => {
  it('accepts a literal match', () => {
    expect(isAnswerCorrect(makeQ({ correctAnswer: '2+2x' }), '2+2x')).toBe(true);
  });

  it('accepts a differently-written but equivalent answer via CAS', () => {
    expect(isAnswerCorrect(makeQ({ correctAnswer: '2+2x' }), '2x+2')).toBe(true);
  });

  it('rejects a genuinely different answer', () => {
    expect(isAnswerCorrect(makeQ({ correctAnswer: 'x=5' }), 'x=4')).toBe(false);
  });

  it('returns false rather than throwing when correctAnswer is missing', () => {
    expect(isAnswerCorrect(makeQ({ correctAnswer: undefined }), 'anything')).toBe(false);
  });
});

describe('isAnswerCorrect — other objective types unchanged', () => {
  it('multiple_choice: exact match against correctAnswer/option id', () => {
    const q = makeQ({ type: 'multiple_choice', correctAnswer: 'opt1' });
    expect(isAnswerCorrect(q, 'opt1')).toBe(true);
    expect(isAnswerCorrect(q, 'opt2')).toBe(false);
  });

  it('checklist: order-independent set match', () => {
    const q = makeQ({ type: 'checklist', options: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: true },
      { id: 'c', text: 'C', isCorrect: false },
    ] });
    expect(isAnswerCorrect(q, ['b', 'a'])).toBe(true);
    expect(isAnswerCorrect(q, ['a'])).toBe(false);
  });

  it('returns null for non-objective types (needs AI/manual grading)', () => {
    expect(isAnswerCorrect(makeQ({ type: 'essay' }), 'some text')).toBeNull();
  });

  it('returns false for undefined/null answers', () => {
    expect(isAnswerCorrect(makeQ(), undefined)).toBe(false);
  });
});
