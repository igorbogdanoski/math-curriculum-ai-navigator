import { describe, it, expect } from 'vitest';
import { generateConicSet } from './conicsMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('generateConicSet', () => {
  it('returns the requested count, capped by pool size', () => {
    const set1 = generateConicSet(1, 4);
    expect(set1).toHaveLength(4);
    const full = generateConicSet(1, 6);
    expect(full).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    const set = generateConicSet(2, 6);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateConicSet(d, 6);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles order across calls (not always identical sequence)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateConicSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateConicSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateConicSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateConicSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  it('9x²+16y²=144 normalized to x²/16+y²/9=1 → a = 4', () => {
    const set = generateConicSet(3, 6);
    const ex = set.find(e => e.question.includes('9x²+16y²=144'));
    // 9x²+16y²=144 ÷144 → x²/16 + y²/9 = 1 → a² = 16 → a = 4
    expect(ex?.correctAnswer).toBe('4');
  });

  it('cot(2θ) rotation-of-axes formula equals (A−C)/B', () => {
    const set = generateConicSet(3, 6);
    const ex = set.find(e => e.question.includes('cot(2θ)'));
    expect(ex?.correctAnswer).toBe('(A−C)/B');
  });

  it('hyperbola (x/3)²−(y/4)²=1 eccentricity ≈ 1.67 (c=√(9+16)=5, e=5/3)', () => {
    const set = generateConicSet(3, 6);
    const ex = set.find(e => e.question.includes('(x/3)²−(y/4)²=1'));
    expect(ex?.correctAnswer).toBe('1.67');
  });

  it('ellipse a=13,b=5 → c=√(169−25)=√144=12', () => {
    const set = generateConicSet(2, 6);
    const ex = set.find(e => e.question.includes('a=13, b=5'));
    expect(ex?.correctAnswer).toBe('12');
  });
});
