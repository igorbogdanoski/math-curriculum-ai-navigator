/**
 * Pure helpers for InequalitySolver (T4.4).
 *
 * Supports two inequality kinds:
 *   1. Absolute-value: |x − a| <op> b  (op ∈ '<', '<=', '>', '>=').
 *   2. Polynomial:     p(x) <op> 0     (factored into real linear roots).
 */

export type CmpOp = '<' | '<=' | '>' | '>=';

// ─── Interval algebra ───────────────────────────────────────────────────────

export interface Interval {
  lo: number;          // -Infinity for unbounded
  hi: number;          //  Infinity for unbounded
  loInclusive: boolean;
  hiInclusive: boolean;
}

export const FULL_REAL: Interval = { lo: -Infinity, hi: Infinity, loInclusive: false, hiInclusive: false };

export function formatInterval(iv: Interval): string {
  const lb = iv.loInclusive ? '[' : '(';
  const rb = iv.hiInclusive ? ']' : ')';
  const lo = iv.lo === -Infinity ? '−∞' : numStr(iv.lo);
  const hi = iv.hi === Infinity ? '+∞' : numStr(iv.hi);
  return `${lb}${lo}, ${hi}${rb}`;
}

export function formatSolution(intervals: Interval[]): string {
  if (intervals.length === 0) return '∅';
  return intervals.map(formatInterval).join(' ∪ ');
}

function numStr(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// ─── Absolute-value inequalities ────────────────────────────────────────────

export interface AbsInequality {
  /** Center of the absolute value: |x − a|. */
  a: number;
  /** Right-hand side. */
  b: number;
  op: CmpOp;
}

export function solveAbs(ineq: AbsInequality): Interval[] {
  const { a, b, op } = ineq;

  // |x − a| < b: empty if b ≤ 0; (a−b, a+b) otherwise.
  if (op === '<') {
    if (b <= 0) return [];
    return [{ lo: a - b, hi: a + b, loInclusive: false, hiInclusive: false }];
  }
  // |x − a| ≤ b
  if (op === '<=') {
    if (b < 0) return [];
    if (b === 0) return [{ lo: a, hi: a, loInclusive: true, hiInclusive: true }];
    return [{ lo: a - b, hi: a + b, loInclusive: true, hiInclusive: true }];
  }
  // |x − a| > b: all reals minus [a−b, a+b]
  if (op === '>') {
    if (b < 0) return [{ ...FULL_REAL }];
    if (b === 0) {
      // x ≠ a
      return [
        { lo: -Infinity, hi: a, loInclusive: false, hiInclusive: false },
        { lo: a, hi: Infinity, loInclusive: false, hiInclusive: false },
      ];
    }
    return [
      { lo: -Infinity, hi: a - b, loInclusive: false, hiInclusive: false },
      { lo: a + b, hi: Infinity, loInclusive: false, hiInclusive: false },
    ];
  }
  // op === '>='
  if (b <= 0) return [{ ...FULL_REAL }];
  return [
    { lo: -Infinity, hi: a - b, loInclusive: false, hiInclusive: true },
    { lo: a + b, hi: Infinity, loInclusive: true, hiInclusive: false },
  ];
}

// ─── Polynomial inequalities (sign chart) ───────────────────────────────────

export interface PolyInequality {
  /** Distinct real roots, in any order. */
  roots: number[];
  /** Sign of the leading coefficient (defaults to +1). */
  leading?: 1 | -1;
  op: CmpOp;
}

/**
 * Builds the sign of the polynomial in each interval defined by sorted
 * distinct roots. With distinct simple roots, the sign alternates.
 *
 * Returns: (intervals between roots, sign of polynomial in each interval)
 */
export function buildSignChart(rootsIn: number[], leading: 1 | -1 = 1): {
  partition: number[];
  signs: (1 | -1)[];
} {
  const sorted = Array.from(new Set(rootsIn)).sort((a, b) => a - b);
  const n = sorted.length;
  // n+1 intervals: (-∞, r0), (r0, r1), ..., (r_{n-1}, ∞)
  // Sign at +∞ equals sign(leading), then alternates going left.
  const signs: (1 | -1)[] = new Array(n + 1).fill(1);
  signs[n] = leading;
  for (let i = n - 1; i >= 0; i -= 1) {
    signs[i] = (signs[i + 1] * -1) as 1 | -1;
  }
  return { partition: sorted, signs };
}

export function solvePolynomial(ineq: PolyInequality): Interval[] {
  const leading = ineq.leading ?? 1;
  const { partition, signs } = buildSignChart(ineq.roots, leading);
  const wantPositive = ineq.op === '>' || ineq.op === '>=';
  const inclusive = ineq.op === '<=' || ineq.op === '>=';

  const out: Interval[] = [];
  for (let i = 0; i < signs.length; i += 1) {
    const positive = signs[i] === 1;
    if (positive !== wantPositive) continue;
    const lo = i === 0 ? -Infinity : partition[i - 1];
    const hi = i === signs.length - 1 ? Infinity : partition[i];
    out.push({
      lo,
      hi,
      loInclusive: inclusive && lo !== -Infinity,
      hiInclusive: inclusive && hi !== Infinity,
    });
  }
  // If the inequality is non-strict, also include the roots that aren't
  // covered (when their adjacent intervals have the wrong sign).
  if (inclusive) {
    for (const r of partition) {
      const inSome = out.some((iv) => (iv.lo === r && iv.loInclusive) || (iv.hi === r && iv.hiInclusive));
      if (!inSome) out.push({ lo: r, hi: r, loInclusive: true, hiInclusive: true });
    }
    out.sort((a, b) => a.lo - b.lo);
  }
  return out;
}

// ─── Number-line render data ────────────────────────────────────────────────

export interface NumberLinePoint {
  x: number;
  filled: boolean;        // closed (≤/≥) or open (</>)
}

export interface NumberLineSegment {
  from: number;
  to: number;
  fromInclusive: boolean;
  toInclusive: boolean;
}

export interface NumberLineData {
  points: NumberLinePoint[];
  segments: NumberLineSegment[];
  /** Suggested x-range so the picture isn't empty when intervals are unbounded. */
  range: { min: number; max: number };
}

export function buildNumberLine(intervals: Interval[], pad: number = 2): NumberLineData {
  const finiteVals: number[] = [];
  for (const iv of intervals) {
    if (Number.isFinite(iv.lo)) finiteVals.push(iv.lo);
    if (Number.isFinite(iv.hi)) finiteVals.push(iv.hi);
  }
  const min = finiteVals.length ? Math.min(...finiteVals) - pad : -pad;
  const max = finiteVals.length ? Math.max(...finiteVals) + pad : pad;

  const points: NumberLinePoint[] = [];
  const segments: NumberLineSegment[] = [];
  for (const iv of intervals) {
    if (Number.isFinite(iv.lo)) points.push({ x: iv.lo, filled: iv.loInclusive });
    if (Number.isFinite(iv.hi)) points.push({ x: iv.hi, filled: iv.hiInclusive });
    segments.push({
      from: Number.isFinite(iv.lo) ? iv.lo : min,
      to: Number.isFinite(iv.hi) ? iv.hi : max,
      fromInclusive: iv.loInclusive,
      toInclusive: iv.hiInclusive,
    });
  }
  return { points, segments, range: { min, max } };
}
