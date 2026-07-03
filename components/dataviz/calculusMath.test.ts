import { describe, it, expect } from 'vitest';
import { generateCalculusSet } from './calculusMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('generateCalculusSet', () => {
  it('returns the requested count, capped by pool size', () => {
    const set1 = generateCalculusSet(1, 4);
    expect(set1).toHaveLength(4);
    const full = generateCalculusSet(1, 6);
    expect(full).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    const set = generateCalculusSet(2, 6);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateCalculusSet(d, 6);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles order across calls (not always identical sequence)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateCalculusSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateCalculusSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateCalculusSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateCalculusSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  it('d/dx(sin x) resolves to cos x', () => {
    const set = generateCalculusSet(1, 6);
    const ex = set.find(e => e.question.includes('sin x'));
    expect(ex?.correctAnswer).toBe('cos x');
  });

  it('∫ eˣ dx resolves to eˣ + C', () => {
    const set = generateCalculusSet(3, 6);
    const ex = set.find(e => e.question.includes('∫ eˣ dx'));
    expect(ex?.correctAnswer).toBe('eˣ + C');
  });

  it("f(x) = x² + 3x → f'(1) = 5 (derivative 2x+3 evaluated at 1)", () => {
    const set = generateCalculusSet(3, 6);
    const ex = set.find(e => e.question.includes('x² + 3x'));
    expect(ex?.correctAnswer).toBe('5');
  });
});
