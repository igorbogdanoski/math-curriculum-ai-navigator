import { describe, it, expect } from 'vitest';
import {
  DUAL_MAP, SOLIDS, CONE_K, CONE_ALPHA_DEG, CONE_CRITICAL_THETA_DEG,
  computeConeCrossSection,
} from './geometry3dMath';

describe('DUAL_MAP', () => {
  it('cube and octahedron are mutual duals', () => {
    expect(DUAL_MAP.cube).toBe('octa');
    expect(DUAL_MAP.octa).toBe('cube');
  });

  it('dodecahedron and icosahedron are mutual duals', () => {
    expect(DUAL_MAP.dodeca).toBe('icosa');
    expect(DUAL_MAP.icosa).toBe('dodeca');
  });

  it('tetrahedron is self-dual', () => {
    expect(DUAL_MAP.tetra).toBe('tetra');
  });

  it('triangular prism and triangular antiprism are mutual duals', () => {
    expect(DUAL_MAP.triprism).toBe('triantiprism');
    expect(DUAL_MAP.triantiprism).toBe('triprism');
  });

  it('every DUAL_MAP entry points to a real solid id', () => {
    const ids = new Set(SOLIDS.map(s => s.id));
    for (const [from, to] of Object.entries(DUAL_MAP)) {
      expect(ids.has(from)).toBe(true);
      expect(ids.has(to)).toBe(true);
    }
  });

  it('duality is symmetric for every entry', () => {
    for (const [from, to] of Object.entries(DUAL_MAP)) {
      expect(DUAL_MAP[to]).toBe(from);
    }
  });
});

describe('SOLIDS — Euler characteristic', () => {
  it('every solid satisfies V - E + F = 2', () => {
    for (const s of SOLIDS) {
      expect(s.V - s.E + s.F).toBe(2);
    }
  });
});

describe('computeConeCrossSection', () => {
  it('horizontal cut (θ=0) through the mid-cone is a circle, not mislabeled as an ellipse', () => {
    const cs = computeConeCrossSection(0, 0);
    expect(cs.type).toBe('circle');
    expect(cs.r).toBeCloseTo(CONE_K * 1, 6); // z0 = 1-h = 1, r = k*z0
  });

  it('horizontal cut nearer the base gives a larger circle', () => {
    const nearApex = computeConeCrossSection(0.5, 0);
    const nearBase = computeConeCrossSection(-0.5, 0);
    expect(nearBase.r).toBeGreaterThan(nearApex.r);
  });

  it('cutting exactly at the apex collapses to a point', () => {
    const cs = computeConeCrossSection(0.99, 0);
    expect(cs.type).toBe('point');
  });

  it('θ below the critical angle yields an ellipse with a ≠ b', () => {
    const cs = computeConeCrossSection(0, CONE_CRITICAL_THETA_DEG - 10);
    expect(cs.type).toBe('ellipse');
    expect(cs.a).toBeGreaterThan(0);
    expect(cs.b).toBeGreaterThan(0);
    expect(Math.abs(cs.a - cs.b)).toBeGreaterThan(1e-3);
  });

  it('θ at the critical angle (plane parallel to a generator) yields a parabola', () => {
    const cs = computeConeCrossSection(0, CONE_CRITICAL_THETA_DEG);
    expect(cs.type).toBe('parabola');
    expect(cs.p).toBeGreaterThan(0);
  });

  it('θ above the critical angle yields a hyperbola', () => {
    const cs = computeConeCrossSection(0, CONE_CRITICAL_THETA_DEG + 10);
    expect(cs.type).toBe('hyperbola');
    expect(cs.a).toBeGreaterThan(0);
    expect(cs.b).toBeGreaterThan(0);
  });

  it('the critical angle is 90° minus the cone half-angle, not the half-angle itself', () => {
    // Regression guard for the θ<->90-α mislabeling caught while writing this test.
    expect(CONE_CRITICAL_THETA_DEG).toBeCloseTo(90 - CONE_ALPHA_DEG, 9);
    expect(CONE_CRITICAL_THETA_DEG).toBeCloseTo(63.4349, 3);
  });

  it('ellipse area matches π·a·b', () => {
    const cs = computeConeCrossSection(0, CONE_CRITICAL_THETA_DEG - 20);
    expect(cs.type).toBe('ellipse');
    expect(cs.area).toBeCloseTo(Math.PI * cs.a * cs.b, 6);
  });

  it('circle perimeter matches 2πr (Ramanujan approx collapses to exact for a=b)', () => {
    const cs = computeConeCrossSection(0, 0);
    expect(cs.type).toBe('circle');
    expect(cs.perim).toBeCloseTo(2 * Math.PI * cs.r, 6);
  });
});
