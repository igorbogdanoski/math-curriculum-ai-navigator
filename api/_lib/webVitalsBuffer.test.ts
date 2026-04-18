/**
 * Unit tests for api/_lib/webVitalsBuffer (П23).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  recordWebVital,
  getWebVitalsSnapshot,
  isSupportedMetric,
  quantile,
  _resetForTests,
  WEB_VITAL_BUDGETS,
  SUPPORTED_METRICS,
} from './webVitalsBuffer';

describe('webVitalsBuffer.quantile', () => {
  it('returns NaN for empty input', () => {
    expect(Number.isNaN(quantile([], 0.75))).toBe(true);
  });

  it('computes p50/p75/p95 with linear interpolation', () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(quantile(xs, 0.5)).toBeCloseTo(55, 5);
    expect(quantile(xs, 0.75)).toBeCloseTo(77.5, 5);
    expect(quantile(xs, 0.95)).toBeCloseTo(95.5, 5);
  });

  it('does not mutate the input array', () => {
    const xs = [3, 1, 2];
    quantile(xs, 0.75);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('webVitalsBuffer.isSupportedMetric', () => {
  it.each(SUPPORTED_METRICS)('accepts %s', (name) => {
    expect(isSupportedMetric(name)).toBe(true);
  });

  it('rejects unknown metric names and non-strings', () => {
    expect(isSupportedMetric('LCS')).toBe(false);
    expect(isSupportedMetric('')).toBe(false);
    expect(isSupportedMetric(123 as unknown)).toBe(false);
    expect(isSupportedMetric(null)).toBe(false);
  });
});

describe('webVitalsBuffer.recordWebVital', () => {
  beforeEach(() => _resetForTests());
  afterEach(() => _resetForTests());

  it('accepts a valid sample and exposes it via snapshot', () => {
    expect(recordWebVital('LCP', 1500)).toBe(true);
    const snap = getWebVitalsSnapshot();
    const lcp = snap.find(s => s.metric === 'LCP');
    expect(lcp).toBeDefined();
    expect(lcp!.count).toBe(1);
    expect(lcp!.budget).toBe(WEB_VITAL_BUDGETS.LCP);
  });

  it('rejects negative, NaN, Infinity and absurdly large values', () => {
    expect(recordWebVital('LCP', -1)).toBe(false);
    expect(recordWebVital('LCP', Number.NaN)).toBe(false);
    expect(recordWebVital('LCP', Infinity)).toBe(false);
    expect(recordWebVital('LCP', 1_000_000)).toBe(false);
    expect(getWebVitalsSnapshot()).toHaveLength(0);
  });

  it('rejects samples for unsupported metrics', () => {
    // @ts-expect-error — runtime guard test
    expect(recordWebVital('FOO', 100)).toBe(false);
    expect(getWebVitalsSnapshot()).toHaveLength(0);
  });

  it('caps the per-metric ring buffer at 200 samples', () => {
    for (let i = 0; i < 500; i++) recordWebVital('LCP', 100 + i);
    const lcp = getWebVitalsSnapshot().find(s => s.metric === 'LCP');
    expect(lcp!.count).toBe(200);
  });

  it('flags overBudget=true when p75 exceeds the Google "good" threshold', () => {
    for (let i = 0; i < 50; i++) recordWebVital('INP', 600); // poor across the board
    const inp = getWebVitalsSnapshot().find(s => s.metric === 'INP');
    expect(inp!.overBudget).toBe(true);
    expect(inp!.p75).toBeGreaterThan(WEB_VITAL_BUDGETS.INP);
  });

  it('flags overBudget=false when p75 is within budget', () => {
    for (let i = 0; i < 50; i++) recordWebVital('INP', 50);
    const inp = getWebVitalsSnapshot().find(s => s.metric === 'INP');
    expect(inp!.overBudget).toBe(false);
  });

  it('aggregates independently per metric', () => {
    recordWebVital('LCP', 1000);
    recordWebVital('CLS', 50);
    recordWebVital('TTFB', 200);
    const snap = getWebVitalsSnapshot();
    expect(snap.map(s => s.metric).sort()).toEqual(['CLS', 'LCP', 'TTFB']);
  });
});
