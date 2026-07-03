import { describe, it, expect } from 'vitest';
import { generateGeo3DSet } from './geometry3dExerciseMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('generateGeo3DSet', () => {
  it('returns the requested count, capped by pool size', () => {
    const set1 = generateGeo3DSet(1, 4);
    expect(set1).toHaveLength(4);
    const full = generateGeo3DSet(1, 6);
    expect(full).toHaveLength(6);
  });

  it('assigns unique ids within a set', () => {
    const set = generateGeo3DSet(2, 6);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateGeo3DSet(d, 6);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('shuffles order across calls (not always identical sequence)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateGeo3DSet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateGeo3DSet(d, 6)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateGeo3DSet(d, 6)) {
        if (ex.type === 'multiple_choice') {
          expect(ex.options).toBeDefined();
          expect(ex.options).toContain(ex.correctAnswer);
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateGeo3DSet(d, 6)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  it("Euler's formula question (V-E+F) resolves to 2", () => {
    const set = generateGeo3DSet(1, 6);
    const euler = set.find(e => e.question.includes('Ојлер'));
    expect(euler?.correctAnswer).toBe('2');
  });
});
