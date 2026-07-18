import { describe, it, expect } from 'vitest';
import {
  simplifyFraction, toDecimal, fractionToString, compareFractions, addFractions,
  subtractFractions, multiplyFractions, divideFractions, toPercent, fractionFromPercent,
  toMixedNumber, fromMixedNumber, generateFractionsSet,
  GRADE_CONFIGS, type Fraction, type FractionGradeRange,
} from './fractionsMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('simplifyFraction', () => {
  it('reduces to lowest terms', () => {
    expect(simplifyFraction({ num: 4, den: 8 })).toEqual({ num: 1, den: 2 });
    expect(simplifyFraction({ num: 6, den: 9 })).toEqual({ num: 2, den: 3 });
  });

  it('leaves an already-simplified fraction unchanged', () => {
    expect(simplifyFraction({ num: 3, den: 4 })).toEqual({ num: 3, den: 4 });
  });

  it('reduces zero to 0/1', () => {
    expect(simplifyFraction({ num: 0, den: 5 })).toEqual({ num: 0, den: 1 });
  });
});

describe('toDecimal / fractionToString', () => {
  it('converts correctly', () => {
    expect(toDecimal({ num: 1, den: 4 })).toBe(0.25);
    expect(fractionToString({ num: 3, den: 4 })).toBe('3/4');
  });
});

describe('compareFractions', () => {
  it('detects less-than, greater-than, and equal (including cross-denominator equality)', () => {
    expect(compareFractions({ num: 1, den: 2 }, { num: 2, den: 3 })).toBe(-1);
    expect(compareFractions({ num: 3, den: 4 }, { num: 1, den: 2 })).toBe(1);
    expect(compareFractions({ num: 1, den: 2 }, { num: 2, den: 4 })).toBe(0);
  });
});

describe('addFractions', () => {
  it('adds same-denominator fractions', () => {
    expect(addFractions({ num: 1, den: 4 }, { num: 2, den: 4 })).toEqual({ num: 3, den: 4 });
  });

  it('adds different-denominator fractions and simplifies the result', () => {
    expect(addFractions({ num: 1, den: 2 }, { num: 1, den: 4 })).toEqual({ num: 3, den: 4 });
    // 1/2 + 1/2 = 1 → simplifies to 1/1
    expect(addFractions({ num: 1, den: 2 }, { num: 1, den: 2 })).toEqual({ num: 1, den: 1 });
  });
});

describe('subtractFractions', () => {
  it('subtracts same-denominator fractions', () => {
    expect(subtractFractions({ num: 3, den: 4 }, { num: 1, den: 4 })).toEqual({ num: 1, den: 2 });
  });

  it('subtracts different-denominator fractions and simplifies', () => {
    expect(subtractFractions({ num: 1, den: 2 }, { num: 1, den: 4 })).toEqual({ num: 1, den: 4 });
  });

  it('can produce a negative result (caller is responsible for a>=b in a teaching context)', () => {
    expect(subtractFractions({ num: 1, den: 4 }, { num: 1, den: 2 })).toEqual({ num: -1, den: 4 });
  });
});

describe('multiplyFractions', () => {
  it('multiplies numerators and denominators, then simplifies', () => {
    expect(multiplyFractions({ num: 1, den: 2 }, { num: 2, den: 3 })).toEqual({ num: 1, den: 3 });
  });

  it('multiplying by a whole-number-equivalent fraction works', () => {
    expect(multiplyFractions({ num: 3, den: 4 }, { num: 2, den: 1 })).toEqual({ num: 3, den: 2 });
  });
});

describe('divideFractions', () => {
  it('divides by multiplying by the reciprocal, then simplifies', () => {
    expect(divideFractions({ num: 1, den: 2 }, { num: 1, den: 4 })).toEqual({ num: 2, den: 1 });
  });

  it('dividing a fraction by itself gives 1/1', () => {
    expect(divideFractions({ num: 3, den: 5 }, { num: 3, den: 5 })).toEqual({ num: 1, den: 1 });
  });

  it('regression (audit_2026_07_18): dividing by a zero-numerator fraction returns null, not a bogus "num/0" result', () => {
    expect(divideFractions({ num: 1, den: 2 }, { num: 0, den: 4 })).toBeNull();
    expect(divideFractions({ num: 5, den: 1 }, { num: 0, den: 1 })).toBeNull();
  });
});

describe('toPercent / fractionFromPercent', () => {
  it('converts common fractions to whole-number percents', () => {
    expect(toPercent({ num: 1, den: 2 })).toBe(50);
    expect(toPercent({ num: 1, den: 4 })).toBe(25);
    expect(toPercent({ num: 3, den: 4 })).toBe(75);
  });

  it('round-trips a percent through fractionFromPercent', () => {
    expect(fractionFromPercent(50)).toEqual({ num: 1, den: 2 });
    expect(fractionFromPercent(25)).toEqual({ num: 1, den: 4 });
  });
});

describe('toMixedNumber / fromMixedNumber', () => {
  it('round-trips an improper fraction through mixed-number form', () => {
    const improper: Fraction = { num: 11, den: 4 };
    const mixed = toMixedNumber(improper);
    expect(mixed.whole).toBe(2);
    expect(mixed.remainder).toEqual({ num: 3, den: 4 });
    expect(fromMixedNumber(mixed.whole, mixed.remainder)).toEqual({ num: 11, den: 4 });
  });

  it('handles a proper fraction (whole part 0)', () => {
    const mixed = toMixedNumber({ num: 3, den: 4 });
    expect(mixed.whole).toBe(0);
    expect(mixed.remainder).toEqual({ num: 3, den: 4 });
  });
});

describe('generateFractionsSet', () => {
  const grades: FractionGradeRange[] = ['g3', 'g4', 'g5', 'g6'];
  const difficulties: (1 | 2 | 3)[] = [1, 2, 3];

  for (const grade of grades) {
    for (const difficulty of difficulties) {
      it(`generates ${grade} difficulty ${difficulty} exercises with valid, self-consistent shape`, () => {
        const exs = generateFractionsSet(grade, difficulty, 6);
        expect(exs).toHaveLength(6);

        const ids = new Set(exs.map(e => e.id));
        expect(ids.size).toBe(6);

        for (const ex of exs) {
          expect(ex.difficulty).toBe(difficulty);
          expect(ex.curriculumRef).toBe(GRADE_CONFIGS[grade].curriculumRef);
          expect(ex.hint.length).toBeGreaterThan(0);
          expect(ex.explanation.length).toBeGreaterThan(0);
          expect(ex.question.length).toBeGreaterThan(0);

          if (ex.type === 'multiple_choice') {
            expect(ex.options).toBeDefined();
            expect(ex.options!.length).toBeGreaterThanOrEqual(2);
            expect(ex.options).toContain(ex.correctAnswer);
          }

          // The generator's own correctAnswer must satisfy the shared answer-checker
          // against itself — otherwise a student typing the exact expected answer
          // would be marked wrong.
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      });
    }
  }

  it('never generates mixed-number questions for grades where allowMixed is false', () => {
    for (const grade of (['g3', 'g4', 'g5'] as FractionGradeRange[])) {
      const exs = generateFractionsSet(grade, 3, 12);
      for (const ex of exs) {
        expect(ex.question).not.toMatch(/мешаниот број/);
      }
    }
  });

  it('difficulty 2 pool covers subtraction and percent conversion alongside compare/add/decimal', () => {
    const exs = generateFractionsSet('g6', 2, 20); // 20 exercises, 5 qTypes → each appears 4x
    expect(exs.some(e => e.question.includes('−'))).toBe(true);
    expect(exs.some(e => e.question.includes('процент'))).toBe(true);
  });

  it('difficulty 3 pool covers subtraction, multiplication, and division alongside mixed/add', () => {
    const exs = generateFractionsSet('g6', 3, 20);
    expect(exs.some(e => e.question.includes('−'))).toBe(true);
    expect(exs.some(e => e.question.includes('×'))).toBe(true);
    expect(exs.some(e => e.question.includes('÷'))).toBe(true);
  });
});
