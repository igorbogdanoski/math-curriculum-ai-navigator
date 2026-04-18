/**
 * Unit tests for api/_lib/sloTracker
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recordLatency,
  getSloSnapshot,
  withLatencyTracking,
  quantile,
  _resetForTests,
  ROUTE_BUDGETS_MS,
} from './sloTracker';

describe('sloTracker.quantile', () => {
  it('returns NaN for empty array', () => {
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });

  it('returns the only element for a singleton', () => {
    expect(quantile([42], 0.5)).toBe(42);
    expect(quantile([42], 0.95)).toBe(42);
  });

  it('computes p50 and p95 correctly on a known sample', () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(quantile(xs, 0.5)).toBeCloseTo(55, 5);
    // p95 of 10 ascending values → ~95
    expect(quantile(xs, 0.95)).toBeCloseTo(95.5, 5);
  });

  it('does not mutate the input array', () => {
    const xs = [3, 1, 2];
    quantile(xs, 0.5);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('sloTracker.recordLatency + getSloSnapshot', () => {
  beforeEach(() => {
    _resetForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('aggregates samples per route', () => {
    for (let i = 1; i <= 5; i++) recordLatency('health', i * 10);
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap).toBeDefined();
    expect(snap!.count).toBe(5);
    expect(snap!.p50).toBeCloseTo(30, 5);
    expect(snap!.budget).toBe(ROUTE_BUDGETS_MS['health']);
  });

  it('warns when a single sample exceeds the route budget', () => {
    const warn = vi.spyOn(console, 'warn');
    recordLatency('health', ROUTE_BUDGETS_MS['health'] + 50);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/\[slo\]/);
  });

  it('does not warn for samples under budget', () => {
    const warn = vi.spyOn(console, 'warn');
    recordLatency('health', 10);
    expect(warn).not.toHaveBeenCalled();
  });

  it('flags overBudget=true in snapshot when p95 exceeds budget', () => {
    // Push 20 high values to drag p95 above the 500ms health budget
    for (let i = 0; i < 20; i++) recordLatency('health', 5_000);
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap!.overBudget).toBe(true);
  });

  it('caps in-memory samples to 100 per route (FIFO ring)', () => {
    for (let i = 0; i < 250; i++) recordLatency('health', 1);
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap!.count).toBe(100);
  });

  it('ignores non-finite or negative samples', () => {
    recordLatency('health', Number.NaN);
    recordLatency('health', -1);
    recordLatency('health', Infinity);
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap).toBeUndefined();
  });

  it('uses DEFAULT_P95_BUDGET_MS for unknown routes', () => {
    recordLatency('unknown-route', 100);
    const snap = getSloSnapshot().find(s => s.route === 'unknown-route');
    expect(snap!.budget).toBeGreaterThan(0);
  });
});

describe('sloTracker.withLatencyTracking', () => {
  beforeEach(() => {
    _resetForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('records latency for resolved promises', async () => {
    const result = await withLatencyTracking('health', async () => 'ok');
    expect(result).toBe('ok');
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap!.count).toBe(1);
  });

  it('records latency even when the wrapped fn throws', async () => {
    await expect(
      withLatencyTracking('health', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const snap = getSloSnapshot().find(s => s.route === 'health');
    expect(snap!.count).toBe(1);
  });
});
