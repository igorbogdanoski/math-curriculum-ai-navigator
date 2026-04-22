import { describe, it, expect } from 'vitest';
import { decomposeAMinusBCubed, formatIdentityFactored } from './algebraicIdentityHelpers';

describe('decomposeAMinusBCubed', () => {
  it('three slab volumes sum to a^3 - b^3', () => {
    const { totalVolume, expectedVolume, factorisedVolume } = decomposeAMinusBCubed(5, 2);
    expect(totalVolume).toBeCloseTo(expectedVolume, 9);
    expect(totalVolume).toBeCloseTo(factorisedVolume, 9);
    expect(expectedVolume).toBe(125 - 8);
  });

  it('works with non-integer values', () => {
    const { totalVolume, expectedVolume } = decomposeAMinusBCubed(3.5, 1.25);
    expect(totalVolume).toBeCloseTo(expectedVolume, 9);
  });

  it('returns three slabs with correct shapes', () => {
    const { slabs } = decomposeAMinusBCubed(4, 1);
    expect(slabs).toHaveLength(3);
    expect(slabs[0]).toEqual({ w: 3, d: 4, h: 4 });
    expect(slabs[1]).toEqual({ w: 3, d: 1, h: 4 });
    expect(slabs[2]).toEqual({ w: 3, d: 1, h: 1 });
  });

  it('throws when b >= a', () => {
    expect(() => decomposeAMinusBCubed(2, 2)).toThrow();
    expect(() => decomposeAMinusBCubed(1, 5)).toThrow();
  });

  it('throws on non-finite inputs', () => {
    expect(() => decomposeAMinusBCubed(NaN, 1)).toThrow();
    expect(() => decomposeAMinusBCubed(Infinity, 1)).toThrow();
  });

  it('throws on a <= 0 or b < 0', () => {
    expect(() => decomposeAMinusBCubed(0, 0)).toThrow();
    expect(() => decomposeAMinusBCubed(-1, 0)).toThrow();
    expect(() => decomposeAMinusBCubed(2, -0.1)).toThrow();
  });

  it('handles b = 0 (degenerate: identity reduces to a^3)', () => {
    const { totalVolume, expectedVolume } = decomposeAMinusBCubed(3, 0);
    expect(totalVolume).toBeCloseTo(27, 9);
    expect(expectedVolume).toBe(27);
  });
});

describe('formatIdentityFactored', () => {
  it('renders LaTeX-friendly factored form', () => {
    expect(formatIdentityFactored(5, 2)).toBe('(5-2)\\cdot(5^2 + 5\\cdot2 + 2^2)');
  });
});
