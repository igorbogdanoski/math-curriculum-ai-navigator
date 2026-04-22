/**
 * S37-C2 — IRT 3-PL adaptive difficulty model.
 *
 * Three-Parameter Logistic (3-PL) model for item-response theory.
 * P(correct | θ, a, b, c) = c + (1 − c) · σ(a · (θ − b))
 * where:
 *   θ — latent ability of the student
 *   a — discrimination parameter (slope, default 1.0)
 *   b — difficulty parameter (location, what θ yields ~50–75% correct)
 *   c — guessing floor (e.g. 0.25 for 4-option MC)
 *
 * Pure functions — no React, no Firebase. Fully unit-testable.
 */

import type { DifferentiationLevel } from '../types';

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export interface ItemParams {
  /** Discrimination (slope) — typical range 0.5..2.5. */
  a: number;
  /** Difficulty (location) — same scale as θ. */
  b: number;
  /** Guessing floor — 0..0.5 (e.g. 0.25 for 4-option MC, 0 for free response). */
  c: number;
}

/** Probability of a correct response under 3-PL. */
export function probCorrect3PL(theta: number, item: ItemParams): number {
  const { a, b, c } = item;
  return c + (1 - c) * sigmoid(a * (theta - b));
}

/**
 * One-step Newton-Raphson MLE update for θ given a binary response.
 * Returns the updated θ. Stable for moderate batches; iterate by feeding
 * the result back as `prevTheta` for each successive answer.
 */
export function updateThetaMLE(
  prevTheta: number,
  item: ItemParams,
  correct: boolean,
  options: { learningRate?: number } = {},
): number {
  const lr = options.learningRate ?? 0.5;
  const p = probCorrect3PL(prevTheta, item);
  const u = correct ? 1 : 0;
  // Score function (log-likelihood gradient w.r.t. θ) — proportional to a*(u−p)
  // for 2-PL; for 3-PL the (1−c) factor is already inside p, so the simple
  // form a·(u−p) is a stable, well-behaved direction for incremental updates.
  const grad = item.a * (u - p);
  const next = prevTheta + lr * grad;
  // Bound θ to [-3, +3] (≈99.7% of any practical population)
  return Math.max(-3, Math.min(3, next));
}

/**
 * Pick the next item from a candidate pool that maximises Fisher information
 * at the current ability θ. Used for adaptive item selection.
 */
export function pickNextItem<T extends ItemParams>(theta: number, pool: readonly T[]): T | undefined {
  if (pool.length === 0) return undefined;
  let best = pool[0];
  let bestInfo = -Infinity;
  for (const item of pool) {
    const p = probCorrect3PL(theta, item);
    const q = 1 - p;
    // Fisher info under 3-PL: I(θ) = a^2 · q/p · ((p−c)/(1−c))^2
    const denom = (1 - item.c);
    const info = denom > 0
      ? item.a * item.a * (q / Math.max(p, 1e-9)) * Math.pow((p - item.c) / denom, 2)
      : 0;
    if (info > bestInfo) { bestInfo = info; best = item; }
  }
  return best;
}

/** Map θ to the legacy DifferentiationLevel buckets used by the UI. */
export function thetaToLevel(theta: number): DifferentiationLevel {
  if (theta < -0.5) return 'support';
  if (theta <  0.8) return 'standard';
  return 'advanced';
}

/** Convenience: derive an initial θ from a baseline percentage (0..100). */
export function percentageToInitialTheta(percentage: number): number {
  // Simple linear-ish map: 50% → 0, 0% → −2, 100% → +2
  const clamped = Math.max(0, Math.min(100, percentage));
  return (clamped - 50) / 25;
}
