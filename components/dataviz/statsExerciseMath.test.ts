import { describe, it, expect } from 'vitest';
import { generateStatsSet } from './statsExerciseMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('generateStatsSet — pool checklist', () => {
  it('returns the requested count, capped by pool size (6 per difficulty)', () => {
    expect(generateStatsSet(1, 4)).toHaveLength(4);
    expect(generateStatsSet(2, 6)).toHaveLength(6);
    expect(generateStatsSet(3, 6)).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateStatsSet(d, 6);
      const ids = new Set(set.map(e => e.id));
      expect(ids.size).toBe(set.length);
    }
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateStatsSet(d, 6)) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles order across calls (not always identical sequence)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateStatsSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateStatsSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateStatsSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateStatsSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  // ── Domain-specific spot checks (independently re-derived) ────────────────

  it('mean of 2,4,6,8,10 is 6 ((2+4+6+8+10)/5 = 30/5)', () => {
    const set = generateStatsSet(1, 6);
    const ex = set.find(e => e.question.startsWith('Средна вредност'));
    expect(ex).toBeDefined();
    const nums = [2, 4, 6, 8, 10];
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    expect(ex?.correctAnswer).toBe(String(mean));
  });

  it('median of 3,1,5,2,4 is 3 (sorted: 1,2,3,4,5 → middle element)', () => {
    const set = generateStatsSet(1, 6);
    const ex = set.find(e => e.question.startsWith('Медиана'));
    expect(ex).toBeDefined();
    const sorted = [3, 1, 5, 2, 4].slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(ex?.correctAnswer).toBe(String(median));
  });

  it('range of 5,11,2,8,14 is 12 (max − min = 14 − 2)', () => {
    const set = generateStatsSet(1, 6);
    const ex = set.find(e => e.question.startsWith('Опсег'));
    expect(ex).toBeDefined();
    const nums = [5, 11, 2, 8, 14];
    const range = Math.max(...nums) - Math.min(...nums);
    expect(ex?.correctAnswer).toBe(String(range));
  });

  it('Z-score for μ=70, σ=10, X=80 is 1 ((80−70)/10)', () => {
    const set = generateStatsSet(2, 6);
    const ex = set.find(e => e.question.includes('μ=70'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe(String((80 - 70) / 10));
  });

  it('Z-score for μ=50, σ=5, X=40 is -2 ((40−50)/5)', () => {
    const set = generateStatsSet(2, 6);
    const ex = set.find(e => e.question.includes('μ=50'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe(String((40 - 50) / 5));
  });

  it('variance of 2,4,6 (μ=4) is ≈2.67 (Σ(xᵢ−μ)²/n = 8/3)', () => {
    const set = generateStatsSet(3, 6);
    const ex = set.find(e => e.question.startsWith('Варијанса'));
    expect(ex).toBeDefined();
    const nums = [2, 4, 6];
    const mu = 4;
    const variance = nums.reduce((s, x) => s + (x - mu) ** 2, 0) / nums.length;
    expect(parseFloat(ex!.correctAnswer)).toBeCloseTo(variance, 2);
  });
});
