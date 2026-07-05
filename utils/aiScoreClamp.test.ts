import { describe, it, expect } from 'vitest';
import { clampAiScore } from './aiScoreClamp';

describe('clampAiScore', () => {
  it('passes through a valid in-range score', () => {
    expect(clampAiScore(1, 2)).toBe(1);
  });

  it('clamps a score above maxPoints (AI hallucinated a higher score than possible)', () => {
    expect(clampAiScore(5, 2)).toBe(2);
  });

  it('floors a negative score at 0', () => {
    expect(clampAiScore(-3, 2)).toBe(0);
  });

  it('falls back to 0 on a non-numeric field instead of poisoning downstream sums with NaN', () => {
    expect(clampAiScore('N/A', 2)).toBe(0);
    expect(Number.isNaN(clampAiScore('N/A', 2))).toBe(false);
  });

  it('falls back to 0 on null/undefined', () => {
    expect(clampAiScore(null, 2)).toBe(0);
    expect(clampAiScore(undefined, 2)).toBe(0);
  });
});
