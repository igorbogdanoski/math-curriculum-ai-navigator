/**
 * Unit tests for api/_lib/costTracker (П26).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recordTokens,
  getUsageSnapshot,
  gcOldEntries,
  _resetForTests,
  DEFAULT_USER_DAILY_TOKEN_BUDGET,
  MODEL_DAILY_BUDGETS,
} from './costTracker';

describe('costTracker.recordTokens', () => {
  beforeEach(() => {
    _resetForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('aggregates tokensIn and tokensOut for a (user, model, day)', () => {
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 100, tokensOut: 50 });
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 25, tokensOut: 75 });
    const snap = getUsageSnapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0].tokensIn).toBe(125);
    expect(snap[0].tokensOut).toBe(125);
    expect(snap[0].total).toBe(250);
  });

  it('keeps separate buckets per model', () => {
    recordTokens({ userId: 'u1', model: 'gemini-2.5-pro', tokensIn: 1, tokensOut: 1 });
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 2, tokensOut: 2 });
    expect(getUsageSnapshot()).toHaveLength(2);
  });

  it('keeps separate buckets per user', () => {
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 1 });
    recordTokens({ userId: 'u2', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 1 });
    expect(getUsageSnapshot()).toHaveLength(2);
  });

  it('treats negative / NaN tokens as zero (defensive)', () => {
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: -5, tokensOut: Number.NaN });
    const snap = getUsageSnapshot();
    expect(snap[0].tokensIn).toBe(0);
    expect(snap[0].tokensOut).toBe(0);
  });

  it('warns once when total exceeds the per-model budget', () => {
    const warn = vi.spyOn(console, 'warn');
    const budget = MODEL_DAILY_BUDGETS['gemini-2.5-pro'];
    recordTokens({ userId: 'u1', model: 'gemini-2.5-pro', tokensIn: budget + 10, tokensOut: 0 });
    recordTokens({ userId: 'u1', model: 'gemini-2.5-pro', tokensIn: 10, tokensOut: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/\[cost-guard\]/);
  });

  it('uses DEFAULT_USER_DAILY_TOKEN_BUDGET for unknown models', () => {
    recordTokens({ userId: 'u1', model: 'gemini-X', tokensIn: 1, tokensOut: 0 });
    const snap = getUsageSnapshot();
    expect(snap[0].budget).toBe(DEFAULT_USER_DAILY_TOKEN_BUDGET);
  });

  it('flags overBudget=true once the total crosses the threshold', () => {
    const budget = MODEL_DAILY_BUDGETS['gemini-2.5-pro'];
    recordTokens({ userId: 'u1', model: 'gemini-2.5-pro', tokensIn: budget + 1, tokensOut: 0 });
    expect(getUsageSnapshot()[0].overBudget).toBe(true);
  });

  it('keys buckets per UTC day', () => {
    const day1 = Date.UTC(2026, 3, 18, 12, 0, 0);
    const day2 = Date.UTC(2026, 3, 19, 12, 0, 0);
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 0, now: day1 });
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 0, now: day2 });
    expect(getUsageSnapshot()).toHaveLength(2);
  });
});

describe('costTracker.gcOldEntries', () => {
  beforeEach(() => {
    _resetForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('removes entries older than the retention window', () => {
    const old = Date.UTC(2020, 0, 1);
    const now = Date.UTC(2026, 3, 18);
    recordTokens({ userId: 'u1', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 0, now: old });
    recordTokens({ userId: 'u2', model: 'gemini-2.5-flash', tokensIn: 1, tokensOut: 0, now });
    const removed = gcOldEntries(2, now);
    expect(removed).toBe(1);
    expect(getUsageSnapshot()).toHaveLength(1);
  });
});
