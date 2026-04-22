/**
 * S37 — Pure helpers for AlgebraicIdentityViewer (a^3 - b^3 visual proof).
 *
 * The classic decomposition splits the volume `a^3 - b^3` into
 * three rectangular slabs whose total volume equals (a-b)(a^2 + ab + b^2):
 *
 *   slab 1: (a-b) × a × a       ← big horizontal slab on top
 *   slab 2: (a-b) × b × a       ← vertical slab on the side
 *   slab 3: (a-b) × b × b       ← small slab tucked in corner
 *
 * total = (a-b)·(a^2 + a·b + b^2) = a^3 - b^3   ✓
 */

export interface SlabDims {
  /** Width (a-b dimension). */ w: number;
  /** Depth.                   */ d: number;
  /** Height.                  */ h: number;
}

export interface IdentityDecomposition {
  slabs: [SlabDims, SlabDims, SlabDims];
  /** Sum of slab volumes — must equal a^3 - b^3 numerically. */
  totalVolume: number;
  /** Direct algebraic value: a^3 - b^3. */
  expectedVolume: number;
  /** Factorised form value: (a-b)(a^2 + a·b + b^2). */
  factorisedVolume: number;
}

/**
 * Decompose a^3 - b^3 into 3 slab volumes and return all three values
 * for visual proof (sum, direct, factorised) — the three MUST be equal
 * (within floating-point epsilon) for any valid 0 < b < a.
 */
export function decomposeAMinusBCubed(a: number, b: number): IdentityDecomposition {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('a and b must be finite numbers');
  }
  if (a <= 0 || b < 0) {
    throw new Error('a must be > 0 and b must be >= 0');
  }
  if (b >= a) {
    throw new Error('b must be strictly less than a for a positive difference');
  }

  const diff = a - b;
  const slabs: [SlabDims, SlabDims, SlabDims] = [
    { w: diff, d: a, h: a },
    { w: diff, d: b, h: a },
    { w: diff, d: b, h: b },
  ];
  const totalVolume = slabs.reduce((sum, s) => sum + s.w * s.d * s.h, 0);
  const expectedVolume = a ** 3 - b ** 3;
  const factorisedVolume = diff * (a * a + a * b + b * b);

  return { slabs, totalVolume, expectedVolume, factorisedVolume };
}

/** Format an a^3 - b^3 numeric value as a LaTeX-like string. */
export function formatIdentityFactored(a: number, b: number): string {
  return `(${a}-${b})\\cdot(${a}^2 + ${a}\\cdot${b} + ${b}^2)`;
}
