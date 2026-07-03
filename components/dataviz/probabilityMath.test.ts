import { describe, it, expect } from 'vitest';
import {
  wilsonCI,
  factorial,
  combinations,
  permutations,
  binomCoeff,
  generateProbabilitySet,
} from './probabilityMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('factorial', () => {
  it('0! = 1', () => {
    expect(factorial(0)).toBe(1);
  });
  it('5! = 120', () => {
    expect(factorial(5)).toBe(120);
  });
  it('returns NaN for negative or non-integer n', () => {
    expect(Number.isNaN(factorial(-1))).toBe(true);
    expect(Number.isNaN(factorial(2.5))).toBe(true);
  });
});

describe('combinations / permutations / binomCoeff', () => {
  it('C(5,2) = 10', () => {
    expect(combinations(5, 2)).toBe(10);
  });
  it('P(5,2) = 20', () => {
    expect(permutations(5, 2)).toBe(20);
  });
  it('combinations and binomCoeff agree for a range of n,k', () => {
    for (let n = 0; n <= 10; n++) {
      for (let k = 0; k <= n; k++) {
        expect(combinations(n, k)).toBeCloseTo(binomCoeff(n, k), 9);
      }
    }
  });
  it('binomCoeff(n,0) = binomCoeff(n,n) = 1', () => {
    expect(binomCoeff(7, 0)).toBe(1);
    expect(binomCoeff(7, 7)).toBe(1);
  });
  it('combinations returns 0 when k > n or k < 0', () => {
    expect(combinations(3, 5)).toBe(0);
    expect(combinations(3, -1)).toBe(0);
  });
  it('permutations returns 0 when k > n or k < 0', () => {
    expect(permutations(3, 5)).toBe(0);
    expect(permutations(3, -1)).toBe(0);
  });
});

describe('wilsonCI', () => {
  it('returns [0,1] for total=0', () => {
    expect(wilsonCI(0, 0)).toEqual([0, 1]);
  });
  it('bounds are within [0,1] and contain the naive proportion (p=0.5, n=10)', () => {
    const [lo, hi] = wilsonCI(5, 10);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThanOrEqual(0.5);
    expect(hi).toBeGreaterThanOrEqual(0.5);
  });
  it('bounds contain the naive proportion for an asymmetric case (p=0.2, n=20)', () => {
    const [lo, hi] = wilsonCI(4, 20);
    expect(lo).toBeLessThanOrEqual(0.2);
    expect(hi).toBeGreaterThanOrEqual(0.2);
  });
  it('interval widens as sample size (total) shrinks, for a fixed proportion', () => {
    const small = wilsonCI(5, 10);   // p = 0.5, n = 10
    const large = wilsonCI(50, 100); // p = 0.5, n = 100
    const widthSmall = small[1] - small[0];
    const widthLarge = large[1] - large[0];
    expect(widthSmall).toBeGreaterThan(widthLarge);
  });
});

describe('generateProbabilitySet — pool checklist', () => {
  it('returns the requested count', () => {
    expect(generateProbabilitySet(1, 6)).toHaveLength(6);
    expect(generateProbabilitySet(2, 9)).toHaveLength(9);
    expect(generateProbabilitySet(3, 3)).toHaveLength(3);
  });

  it('assigns unique ids within a set', () => {
    const set = generateProbabilitySet(2, 12);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateProbabilitySet(d, 9)) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateProbabilitySet(d, 9)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (let i = 0; i < 30; i++) {
      for (const d of [1, 2, 3] as const) {
        for (const ex of generateProbabilitySet(d, 9)) {
          if (ex.type === 'multiple_choice') {
            expect(ex.options).toBeDefined();
            expect(ex.options).toContain(ex.correctAnswer);
          }
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (let i = 0; i < 10; i++) {
      for (const d of [1, 2, 3] as const) {
        for (const ex of generateProbabilitySet(d, 9)) {
          if (ex.type === 'numeric') {
            expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
          }
        }
      }
    }
  });

  // ── Domain-specific spot checks (independently re-derived) ────────────────

  it('"P(сума=7)" for two dice is 1/6 (6 favorable outcomes / 36 total)', () => {
    const set = generateProbabilitySet(2, 30);
    const ex = set.find(e => e.question.includes('сума = 7'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('1/6');
  });

  it('"C(4, 2)" combinations question resolves to 6 (4!/(2!·2!) = 6)', () => {
    const set = generateProbabilitySet(2, 30);
    const ex = set.find(e => e.question.startsWith('C(4, 2)'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('6');
  });

  it('independent-events P(A∩B) questions equal P(A)×P(B)', () => {
    const set = generateProbabilitySet(3, 60);
    const indepExs = set.filter(e => e.question.includes('независни'));
    expect(indepExs.length).toBeGreaterThan(0);
    for (const ex of indepExs) {
      const m = ex.question.match(/P\(A\)=([\d.]+), P\(B\)=([\d.]+)/);
      expect(m).not.toBeNull();
      const pA = parseFloat(m![1]);
      const pB = parseFloat(m![2]);
      expect(parseFloat(ex.correctAnswer)).toBeCloseTo(pA * pB, 9);
    }
  });

  it('union P(A∪B) questions equal P(A) + P(B) − P(A∩B)', () => {
    const set = generateProbabilitySet(3, 60);
    const unionExs = set.filter(e => e.question.includes('P(A∪B)'));
    expect(unionExs.length).toBeGreaterThan(0);
    for (const ex of unionExs) {
      const m = ex.question.match(/P\(A\)=([\d.]+), P\(B\)=([\d.]+), P\(A∩B\)=([\d.]+)/);
      expect(m).not.toBeNull();
      const pA = parseFloat(m![1]);
      const pB = parseFloat(m![2]);
      const pAB = parseFloat(m![3]);
      expect(parseFloat(ex.correctAnswer)).toBeCloseTo(pA + pB - pAB, 9);
    }
  });
});
