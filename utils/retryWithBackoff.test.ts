import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, circuitBreakerCall } from './retryWithBackoff';
import { RateLimitError } from '../services/apiErrors';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSucceedAfter(failCount: number, failWith: unknown, returnValue = 'ok') {
  let calls = 0;
  return vi.fn(async () => {
    if (calls++ < failCount) throw failWith;
    return returnValue;
  });
}

// ── retryWithBackoff ──────────────────────────────────────────────────────────

describe('retryWithBackoff', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns result immediately when fn succeeds on first try', async () => {
    const fn = vi.fn(async () => 'value');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 100 });
    expect(result).toBe('value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient RateLimitError and succeeds', async () => {
    const transient = new RateLimitError('AI привремено е преоптоварен.');
    const fn = makeSucceedAfter(2, transient, 'result');
    const onRetry = vi.fn();

    const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, onRetry });
    // advance timers for both backoff sleeps
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on daily quota exhaustion (non-retryable RateLimitError)', async () => {
    const quota = new RateLimitError('Дневната AI квота е исцрпена.');
    const fn = vi.fn(async () => { throw quota; });

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })
    ).rejects.toBe(quota);

    expect(fn).toHaveBeenCalledTimes(1); // zero retries
  });

  it('does NOT retry on daily quota (English exhausted keyword)', async () => {
    const quota = new RateLimitError('daily quota exhausted');
    const fn = vi.fn(async () => { throw quota; });
    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toBe(quota);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on TypeError fetch network error', async () => {
    const networkErr = new TypeError('fetch failed');
    const fn = makeSucceedAfter(1, networkErr, 'ok');

    const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const err = new RateLimitError('AI привремено е преоптоварен.');
    const fn = vi.fn(async () => { throw err; });

    const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10 });
    // Attach rejection handler BEFORE advancing timers so the rejection is handled
    const assertion = expect(promise).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does NOT retry on non-retryable errors (generic Error)', async () => {
    const err = new Error('auth failed');
    const fn = vi.fn(async () => { throw err; });

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── circuitBreakerCall ────────────────────────────────────────────────────────

describe('circuitBreakerCall', () => {
  // Use a unique key per test to get a fresh circuit
  let key: string;
  let keyIdx = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    key = `test-circuit-${keyIdx++}`;
  });
  afterEach(() => { vi.useRealTimers(); });

  it('passes through successful calls', async () => {
    const fn = vi.fn(async () => 'success');
    const result = await circuitBreakerCall(key, fn);
    expect(result).toBe('success');
  });

  it('opens circuit after threshold failures and rejects immediately', async () => {
    const err = new Error('boom');
    const fn = vi.fn(async () => { throw err; });

    // Drive 5 failures to open the circuit (CIRCUIT_OPEN_THRESHOLD = 5)
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreakerCall(key, fn)).rejects.toThrow();
    }

    // Next call should be rejected without calling fn again
    const callsBefore = fn.mock.calls.length;
    await expect(circuitBreakerCall(key, fn)).rejects.toBeInstanceOf(RateLimitError);
    expect(fn.mock.calls.length).toBe(callsBefore); // fn not called again
  });

  it('half-opens after reset period and allows probe', async () => {
    const err = new Error('fail');
    const alwaysFail = vi.fn(async () => { throw err; });

    for (let i = 0; i < 5; i++) {
      await expect(circuitBreakerCall(key, alwaysFail)).rejects.toThrow();
    }

    // Advance past CIRCUIT_RESET_MS (120 000 ms)
    vi.advanceTimersByTime(121_000);

    // Now allow one probe — let it succeed
    const succeedFn = vi.fn(async () => 'recovered');
    const result = await circuitBreakerCall(key, succeedFn);
    expect(result).toBe('recovered');

    // Circuit should be closed again — subsequent calls pass through
    const normalFn = vi.fn(async () => 'normal');
    await expect(circuitBreakerCall(key, normalFn)).resolves.toBe('normal');
  });
});
