import { describe, it, expect } from 'vitest';
import {
  classifyConic, clampHalf, describeConic, eccentricity, sampleConic,
} from './conicSectionHelpers';

const deg = (d: number) => (d * Math.PI) / 180;

describe('conicSectionHelpers', () => {
  describe('clampHalf', () => {
    it('clamps to [0, π/2]', () => {
      expect(clampHalf(-1)).toBe(0);
      expect(clampHalf(Math.PI)).toBeCloseTo(Math.PI / 2);
      expect(clampHalf(1)).toBe(1);
    });
    it('returns 0 for non-finite', () => {
      expect(clampHalf(NaN)).toBe(0);
    });
  });

  describe('classifyConic', () => {
    it('β = 90° → circle', () => {
      expect(classifyConic({ alpha: deg(30), beta: deg(90) })).toBe('circle');
    });
    it('α < β < 90° → ellipse', () => {
      expect(classifyConic({ alpha: deg(30), beta: deg(60) })).toBe('ellipse');
    });
    it('β = α → parabola', () => {
      expect(classifyConic({ alpha: deg(30), beta: deg(30) })).toBe('parabola');
    });
    it('β < α → hyperbola', () => {
      expect(classifyConic({ alpha: deg(40), beta: deg(20) })).toBe('hyperbola');
    });
  });

  describe('eccentricity', () => {
    it('circle has e ≈ 0', () => {
      const e = eccentricity({ alpha: deg(30), beta: deg(90) });
      expect(e).toBeCloseTo(0, 3);
    });
    it('parabola has e = 1', () => {
      const e = eccentricity({ alpha: deg(30), beta: deg(30) });
      expect(e).toBeCloseTo(1, 6);
    });
    it('ellipse has 0 < e < 1', () => {
      const e = eccentricity({ alpha: deg(30), beta: deg(60) });
      expect(e).toBeGreaterThan(0);
      expect(e).toBeLessThan(1);
    });
    it('hyperbola has e > 1', () => {
      const e = eccentricity({ alpha: deg(45), beta: deg(20) });
      expect(e).toBeGreaterThan(1);
    });
  });

  describe('describeConic', () => {
    it('parabola sets p > 0 and equation contains y²', () => {
      const d = describeConic({ alpha: deg(30), beta: deg(30) });
      expect(d.kind).toBe('parabola');
      expect(d.params.p).toBeGreaterThan(0);
      expect(d.equation).toContain('y²');
    });

    it('ellipse has a >= b', () => {
      const d = describeConic({ alpha: deg(30), beta: deg(70) });
      expect(d.kind).toBe('ellipse');
      expect(d.params.a).toBeDefined();
      expect(d.params.b).toBeDefined();
      expect(d.params.a!).toBeGreaterThanOrEqual(d.params.b!);
    });

    it('hyperbola equation has minus', () => {
      const d = describeConic({ alpha: deg(50), beta: deg(20) });
      expect(d.kind).toBe('hyperbola');
      expect(d.equation).toContain('−');
    });
  });

  describe('sampleConic', () => {
    it('ellipse returns one closed branch', () => {
      const p = sampleConic({ alpha: deg(30), beta: deg(70) }, { samples: 50 });
      expect(p.branches.length).toBe(1);
      expect(p.branches[0].length).toBe(51);
    });

    it('hyperbola returns two branches', () => {
      const p = sampleConic({ alpha: deg(50), beta: deg(20) });
      expect(p.branches.length).toBe(2);
    });

    it('parabola samples have y in [-range, range]', () => {
      const p = sampleConic({ alpha: deg(30), beta: deg(30) }, { samples: 20, range: 1 });
      for (const pt of p.branches[0]) {
        expect(pt.y).toBeGreaterThanOrEqual(-1.0001);
        expect(pt.y).toBeLessThanOrEqual(1.0001);
      }
    });
  });
});
