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
      const fakeFn = { ...BASE_FUNCTIONS.sq, build: () => () => Infinity };
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

// ─── S62-A1/A2 — Universal base functions ────────────────────────────────────
import { defaultExtraParams } from './functionTransformerHelpers';

describe('S62 universal BASE_FUNCTIONS', () => {
  describe('logBase (log_b x)', () => {
    const fn = BASE_FUNCTIONS.logBase;

    it('computes log_10(100) = 2', () => {
      const y = applyTransform(fn, 100, IDENTITY_PARAMS, { base: 10 });
      expect(y).toBeCloseTo(2, 6);
    });

    it('computes log_2(8) = 3', () => {
      const y = applyTransform(fn, 8, IDENTITY_PARAMS, { base: 2 });
      expect(y).toBeCloseTo(3, 6);
    });

    it('returns null for x ≤ 0', () => {
      expect(applyTransform(fn, 0, IDENTITY_PARAMS, { base: 10 })).toBeNull();
      expect(applyTransform(fn, -1, IDENTITY_PARAMS, { base: 10 })).toBeNull();
    });

    it('returns null for base = 1 (degenerate)', () => {
      expect(applyTransform(fn, 5, IDENTITY_PARAMS, { base: 1 })).toBeNull();
    });

    it('has extraParams with key=base, default=10', () => {
      expect(fn.extraParams).toHaveLength(1);
      expect(fn.extraParams![0].key).toBe('base');
      expect(fn.extraParams![0].default).toBe(10);
    });

    it('formatFormula substitutes base', () => {
      expect(formatFormula(fn, IDENTITY_PARAMS, { base: 2 })).toContain('2');
    });
  });

  describe('expBase (b^x)', () => {
    const fn = BASE_FUNCTIONS.expBase;

    it('computes 2^3 = 8', () => {
      const y = applyTransform(fn, 3, IDENTITY_PARAMS, { base: 2 });
      expect(y).toBeCloseTo(8, 6);
    });

    it('computes e^1 ≈ 2.718', () => {
      const y = applyTransform(fn, 1, IDENTITY_PARAMS, { base: Math.E });
      expect(y).toBeCloseTo(Math.E, 5);
    });

    it('has extraParams with key=base', () => {
      expect(fn.extraParams).toHaveLength(1);
      expect(fn.extraParams![0].key).toBe('base');
    });
  });

  describe('recip (1/x)', () => {
    const fn = BASE_FUNCTIONS.recip;

    it('computes 1/4 = 0.25', () => {
      expect(applyTransform(fn, 4, IDENTITY_PARAMS)).toBeCloseTo(0.25, 6);
    });

    it('returns null at x = 0', () => {
      expect(applyTransform(fn, 0, IDENTITY_PARAMS)).toBeNull();
    });

    it('has no extraParams', () => {
      expect(fn.extraParams).toBeUndefined();
    });
  });

  describe('polyN (x^n)', () => {
    const fn = BASE_FUNCTIONS.polyN;

    it('computes 3^2 = 9 for n=2', () => {
      const y = applyTransform(fn, 3, IDENTITY_PARAMS, { n: 2 });
      expect(y).toBeCloseTo(9, 6);
    });

    it('computes 2^4 = 16 for n=4', () => {
      const y = applyTransform(fn, 2, IDENTITY_PARAMS, { n: 4 });
      expect(y).toBeCloseTo(16, 6);
    });

    it('computes 2^6 = 64 for n=6', () => {
      const y = applyTransform(fn, 2, IDENTITY_PARAMS, { n: 6 });
      expect(y).toBeCloseTo(64, 6);
    });

    it('has extraParams with key=n, integer=true, default=2', () => {
      expect(fn.extraParams).toHaveLength(1);
      expect(fn.extraParams![0].key).toBe('n');
      expect(fn.extraParams![0].integer).toBe(true);
      expect(fn.extraParams![0].default).toBe(2);
    });

    it('formatFormula substitutes n', () => {
      expect(formatFormula(fn, IDENTITY_PARAMS, { n: 5 })).toContain('5');
    });
  });

  describe('linear (x)', () => {
    const fn = BASE_FUNCTIONS.linear;

    it('computes y = x', () => {
      expect(applyTransform(fn, 7, IDENTITY_PARAMS)).toBeCloseTo(7, 6);
    });

    it('has no extraParams', () => {
      expect(fn.extraParams).toBeUndefined();
    });
  });

  describe('defaultExtraParams', () => {
    it('returns empty object for functions with no extraParams', () => {
      expect(defaultExtraParams(BASE_FUNCTIONS.sin)).toEqual({});
      expect(defaultExtraParams(BASE_FUNCTIONS.recip)).toEqual({});
    });

    it('seeds base=10 for logBase', () => {
      const extra = defaultExtraParams(BASE_FUNCTIONS.logBase);
      expect(extra.base).toBe(10);
    });

    it('seeds base=e for expBase', () => {
      const extra = defaultExtraParams(BASE_FUNCTIONS.expBase);
      expect(extra.base).toBeCloseTo(Math.E, 5);
    });

    it('seeds n=2 for polyN', () => {
      const extra = defaultExtraParams(BASE_FUNCTIONS.polyN);
      expect(extra.n).toBe(2);
    });
  });

  describe('sampleCurve with extra', () => {
    it('samples logBase correctly over positive x', () => {
      const pts = sampleCurve(
        BASE_FUNCTIONS.logBase,
        IDENTITY_PARAMS,
        { xMin: 1, xMax: 100, samples: 3 },
        { base: 10 },
      );
      expect(pts[0].y).toBeCloseTo(0, 5);   // log_10(1) = 0
      expect(pts[2].y).toBeCloseTo(2, 5);   // log_10(100) = 2
    });
  });
});
