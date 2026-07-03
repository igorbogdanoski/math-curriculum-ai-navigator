import { describe, it, expect } from 'vitest';
import {
  det2, det3, inv2, mul2, add2, transpose2, mul3, fmt,
  generateLinearAlgebraSet,
  type Mat2, type Mat3,
} from './linearAlgebraMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('det2', () => {
  it('identity matrix has determinant 1', () => {
    expect(det2([[1, 0], [0, 1]])).toBe(1);
  });

  it('computes a known non-trivial determinant', () => {
    // [[3,2],[1,4]] → 3*4 - 2*1 = 10
    expect(det2([[3, 2], [1, 4]])).toBe(10);
  });
});

describe('det3', () => {
  it('identity matrix has determinant 1', () => {
    expect(det3([[1, 0, 0], [0, 1, 0], [0, 0, 1]])).toBe(1);
  });

  it('computes a known non-trivial determinant', () => {
    // [[1,2,3],[4,5,6],[7,8,10]]
    // = 1*(5*10-6*8) - 2*(4*10-6*7) + 3*(4*8-5*7) = 2 + 4 - 9 = -3
    const m: Mat3 = [[1, 2, 3], [4, 5, 6], [7, 8, 10]];
    expect(det3(m)).toBe(-3);
  });
});

describe('inv2', () => {
  it('multiplying a matrix by its inverse yields (approximately) the identity', () => {
    const m: Mat2 = [[3, 2], [1, 4]];
    const inv = inv2(m);
    expect(inv).not.toBeNull();
    const product = mul2(m, inv as Mat2);
    expect(product[0][0]).toBeCloseTo(1, 10);
    expect(product[0][1]).toBeCloseTo(0, 10);
    expect(product[1][0]).toBeCloseTo(0, 10);
    expect(product[1][1]).toBeCloseTo(1, 10);
  });

  it('returns null for a singular matrix (det = 0)', () => {
    const singular: Mat2 = [[2, 4], [1, 2]]; // det = 2*2 - 4*1 = 0
    expect(det2(singular)).toBe(0);
    expect(inv2(singular)).toBeNull();
  });
});

describe('mul2', () => {
  it('matches a hand-computed product', () => {
    const a: Mat2 = [[1, 2], [3, 4]];
    const b: Mat2 = [[5, 6], [7, 8]];
    // [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]] = [[19,22],[43,50]]
    expect(mul2(a, b)).toEqual([[19, 22], [43, 50]]);
  });
});

describe('mul3', () => {
  it('multiplying by the identity returns the original matrix', () => {
    const m: Mat3 = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const id: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    expect(mul3(m, id)).toEqual(m);
    expect(mul3(id, m)).toEqual(m);
  });

  it('matches a hand-computed product', () => {
    const a: Mat3 = [[1, 0, 2], [0, 1, 0], [2, 0, 1]];
    const b: Mat3 = [[1, 1, 0], [0, 1, 1], [0, 0, 1]];
    // row0: [1*1+0*0+2*0, 1*1+0*1+2*0, 1*0+0*1+2*1] = [1,1,2]
    // row1: [0,1,1]
    // row2: [2*1+0*0+1*0, 2*1+0*1+1*0, 2*0+0*1+1*1] = [2,2,1]
    expect(mul3(a, b)).toEqual([[1, 1, 2], [0, 1, 1], [2, 2, 1]]);
  });
});

describe('add2', () => {
  it('adds two matrices element-wise', () => {
    const a: Mat2 = [[1, 2], [3, 4]];
    const b: Mat2 = [[5, 6], [7, 8]];
    expect(add2(a, b)).toEqual([[6, 8], [10, 12]]);
  });
});

describe('transpose2', () => {
  it('swaps off-diagonal entries', () => {
    const m: Mat2 = [[1, 2], [3, 4]];
    expect(transpose2(m)).toEqual([[1, 3], [2, 4]]);
  });

  it('is its own inverse (double transpose = original)', () => {
    const m: Mat2 = [[1, 2], [3, 4]];
    expect(transpose2(transpose2(m))).toEqual(m);
  });
});

describe('fmt', () => {
  it('formats an integer plainly', () => {
    expect(fmt(2)).toBe('2');
  });

  it('rounds to 3 decimal places', () => {
    expect(fmt(1 / 3)).toBe('0.333');
  });

  it('returns an em-dash for non-finite values', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
    expect(fmt(-Infinity)).toBe('—');
  });
});

describe('generateLinearAlgebraSet', () => {
  it('returns the requested count', () => {
    expect(generateLinearAlgebraSet(1, 4)).toHaveLength(4);
    expect(generateLinearAlgebraSet(1, 6)).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    const set = generateLinearAlgebraSet(2, 6);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateLinearAlgebraSet(d, 6);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles / varies content across calls (random operands)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateLinearAlgebraSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLinearAlgebraSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLinearAlgebraSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLinearAlgebraSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  it('2x2 det() questions (difficulty 1 & 2) independently verify against det2 across many random draws', () => {
    const re = /det\(\[\[(-?\d+),(-?\d+)\],\[(-?\d+),(-?\d+)\]\]\)/;
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      for (const d of [1, 2] as const) {
        for (const ex of generateLinearAlgebraSet(d, 6)) {
          const m = ex.question.match(re);
          if (!m) continue;
          const [, a, b, c, dd] = m.map(Number as unknown as (s: string) => number);
          const expected = a * dd - b * c;
          expect(ex.correctAnswer).toBe(String(expected));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('3x3 det() questions (difficulty 3) independently verify against det3 across many random draws', () => {
    const re = /det\(\[\[(-?\d+),(-?\d+),(-?\d+)\],\[(-?\d+),(-?\d+),(-?\d+)\],\[(-?\d+),(-?\d+),(-?\d+)\]\]\)/;
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      for (const ex of generateLinearAlgebraSet(3, 6)) {
        const m = ex.question.match(re);
        if (!m) continue;
        const nums = m.slice(1).map(Number);
        const mat: Mat3 = [
          [nums[0], nums[1], nums[2]],
          [nums[3], nums[4], nums[5]],
          [nums[6], nums[7], nums[8]],
        ];
        expect(ex.correctAnswer).toBe(String(det3(mat)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('vector magnitude questions (difficulty 2) match √(vx²+vy²) via Pythagorean triples', () => {
    const re = /\|\[(-?\d+), (-?\d+)\]\|/;
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      for (const ex of generateLinearAlgebraSet(2, 6)) {
        const m = ex.question.match(re);
        if (!m) continue;
        const vx = Number(m[1]), vy = Number(m[2]);
        const expected = Math.sqrt(vx * vx + vy * vy);
        expect(Number(ex.correctAnswer)).toBeCloseTo(expected, 10);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('eigenvalues of the 2x2 identity matrix are all 1', () => {
    const set = generateLinearAlgebraSet(3, 30);
    const ex = set.find(e => e.question.includes('Сопствените вредности'));
    expect(ex?.correctAnswer).toBe('Само 1');
  });
});
