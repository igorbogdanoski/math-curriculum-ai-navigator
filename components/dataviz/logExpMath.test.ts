import { describe, it, expect } from 'vitest';
import { generateLogExpSet } from './logExpMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('generateLogExpSet', () => {
  it('returns the requested count, capped by pool size', () => {
    const set1 = generateLogExpSet(1, 4);
    expect(set1).toHaveLength(4);
    const full = generateLogExpSet(1, 6);
    expect(full).toHaveLength(6);
    // pool has only 6 entries — requesting more should cap at pool size
    const over = generateLogExpSet(1, 10);
    expect(over).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    const set = generateLogExpSet(2, 6);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateLogExpSet(d, 6);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles order across calls (not always identical sequence)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateLogExpSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a non-empty hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLogExpSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLogExpSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateLogExpSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  // ── Domain-specific spot checks ──────────────────────────────────────────

  it('log₂(8) = 3 (basic logarithm identity)', () => {
    const set = generateLogExpSet(1, 6);
    const ex = set.find(e => e.question.includes('log₂(8)'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('3'); // 2^3 = 8
  });

  it('compound interest A = Pe^(rt), P=100 r=0.1 t=1 → A ≈ 110.52', () => {
    const set = generateLogExpSet(3, 6);
    const ex = set.find(e => e.question.includes('A = Pe^(rt)'));
    expect(ex).toBeDefined();
    const expected = (100 * Math.exp(0.1)).toFixed(2); // 110.52
    expect(ex?.correctAnswer).toBe(expected);
  });

  it('Shannon entropy for p₁=p₂=0.5 is 1 bit', () => {
    const set = generateLogExpSet(3, 6);
    const ex = set.find(e => e.question.includes('Shannon entropy'));
    expect(ex).toBeDefined();
    const H = -(0.5 * Math.log2(0.5) + 0.5 * Math.log2(0.5));
    expect(ex?.correctAnswer).toBe(String(H)); // should be '1'
  });

  it('log₃(1/27) = -3 (negative exponent identity)', () => {
    const set = generateLogExpSet(3, 6);
    const ex = set.find(e => e.question.includes('log₃(1/27)'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('-3'); // 3^(-3) = 1/27
  });
});
