import { describe, it, expect } from 'vitest';
import {
  BASE_FUNCTIONS, IDENTITY_PARAMS,
  applyTransform, buildPathD, clamp, formatFormula, sampleCurve,
} from './functionTransformerHelpers';

describe('functionTransformerHelpers', () => {
  describe('applyTransform', () => {
    it('returns y = a·f(b·x + c) + d for sin', () => {
      const y = applyTransform(BASE_FUNCTIONS.sin, 0, { a: 2, b: 1, c: 0, d: 1 });
      expect(y).toBeCloseTo(2 * Math.sin(0) + 1, 6);
    });

    it('shifts inner argument: f(b·x + c)', () => {
      const y = applyTransform(BASE_FUNCTIONS.cos, 1, { a: 1, b: 2, c: 1, d: 0 });
      expect(y).toBeCloseTo(Math.cos(2 * 1 + 1), 6);
    });

    it('returns null where the base function is undefined (sqrt(-1))', () => {
      const y = applyTransform(BASE_FUNCTIONS.sqrt, -1, IDENTITY_PARAMS);
      expect(y).toBeNull();
    });

    it('returns null for ln(0)', () => {
      expect(applyTransform(BASE_FUNCTIONS.log, 0, IDENTITY_PARAMS)).toBeNull();
    });

    it('returns null for tan near asymptote', () => {
      expect(applyTransform(BASE_FUNCTIONS.tan, Math.PI / 2, IDENTITY_PARAMS)).toBeNull();
    });

    it('returns null when result is non-finite', () => {
      const fakeFn = { ...BASE_FUNCTIONS.sq, fn: () => Infinity };
      expect(applyTransform(fakeFn, 1, IDENTITY_PARAMS)).toBeNull();
    });
  });

  describe('sampleCurve', () => {
    it('samples N points across [xMin, xMax]', () => {
      const pts = sampleCurve(BASE_FUNCTIONS.sq, IDENTITY_PARAMS, { xMin: -2, xMax: 2, samples: 5 });
      expect(pts).toHaveLength(5);
      expect(pts[0].x).toBe(-2);
      expect(pts[4].x).toBe(2);
      expect(pts[2].y).toBeCloseTo(0, 6);
    });

    it('returns [] if samples < 2', () => {
      expect(sampleCurve(BASE_FUNCTIONS.sq, IDENTITY_PARAMS, { xMin: 0, xMax: 1, samples: 1 })).toEqual([]);
    });
  });

  describe('clamp', () => {
    it('clamps within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-1, 0, 10)).toBe(0);
      expect(clamp(99, 0, 10)).toBe(10);
    });
    it('returns lo for NaN', () => {
      expect(clamp(NaN, 1, 9)).toBe(1);
    });
  });

  describe('buildPathD', () => {
    const toScreen = (x: number, y: number) => ({ sx: x * 10, sy: -y * 10 });

    it('starts with M then L', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      const d = buildPathD(pts, toScreen, { yMin: -10, yMax: 10 });
      expect(d.startsWith('M')).toBe(true);
      expect(d.split('L')).toHaveLength(3); // M + 2 L segments
    });

    it('breaks pen on undefined (null y)', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: null },
        { x: 2, y: 2 },
      ];
      const d = buildPathD(pts, toScreen, { yMin: -10, yMax: 10 });
      // After the gap a fresh M should appear (so two M tokens total)
      expect((d.match(/M/g) ?? []).length).toBe(2);
    });

    it('clips points outside yMin/yMax', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 100 },
        { x: 2, y: 0 },
      ];
      const d = buildPathD(pts, toScreen, { yMin: -10, yMax: 10 });
      expect((d.match(/M/g) ?? []).length).toBe(2);
    });
  });

  describe('formatFormula', () => {
    it('renders identity', () => {
      expect(formatFormula(BASE_FUNCTIONS.sin, IDENTITY_PARAMS)).toBe('sin(x)');
    });

    it('renders 2·sin(3x + 1) − 4', () => {
      expect(formatFormula(BASE_FUNCTIONS.sin, { a: 2, b: 3, c: 1, d: -4 }))
        .toBe('2·sin(3x + 1) − 4');
    });

    it('handles negative-one a as unary minus', () => {
      expect(formatFormula(BASE_FUNCTIONS.cos, { a: -1, b: 1, c: 0, d: 0 })).toBe('−cos(x)');
    });

    it('handles negative b as −x', () => {
      expect(formatFormula(BASE_FUNCTIONS.sin, { a: 1, b: -1, c: 0, d: 0 })).toBe('sin(−x)');
    });
  });
});
