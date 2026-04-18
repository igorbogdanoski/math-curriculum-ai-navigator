/**
 * api/_lib/sloTracker.ts — In-memory p50/p95 latency tracker for API routes.
 *
 * Vercel serverless functions can't share state across cold starts, so this
 * is a best-effort observability primitive that:
 *   - Records the last N samples per route in a fixed-size ring buffer
 *   - Computes p50/p95 on demand
 *   - Emits a console.warn when a recorded latency exceeds the route's
 *     configured budget — surfaces in Vercel logs / Sentry breadcrumbs
 *
 * For real SLO dashboards, route the warn lines into Sentry/Datadog or
 * forward Vercel runtime logs to your APM. This module is the cheap
 * always-on signal that catches obvious p95 regressions on a single
 * warm container.
 */

const MAX_SAMPLES_PER_ROUTE = 100;

/** Default p95 budget (ms) per route. Override via ROUTE_BUDGETS_MS. */
export const DEFAULT_P95_BUDGET_MS = 8_000;

/** Per-route p95 budgets (ms). Anything not listed uses DEFAULT_P95_BUDGET_MS. */
export const ROUTE_BUDGETS_MS: Readonly<Record<string, number>> = Object.freeze({
  'gemini-proxy': 12_000,    // Vision + thinking can legitimately take longer
  'embedding-proxy': 3_000,
  'youtube-captions': 6_000,
  'webpage-extract': 6_000,
  'health': 500,
});

const samples = new Map<string, number[]>();

function pushSample(route: string, ms: number): void {
  let arr = samples.get(route);
  if (!arr) {
    arr = [];
    samples.set(route, arr);
  }
  arr.push(ms);
  if (arr.length > MAX_SAMPLES_PER_ROUTE) {
    arr.splice(0, arr.length - MAX_SAMPLES_PER_ROUTE);
  }
}

/**
 * Quantile q (0..1) over a numeric array using linear interpolation.
 * Returns NaN for empty input.
 */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Record one observed latency for a route. Triggers a single console.warn
 * if the value exceeds the route's p95 budget.
 */
export function recordLatency(route: string, ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  pushSample(route, ms);

  const budget = ROUTE_BUDGETS_MS[route] ?? DEFAULT_P95_BUDGET_MS;
  if (ms > budget) {
    // Single-line, structured to make grep/Sentry breadcrumb integration trivial.
    // eslint-disable-next-line no-console
    console.warn(
      `[slo] route=${route} latency=${ms.toFixed(0)}ms exceeds budget=${budget}ms`,
    );
  }
}

export interface RouteSloSnapshot {
  route: string;
  count: number;
  p50: number;
  p95: number;
  budget: number;
  overBudget: boolean;
}

/** Snapshot of all tracked routes — useful for /api/health debug payloads. */
export function getSloSnapshot(): RouteSloSnapshot[] {
  const out: RouteSloSnapshot[] = [];
  for (const [route, arr] of samples.entries()) {
    const p95 = quantile(arr, 0.95);
    const budget = ROUTE_BUDGETS_MS[route] ?? DEFAULT_P95_BUDGET_MS;
    out.push({
      route,
      count: arr.length,
      p50: quantile(arr, 0.5),
      p95,
      budget,
      overBudget: p95 > budget,
    });
  }
  return out;
}

/** Wrap an async handler with automatic latency recording. */
export async function withLatencyTracking<T>(
  route: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    recordLatency(route, Date.now() - start);
  }
}

/** Test-only helper to reset internal state. Not exported via index. */
export function _resetForTests(): void {
  samples.clear();
}
