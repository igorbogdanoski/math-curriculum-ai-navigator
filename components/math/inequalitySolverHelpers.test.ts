import { describe, it, expect } from 'vitest';
import {
  buildNumberLine, buildSignChart, formatInterval, formatSolution,
  solveAbs, solvePolynomial,
} from './inequalitySolverHelpers';

describe('inequalitySolverHelpers', () => {
  describe('solveAbs', () => {
    it('|x − 0| < 3 → (-3, 3)', () => {
      const s = solveAbs({ a: 0, b: 3, op: '<' });
      expect(s).toEqual([{ lo: -3, hi: 3, loInclusive: false, hiInclusive: false }]);
    });

    it('|x − 2| ≤ 1 → [1, 3]', () => {
      const s = solveAbs({ a: 2, b: 1, op: '<=' });
      expect(s).toEqual([{ lo: 1, hi: 3, loInclusive: true, hiInclusive: true }]);
    });

    it('|x − 0| > 2 → (-∞, -2) ∪ (2, ∞)', () => {
      const s = solveAbs({ a: 0, b: 2, op: '>' });
      expect(s).toHaveLength(2);
      expect(s[0].hi).toBe(-2);
      expect(s[1].lo).toBe(2);
    });

    it('|x − 0| < -1 → empty', () => {
      expect(solveAbs({ a: 0, b: -1, op: '<' })).toEqual([]);
    });

    it('|x − 5| ≤ 0 → {5}', () => {
      const s = solveAbs({ a: 5, b: 0, op: '<=' });
      expect(s).toEqual([{ lo: 5, hi: 5, loInclusive: true, hiInclusive: true }]);
    });

    it('|x − 1| > -1 → all reals', () => {
      const s = solveAbs({ a: 1, b: -1, op: '>' });
      expect(s).toHaveLength(1);
      expect(s[0].lo).toBe(-Infinity);
      expect(s[0].hi).toBe(Infinity);
    });
  });

  describe('buildSignChart', () => {
    it('alternates signs around 3 distinct roots', () => {
      const { partition, signs } = buildSignChart([1, 3, 5], 1);
      expect(partition).toEqual([1, 3, 5]);
      // Sign at +∞ = +1, alternating leftwards.
      expect(signs).toEqual([-1, 1, -1, 1]);
    });

    it('flips when leading is negative', () => {
      const { signs } = buildSignChart([0], -1);
      expect(signs).toEqual([1, -1]);
    });
  });

  describe('solvePolynomial', () => {
    it('(x-1)(x-3) > 0 → (-∞,1) ∪ (3,∞)', () => {
      const s = solvePolynomial({ roots: [1, 3], op: '>' });
      expect(s).toHaveLength(2);
      expect(s[0].hi).toBe(1);
      expect(s[1].lo).toBe(3);
    });

    it('(x+2)(x-1)(x-3) < 0 strictly excludes roots', () => {
      const s = solvePolynomial({ roots: [-2, 1, 3], op: '<' });
      // Sign chart: -, +, -, +  → negative on (-∞,-2) and (1,3).
      expect(s).toHaveLength(2);
      expect(s[0]).toMatchObject({ lo: -Infinity, hi: -2, hiInclusive: false });
      expect(s[1]).toMatchObject({ lo: 1, hi: 3, loInclusive: false });
    });

    it('non-strict ≤ includes endpoints', () => {
      const s = solvePolynomial({ roots: [-2, 1], op: '<=' });
      // Sign chart: +, -, +  → ≤ 0 covers [-2, 1].
      expect(s.find((iv) => iv.lo === -2)?.loInclusive).toBe(true);
      expect(s.find((iv) => iv.hi === 1)?.hiInclusive).toBe(true);
    });
  });

  describe('formatInterval / formatSolution', () => {
    it('renders open interval', () => {
      expect(formatInterval({ lo: 1, hi: 3, loInclusive: false, hiInclusive: false }))
        .toBe('(1, 3)');
    });
    it('renders mixed inclusivity', () => {
      expect(formatInterval({ lo: 0, hi: 5, loInclusive: true, hiInclusive: false }))
        .toBe('[0, 5)');
    });
    it('renders unbounded', () => {
      expect(formatInterval({ lo: -Infinity, hi: 0, loInclusive: false, hiInclusive: true }))
        .toBe('(−∞, 0]');
    });
    it('renders empty solution as ∅', () => {
      expect(formatSolution([])).toBe('∅');
    });
  });

  describe('buildNumberLine', () => {
    it('produces points for finite endpoints only', () => {
      const data = buildNumberLine([
        { lo: -Infinity, hi: 0, loInclusive: false, hiInclusive: true },
        { lo: 2, hi: Infinity, loInclusive: true, hiInclusive: false },
      ]);
      expect(data.points).toHaveLength(2);
      expect(data.points[0]).toEqual({ x: 0, filled: true });
      expect(data.points[1]).toEqual({ x: 2, filled: true });
    });

    it('range pads around finite values', () => {
      const data = buildNumberLine([{ lo: 1, hi: 3, loInclusive: false, hiInclusive: false }], 2);
      expect(data.range.min).toBe(-1);
      expect(data.range.max).toBe(5);
    });
  });
});
