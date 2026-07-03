import { describe, it, expect } from 'vitest';
import {
  decomposeNumber,
  recompose,
  toExpandedForm,
  toWordFormMK,
  randomNumber,
  blockRows,
  generatePlaceValueSet,
  GRADE_CONFIGS,
  type GradeRange,
} from './placeValueMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('decomposeNumber / recompose (round-trip)', () => {
  it('round-trips representative numbers within [0, 9999]', () => {
    for (const n of [0, 5, 9, 10, 42, 99, 100, 305, 999, 1000, 1050, 4321, 9999]) {
      expect(recompose(decomposeNumber(n))).toBe(n);
    }
  });

  it('decomposes 1050 with a zero in the hundreds place', () => {
    expect(decomposeNumber(1050)).toEqual({ thousands: 1, hundreds: 0, tens: 5, ones: 0 });
  });

  it('decomposes a single digit number', () => {
    expect(decomposeNumber(7)).toEqual({ thousands: 0, hundreds: 0, tens: 0, ones: 7 });
  });

  it('clamps values above 9999 and below 0', () => {
    expect(recompose(decomposeNumber(10500))).toBe(9999);
    expect(recompose(decomposeNumber(-5))).toBe(0);
  });
});

describe('toExpandedForm', () => {
  it('formats a number with all four place values', () => {
    expect(toExpandedForm(1234)).toBe('1000 + 200 + 30 + 4');
  });

  it('skips zero place values, e.g. 1050 (zero hundreds)', () => {
    expect(toExpandedForm(1050)).toBe('1000 + 50');
  });

  it('returns "0" for zero', () => {
    expect(toExpandedForm(0)).toBe('0');
  });

  it('formats a single-digit number', () => {
    expect(toExpandedForm(7)).toBe('7');
  });
});

describe('toWordFormMK', () => {
  it('returns нула for 0', () => {
    expect(toWordFormMK(0)).toBe('нула');
  });

  it('forms single-digit and teen numbers directly from MK_ONES', () => {
    expect(toWordFormMK(1)).toBe('еден');
    expect(toWordFormMK(15)).toBe('петнаесет');
  });

  it('forms a tens+ones number with "и" connector', () => {
    expect(toWordFormMK(25)).toBe('дваесет и пет');
  });

  it('forms an exact hundred with no tens/ones suffix', () => {
    expect(toWordFormMK(100)).toBe('сто');
  });

  it('forms "илјада" for 1000 and "две илјади" for 2000', () => {
    expect(toWordFormMK(1000)).toBe('илјада');
    expect(toWordFormMK(2000)).toBe('две илјади');
  });

  it('forms a full four-place number', () => {
    // 1234 = илјада (1000) + двесте (200) + триесет и четири (34)
    expect(toWordFormMK(1234)).toBe('илјада двесте триесет и четири');
  });
});

describe('randomNumber', () => {
  it('stays within the configured [1, max] range for every grade, over many samples', () => {
    for (const grade of Object.keys(GRADE_CONFIGS) as GradeRange[]) {
      const { max } = GRADE_CONFIGS[grade];
      for (let i = 0; i < 100; i++) {
        const n = randomNumber(grade);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(max);
        expect(Number.isInteger(n)).toBe(true);
      }
    }
  });
});

describe('blockRows', () => {
  it('splits a count into full rows plus a remainder row', () => {
    const rows = blockRows(7, 3);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.length)).toEqual([3, 3, 1]);
  });

  it('produces a single row when count fits exactly in perRow', () => {
    const rows = blockRows(5, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(5);
  });

  it('produces no rows for a zero count', () => {
    expect(blockRows(0, 5)).toEqual([]);
  });

  it('total block count across rows matches input count', () => {
    for (const [count, perRow] of [[13, 4], [22, 10], [1, 3]] as const) {
      const rows = blockRows(count, perRow);
      const total = rows.reduce((sum, r) => sum + r.length, 0);
      expect(total).toBe(count);
    }
  });
});

describe('generatePlaceValueSet', () => {
  it('returns the requested count', () => {
    for (const count of [3, 6, 9]) {
      expect(generatePlaceValueSet('g3', 1, count)).toHaveLength(count);
    }
  });

  it('assigns unique ids within a set', () => {
    const set = generatePlaceValueSet('g3', 2, 9);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const grade of Object.keys(GRADE_CONFIGS) as GradeRange[]) {
      for (const d of [1, 2, 3] as const) {
        const set = generatePlaceValueSet(grade, d, 9);
        for (const ex of set) {
          expect(ex.difficulty).toBe(d);
        }
      }
    }
  });

  it('every exercise has a non-empty hint, explanation, and curriculumRef', () => {
    for (const grade of Object.keys(GRADE_CONFIGS) as GradeRange[]) {
      for (const d of [1, 2, 3] as const) {
        for (const ex of generatePlaceValueSet(grade, d, 6)) {
          expect(ex.hint.length).toBeGreaterThan(0);
          expect(ex.explanation.length).toBeGreaterThan(0);
          expect(ex.curriculumRef.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('multiple_choice exercises (difficulty 1) list the correctAnswer among their options', () => {
    for (const grade of Object.keys(GRADE_CONFIGS) as GradeRange[]) {
      for (let i = 0; i < 10; i++) {
        for (const ex of generatePlaceValueSet(grade, 1, 6)) {
          if (ex.type === 'multiple_choice') {
            expect(ex.options).toBeDefined();
            expect(ex.options).toContain(ex.correctAnswer);
          }
        }
      }
    }
  });

  it('numeric exercises (difficulty 2/3) have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const grade of Object.keys(GRADE_CONFIGS) as GradeRange[]) {
      for (const d of [2, 3] as const) {
        for (let i = 0; i < 10; i++) {
          for (const ex of generatePlaceValueSet(grade, d, 6)) {
            if (ex.type === 'numeric') {
              expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('difficulty-3 "expanded form = ?" questions match toExpandedForm/n', () => {
    for (let i = 0; i < 15; i++) {
      const set = generatePlaceValueSet('g3', 3, 6);
      for (const ex of set) {
        const n = Number(ex.correctAnswer);
        expect(toExpandedForm(n)).toBe(ex.question.replace(/ = \?$/, ''));
      }
    }
  });
});
