/**
 * Tests for re-enabled checkDailyQuotaGuard() — S95-TEST-Q
 *
 * Cookie isolation: jsdom's cookie jar leaks across tests. We spy on
 * Document.prototype's cookie getter to always return '' so quotaRead()
 * always falls through to localStorage (the reliable path in jsdom).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkDailyQuotaGuard,
  markDailyQuotaExhausted,
  isDailyQuotaKnownExhausted,
  clearDailyQuotaFlag,
} from './core.quota';
import { RateLimitError } from '../apiErrors';

const STORAGE_KEY = 'ai_daily_quota_exhausted';

function writeQuota(offsetMs: number): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ exhaustedAt: new Date().toISOString(), nextResetMs: Date.now() + offsetMs }),
  );
}

// Spy is re-created each test so tests stay independent.
let cookieGetSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  // Make quotaRead() skip the cookie branch — always returns empty string.
  cookieGetSpy = vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('');
});

afterEach(() => {
  cookieGetSpy.mockRestore();
});

// ── checkDailyQuotaGuard ──────────────────────────────────────────────────────

describe('checkDailyQuotaGuard', () => {
  it('does not throw when no quota flag is set', () => {
    expect(() => checkDailyQuotaGuard()).not.toThrow();
  });

  it('throws RateLimitError when quota is exhausted and reset is in the future', () => {
    writeQuota(60 * 60 * 1000);
    expect(() => checkDailyQuotaGuard()).toThrowError(RateLimitError);
  });

  it('error message contains МК reset-time hint', () => {
    writeQuota(2 * 60 * 60 * 1000);
    let caught: unknown;
    try { checkDailyQuotaGuard(); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RateLimitError);
    expect((caught as RateLimitError).message).toMatch(/квота|09:00|исцрпена/i);
  });

  it('does not throw when nextResetMs is in the past (quota has reset)', () => {
    writeQuota(-5000);
    expect(() => checkDailyQuotaGuard()).not.toThrow();
  });

  it('clears stale quota flag when nextResetMs is in the past', () => {
    writeQuota(-5000);
    checkDailyQuotaGuard();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not throw when stored JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    expect(() => checkDailyQuotaGuard()).not.toThrow();
  });

  it('does not throw when nextResetMs field is missing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ exhaustedAt: new Date().toISOString() }));
    expect(() => checkDailyQuotaGuard()).not.toThrow();
  });
});

// ── markDailyQuotaExhausted ───────────────────────────────────────────────────

describe('markDailyQuotaExhausted', () => {
  it('writes a quota payload with future nextResetMs', () => {
    markDailyQuotaExhausted();
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.nextResetMs).toBeGreaterThan(Date.now());
    expect(parsed.exhaustedAt).toBeTruthy();
  });

  it('makes isDailyQuotaKnownExhausted return true immediately after', () => {
    markDailyQuotaExhausted();
    expect(isDailyQuotaKnownExhausted()).toBe(true);
  });
});

// ── isDailyQuotaKnownExhausted ────────────────────────────────────────────────

describe('isDailyQuotaKnownExhausted', () => {
  it('returns false when no flag is set', () => {
    expect(isDailyQuotaKnownExhausted()).toBe(false);
  });

  it('returns true when quota is set with future reset', () => {
    writeQuota(60 * 60 * 1000);
    expect(isDailyQuotaKnownExhausted()).toBe(true);
  });

  it('returns false when reset is in the past', () => {
    writeQuota(-5000);
    expect(isDailyQuotaKnownExhausted()).toBe(false);
  });
});

// ── clearDailyQuotaFlag ───────────────────────────────────────────────────────

describe('clearDailyQuotaFlag', () => {
  it('removes the quota flag from localStorage', () => {
    writeQuota(60 * 60 * 1000);
    clearDailyQuotaFlag();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(isDailyQuotaKnownExhausted()).toBe(false);
  });
});
