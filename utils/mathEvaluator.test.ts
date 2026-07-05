import { describe, it, expect } from 'vitest';
import { checkMathEquivalence } from './mathEvaluator';

describe('checkMathEquivalence — pre-existing fast-path behavior (unchanged)', () => {
  it('matches exact strings', () => {
    expect(checkMathEquivalence('2x+2', '2x+2')).toBe(true);
  });

  it('matches equivalent fractions/decimals numerically', () => {
    expect(checkMathEquivalence('1/2', '0.5')).toBe(true);
    expect(checkMathEquivalence('2/4', '0.5')).toBe(true);
  });

  it('matches single-x-variable algebra via sampling', () => {
    expect(checkMathEquivalence('x+x', '2x')).toBe(true);
  });

  it('rejects genuinely different values', () => {
    expect(checkMathEquivalence('3', '4')).toBe(false);
    expect(checkMathEquivalence('x^2', '2x')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(checkMathEquivalence('', '5')).toBe(false);
    expect(checkMathEquivalence('5', '')).toBe(false);
  });
});

describe('checkMathEquivalence — new CAS fallback coverage', () => {
  it('recognises LaTeX fraction vs decimal (MathInput/MathLive input the old numeric-only check could not parse)', () => {
    expect(checkMathEquivalence('\\frac{1}{2}', '0.5')).toBe(true);
  });

  it('recognises distribution, not just single-x numeric sampling', () => {
    expect(checkMathEquivalence('2(x+1)', '2x+2')).toBe(true);
  });

  it('recognises equivalence for a variable other than x', () => {
    expect(checkMathEquivalence('2a+2', '2+2a')).toBe(true);
  });

  it('still correctly rejects a wrong LaTeX answer rather than false-accepting via CAS', () => {
    expect(checkMathEquivalence('\\frac{1}{3}', '0.5')).toBe(false);
  });
});
