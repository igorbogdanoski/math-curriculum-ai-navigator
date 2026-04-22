/** SEC-5 — Tests for in-memory sliding-window rate-limit + IP extraction. */
import { describe, it, expect } from 'vitest';
import { checkSlidingWindow, extractClientIp } from './rateLimitInMemory';

describe('checkSlidingWindow', () => {
  const opts = (now: number) => ({ windowMs: 60_000, maxRequests: 3, now: () => now });

  it('allows up to maxRequests within window', () => {
    const store = new Map<string, number[]>();
    expect(checkSlidingWindow(store, 'u1', opts(1000))).toBe(true);
    expect(checkSlidingWindow(store, 'u1', opts(1100))).toBe(true);
    expect(checkSlidingWindow(store, 'u1', opts(1200))).toBe(true);
  });

  it('blocks the (max+1)-th request within window', () => {
    const store = new Map<string, number[]>();
    checkSlidingWindow(store, 'u1', opts(1000));
    checkSlidingWindow(store, 'u1', opts(1100));
    checkSlidingWindow(store, 'u1', opts(1200));
    expect(checkSlidingWindow(store, 'u1', opts(1300))).toBe(false);
  });

  it('allows again once oldest entries expire from window', () => {
    const store = new Map<string, number[]>();
    checkSlidingWindow(store, 'u1', opts(1000));
    checkSlidingWindow(store, 'u1', opts(1100));
    checkSlidingWindow(store, 'u1', opts(1200));
    // Advance past windowMs (60s) — all 3 entries expire
    expect(checkSlidingWindow(store, 'u1', opts(70_000))).toBe(true);
  });

  it('isolates counters per identifier', () => {
    const store = new Map<string, number[]>();
    checkSlidingWindow(store, 'u1', opts(1000));
    checkSlidingWindow(store, 'u1', opts(1100));
    checkSlidingWindow(store, 'u1', opts(1200));
    expect(checkSlidingWindow(store, 'u1', opts(1300))).toBe(false);
    expect(checkSlidingWindow(store, 'u2', opts(1300))).toBe(true);
  });

  it('garbage-collects expired timestamps when blocking', () => {
    const store = new Map<string, number[]>();
    // Fill window
    checkSlidingWindow(store, 'u1', opts(1000));
    checkSlidingWindow(store, 'u1', opts(2000));
    checkSlidingWindow(store, 'u1', opts(3000));
    // Past window — first three expire, but no new request added because blocked
    checkSlidingWindow(store, 'u1', { ...opts(70_000), maxRequests: 0 });
    expect(store.get('u1')?.length ?? 0).toBe(0);
  });
});

describe('extractClientIp', () => {
  it('returns first IP from x-forwarded-for chain', () => {
    expect(extractClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' })).toBe('1.2.3.4');
  });

  it('handles array-form x-forwarded-for', () => {
    expect(extractClientIp({ 'x-forwarded-for': ['10.0.0.1', '10.0.0.2'] })).toBe('10.0.0.1');
  });

  it('falls back to socketIp when XFF missing', () => {
    expect(extractClientIp({}, '192.168.1.1')).toBe('192.168.1.1');
  });

  it('returns undefined when no source available', () => {
    expect(extractClientIp({})).toBeUndefined();
  });

  it('trims whitespace from XFF entries', () => {
    expect(extractClientIp({ 'x-forwarded-for': '  203.0.113.5  ,  198.51.100.7' })).toBe('203.0.113.5');
  });

  it('prefers XFF over socket IP (Vercel edge case)', () => {
    expect(extractClientIp({ 'x-forwarded-for': '8.8.8.8' }, '127.0.0.1')).toBe('8.8.8.8');
  });
});
