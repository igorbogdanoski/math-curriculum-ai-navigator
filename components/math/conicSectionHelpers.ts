/**
 * Pure helpers for ConicSectionExplorer (T4.3).
 *
 * The user picks a tilt angle for the cutting plane vs. the cone axis. The
 * resulting curve is classified as circle/ellipse/parabola/hyperbola, and we
 * provide canonical-form parameters and the SVG sample points to draw it.
 *
 * Convention:
 *   - Cone half-angle α (radians) is the angle between the axis and the slant.
 *   - Plane tilt β (radians) is the angle between the cutting plane and the
 *     cone axis. β = 90° → plane perpendicular to axis → circle.
 *
 * Classification (Dandelin):
 *   β = 90°               → circle
 *   α < β  < 90°          → ellipse
 *   β = α                 → parabola
 *   0 ≤ β  < α            → hyperbola
 */

export type ConicKind = 'circle' | 'ellipse' | 'parabola' | 'hyperbola';

export interface ConicConfig {
  /** Cone half-angle in radians. */
  alpha: number;
  /** Plane tilt vs axis, in radians. */
  beta: number;
}

export interface ConicResult {
  kind: ConicKind;
  /** Eccentricity. */
  e: number;
  /** Canonical-form description (Macedonian). */
  equation: string;
  /** Numeric-axis params for the SVG plot (a, b for ellipse; p for parabola; a/b for hyperbola). */
  params: { a?: number; b?: number; p?: number };
}

const TAU = Math.PI * 2;

/** Wrap an angle into [0, π/2]. */
export function clampHalf(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  if (angle < 0) return 0;
  if (angle > Math.PI / 2) return Math.PI / 2;
  return angle;
}

export function classifyConic({ alpha, beta }: ConicConfig): ConicKind {
  const a = clampHalf(alpha);
  const b = clampHalf(beta);
  const eps = 1e-3;
  if (Math.abs(b - Math.PI / 2) < eps) return 'circle';
  if (Math.abs(b - a) < eps) return 'parabola';
  if (b > a) return 'ellipse';
  return 'hyperbola';
}

/**
 * Eccentricity for the conic (Dandelin):
 *   e = cos(β) / cos(α)
 * Capped at 0..~3 for plotting purposes.
 */
export function eccentricity({ alpha, beta }: ConicConfig): number {
  const denom = Math.cos(clampHalf(alpha));
  if (Math.abs(denom) < 1e-6) return 1;
  return Math.cos(clampHalf(beta)) / denom;
}

export function describeConic(cfg: ConicConfig): ConicResult {
  const kind = classifyConic(cfg);
  const e = eccentricity(cfg);

  if (kind === 'circle') {
    const r = 1;
    return {
      kind, e: 0,
      equation: 'x² + y² = 1',
      params: { a: r, b: r },
    };
  }

  if (kind === 'ellipse') {
    // Choose semi-major a = 1, then b = √(1 − e²).
    const a = 1;
    const b = Math.sqrt(Math.max(0, 1 - e * e));
    return {
      kind, e,
      equation: `x²/${a.toFixed(2)}² + y²/${b.toFixed(2)}² = 1`,
      params: { a, b },
    };
  }

  if (kind === 'parabola') {
    const p = 0.5;
    return {
      kind, e: 1,
      equation: `y² = ${(2 * p).toFixed(2)}x`,
      params: { p },
    };
  }

  // hyperbola
  const a = 1;
  const b = Math.sqrt(Math.max(0, e * e - 1));
  return {
    kind, e,
    equation: `x²/${a.toFixed(2)}² − y²/${b.toFixed(2)}² = 1`,
    params: { a, b },
  };
}

export interface ConicPathOptions {
  /** Number of sample points per curve branch. */
  samples?: number;
  /** Half-range to plot for parabola/hyperbola (in math units). */
  range?: number;
}

export interface ConicPath {
  /** SVG points in math coords (caller scales to viewBox). */
  branches: Array<Array<{ x: number; y: number }>>;
}

export function sampleConic(cfg: ConicConfig, opts: ConicPathOptions = {}): ConicPath {
  const samples = opts.samples ?? 200;
  const range = opts.range ?? 2;
  const desc = describeConic(cfg);

  if (desc.kind === 'circle' || desc.kind === 'ellipse') {
    const a = desc.params.a ?? 1;
    const b = desc.params.b ?? 1;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = (i / samples) * TAU;
      pts.push({ x: a * Math.cos(t), y: b * Math.sin(t) });
    }
    return { branches: [pts] };
  }

  if (desc.kind === 'parabola') {
    const p = desc.params.p ?? 0.5;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const y = -range + (2 * range * i) / samples;
      pts.push({ x: (y * y) / (2 * p), y });
    }
    return { branches: [pts] };
  }

  // hyperbola: x²/a² − y²/b² = 1 has two branches at x ≥ a and x ≤ −a.
  const a = desc.params.a ?? 1;
  const b = desc.params.b ?? 1;
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = -1.5 + (3 * i) / samples; // parametrise via cosh / sinh
    const ch = Math.cosh(t);
    const sh = Math.sinh(t);
    right.push({ x: a * ch, y: b * sh });
    left.push({ x: -a * ch, y: b * sh });
  }
  return { branches: [right, left] };
}
