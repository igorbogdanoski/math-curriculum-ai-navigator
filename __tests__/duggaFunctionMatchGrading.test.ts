/**
 * S61-C2 — Tests for the function_match auto-grader.
 */
import { describe, it, expect } from 'vitest';
import {
  gradeFunctionMatch,
  parseFunctionMatch,
} from '../utils/duggaFunctionMatchGrading';
import type { DuggaExpectedTransform, DuggaQuestion } from '../services/firestoreService.dugga';
import { autoScore } from '../utils/duggaScoring';

const expected: DuggaExpectedTransform = {
  fnKey: 'sin',
  target: { a: 2, b: 1, c: 0, d: -1 },
};

describe('parseFunctionMatch', () => {
  it('returns undefined for empty / invalid', () => {
    expect(parseFunctionMatch('')).toBeUndefined();
    expect(parseFunctionMatch('not json')).toBeUndefined();
  });
  it('parses an object', () => {
    expect(parseFunctionMatch('{"a":1,"b":2}')).toEqual({ a: 1, b: 2 });
  });
});

describe('gradeFunctionMatch', () => {
  it('zero score when no submission', () => {
    const r = gradeFunctionMatch(expected, undefined, 0.1);
    expect(r.score).toBe(0);
    expect(r.details.hits).toBe(0);
  });

  it('full score on exact match', () => {
    const r = gradeFunctionMatch(expected, { a: 2, b: 1, c: 0, d: -1 }, 0.1);
    expect(r.score).toBe(1);
    expect(r.details.hits).toBe(4);
    expect(r.feedback).toMatch(/Браво/);
  });

  it('respects tolerance for each parameter', () => {
    const r = gradeFunctionMatch(
      expected,
      { a: 2.05, b: 0.95, c: -0.08, d: -1.1 },
      0.1,
    );
    expect(r.details.hits).toBe(4);
    expect(r.score).toBe(1);
  });

  it('partial credit (3/4)', () => {
    const r = gradeFunctionMatch(
      expected,
      { a: 2, b: 1, c: 0, d: 5 }, // d wrong
      0.1,
    );
    expect(r.details.hits).toBe(3);
    expect(r.score).toBeCloseTo(0.75);
    expect(r.feedback).toMatch(/d=-1/);
  });

  it('handles string-numeric submissions', () => {
    const r = gradeFunctionMatch(expected, { a: '2', b: '1', c: '0', d: '-1' }, 0.1);
    expect(r.details.hits).toBe(4);
  });

  it('zero hits when all params off', () => {
    const r = gradeFunctionMatch(expected, { a: 99, b: 99, c: 99, d: 99 }, 0.1);
    expect(r.details.hits).toBe(0);
    expect(r.score).toBe(0);
  });
});

describe('autoScore wiring for function_match', () => {
  it('returns null when expectedTransform missing', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'function_match', text: 'Помести', dok: 2, points: 8,
    };
    expect(autoScore(q, '')).toBeNull();
  });

  it('full points on exact match', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'function_match', text: 'Помести', dok: 2, points: 8,
      expectedTransform: expected,
    };
    const r = autoScore(q, JSON.stringify(expected.target))!;
    expect(r.earned).toBe(8);
    expect(r.correct).toBe(true);
  });

  it('partial points with rounding', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'function_match', text: 'Помести', dok: 2, points: 8,
      expectedTransform: expected,
    };
    // 2/4 hits → 0.5 → 4 points
    const r = autoScore(q, JSON.stringify({ a: 2, b: 1, c: 99, d: 99 }))!;
    expect(r.earned).toBe(4);
    expect(r.correct).toBe(false);
  });

  it('honours custom transformTolerance', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'function_match', text: 'Помести', dok: 2, points: 4,
      expectedTransform: expected,
      transformTolerance: 0.5, // very loose
    };
    const r = autoScore(q, JSON.stringify({ a: 2.4, b: 0.6, c: 0.4, d: -0.6 }))!;
    expect(r.correct).toBe(true);
    expect(r.earned).toBe(4);
  });
});
