/**
 * api/_lib/sloTracker.ts — latency tracking for API routes.
 *
 * Two layers:
 *   1. An in-memory p50/p95 ring buffer, scoped to a single warm container —
 *      cheap, always-on, catches obvious p95 regressions on whichever
 *      instance happens to be warm, but resets on every cold start and never
 *      reflects the whole fleet.
 *   2. A fire-and-forget Firestore histogram (`slo_histograms`), bucketed per
 *      route per hour via atomic increments — one small doc per route per
 *      hour, bounded and cheap, aggregated fleet-wide by /api/slo-summary for
 *      the admin-only /slo dashboard's "AI Latency" panel.
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
  persistHistogramSample(route, ms);

  const budget = ROUTE_BUDGETS_MS[route] ?? DEFAULT_P95_BUDGET_MS;
  if (ms > budget) {
    // Single-line, structured to make grep/Sentry breadcrumb integration trivial.
    // eslint-disable-next-line no-console
    console.warn(
      `[slo] route=${route} latency=${ms.toFixed(0)}ms exceeds budget=${budget}ms`,
    );
  }
}

// ─── Fleet-wide histogram persistence (Firestore) ──────────────────────────────

/** Upper bound (exclusive) of each bucket, in ms. The last bucket is open-ended ("_plus"). */
export const HISTOGRAM_BUCKET_BOUNDARIES_MS = [500, 1000, 2000, 4000, 8000, 16000] as const;

/** Maps a latency to its histogram bucket's Firestore field name. Exported for unit testing. */
export function bucketFieldFor(ms: number): string {
  let lo = 0;
  for (const hi of HISTOGRAM_BUCKET_BOUNDARIES_MS) {
    if (ms < hi) return `bucket_${lo}_${hi}`;
    lo = hi;
  }
  return `bucket_${lo}_plus`;
}

/** `YYYYMMDDHH` bucket for the current hour — keeps `slo_histograms` docs small and bounded. */
export function currentHourKey(): string {
  return new Date().toISOString().slice(0, 13).replace(/[-:T]/g, '');
}

/**
 * Fire-and-forget: atomically increments the current hour's histogram bucket
 * for this route in Firestore. Never awaited by callers, never throws — a
 * missed sample is an acceptable loss, blocking the response is not (same
 * convention as deductCreditsServerSide in api/_lib/aiCredits.ts).
 */
function persistHistogramSample(route: string, ms: number): void {
  void (async () => {
    try {
      const { getFirebaseAdmin } = await import('./sharedUtils.js');
      if (!getFirebaseAdmin()) return; // local dev without a service account — no-op

      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
      const hourKey = currentHourKey();
      const bucket = bucketFieldFor(ms);
      await getFirestore().collection('slo_histograms').doc(`${route}_${hourKey}`).set(
        {
          [bucket]: FieldValue.increment(1),
          count: FieldValue.increment(1),
          route,
          hourKey,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error('[slo] failed to persist histogram sample:', err);
    }
  })();
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
