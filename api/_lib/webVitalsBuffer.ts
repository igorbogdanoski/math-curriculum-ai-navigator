/**
 * api/_lib/webVitalsBuffer.ts — In-memory ring buffer for Core Web Vitals.
 *
 * Receives one beacon per metric (LCP/CLS/INP/FCP/TTFB), keeps the last
 * MAX_SAMPLES_PER_METRIC values per metric in a fixed-size FIFO ring, and
 * computes p50/p75/p95 on demand.
 *
 * S40-M1: samples are now also bucketed by device type
 * (mobile/tablet/desktop/unknown) so dashboards can split p75 by form factor.
 *
 * Vercel serverless cold starts will drop the buffer; this is intentional —
 * the goal is a cheap always-on signal that catches obvious p75 regressions
 * on a single warm container, complementing the Sentry stream.
 *
 * Google "good" thresholds (used to flag overBudget):
 *   LCP  < 2500 ms
 *   CLS  < 0.1   (we store *1000 to keep an integer scale)
 *   INP  < 200 ms
 *   FCP  < 1800 ms
 *   TTFB < 800 ms
 */

const MAX_SAMPLES_PER_METRIC = 200;

export const SUPPORTED_METRICS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;
export type WebVitalName = typeof SUPPORTED_METRICS[number];

export const SUPPORTED_DEVICES = ['mobile', 'tablet', 'desktop', 'unknown'] as const;
export type DeviceType = typeof SUPPORTED_DEVICES[number];

/**
 * "Good" budget by Google. CLS is stored as `value * 1000` to remain an
 * integer scale consistent with the other metrics in the buffer.
 */
export const WEB_VITAL_BUDGETS: Readonly<Record<WebVitalName, number>> = Object.freeze({
  LCP: 2500,
  CLS: 100,    // 0.1 * 1000
  INP: 200,
  FCP: 1800,
  TTFB: 800,
});

// Map<metric, Map<device, samples[]>>
const samples = new Map<WebVitalName, Map<DeviceType, number[]>>();

function pushSample(metric: WebVitalName, device: DeviceType, value: number): void {
  let perDevice = samples.get(metric);
  if (!perDevice) {
    perDevice = new Map();
    samples.set(metric, perDevice);
  }
  let arr = perDevice.get(device);
  if (!arr) {
    arr = [];
    perDevice.set(device, arr);
  }
  arr.push(value);
  if (arr.length > MAX_SAMPLES_PER_METRIC) {
    arr.splice(0, arr.length - MAX_SAMPLES_PER_METRIC);
  }
}

/** Linear-interpolation quantile (0..1). NaN for empty input. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (pos - lo)) + sorted[hi] * (pos - lo);
}

export function isSupportedMetric(name: unknown): name is WebVitalName {
  return typeof name === 'string' && (SUPPORTED_METRICS as readonly string[]).includes(name);
}

export function isSupportedDevice(name: unknown): name is DeviceType {
  return typeof name === 'string' && (SUPPORTED_DEVICES as readonly string[]).includes(name);
}

export function normalizeDevice(input: unknown): DeviceType {
  return isSupportedDevice(input) ? input : 'unknown';
}

/**
 * Record a single web vital sample. Returns true on success, false if
 * the metric/value pair is invalid (silently dropped — beacons are noisy).
 *
 * `device` is optional; unknown / missing values are bucketed as 'unknown'
 * so legacy clients keep working until they upgrade.
 */
export function recordWebVital(name: WebVitalName, value: number, device: DeviceType = 'unknown'): boolean {
  if (!isSupportedMetric(name)) return false;
  if (!Number.isFinite(value) || value < 0 || value > 600_000) return false;
  pushSample(name, normalizeDevice(device), value);
  return true;
}

export interface WebVitalSnapshot {
  metric: WebVitalName;
  count: number;
  p50: number;
  p75: number;
  p95: number;
  budget: number;
  overBudget: boolean;
}

export interface WebVitalDeviceSnapshot extends WebVitalSnapshot {
  device: DeviceType;
}

function flattenMetric(metric: WebVitalName): number[] {
  const perDevice = samples.get(metric);
  if (!perDevice) return [];
  const out: number[] = [];
  for (const arr of perDevice.values()) out.push(...arr);
  return out;
}

function buildSnapshot(metric: WebVitalName, arr: readonly number[]): WebVitalSnapshot {
  const budget = WEB_VITAL_BUDGETS[metric];
  const p75 = quantile(arr, 0.75);
  return {
    metric,
    count: arr.length,
    p50: quantile(arr, 0.5),
    p75,
    p95: quantile(arr, 0.95),
    budget,
    overBudget: p75 > budget,
  };
}

/** Snapshot of all observed metrics — surfaced to admin dashboards. */
export function getWebVitalsSnapshot(): WebVitalSnapshot[] {
  const out: WebVitalSnapshot[] = [];
  for (const metric of SUPPORTED_METRICS) {
    const arr = flattenMetric(metric);
    if (arr.length === 0) continue;
    out.push(buildSnapshot(metric, arr));
  }
  return out;
}

/** Snapshot split by device type — for S40-M1 dashboards. */
export function getWebVitalsSnapshotByDevice(): WebVitalDeviceSnapshot[] {
  const out: WebVitalDeviceSnapshot[] = [];
  for (const metric of SUPPORTED_METRICS) {
    const perDevice = samples.get(metric);
    if (!perDevice) continue;
    for (const device of SUPPORTED_DEVICES) {
      const arr = perDevice.get(device);
      if (!arr || arr.length === 0) continue;
      out.push({ ...buildSnapshot(metric, arr), device });
    }
  }
  return out;
}

/** Test-only helper — clears the in-memory buffer between cases. */
export function _resetForTests(): void {
  samples.clear();
}
