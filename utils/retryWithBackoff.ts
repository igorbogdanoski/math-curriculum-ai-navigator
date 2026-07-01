/**
 * Exponential-backoff retry for transient failures (rate limits, network blips).
 *
 * Design decisions:
 * - Only retries RETRYABLE errors (rate-limit 429, network). Daily quota and
 *   auth errors are NOT retried — they require user action.
 * - Jitter added to backoff to prevent thundering herd under concurrent load.
 * - Circuit-breaker: tracks per-model failure count in module-level state;
 *   opens after CIRCUIT_OPEN_THRESHOLD failures in CIRCUIT_WINDOW_MS, stays
 *   open for CIRCUIT_RESET_MS then half-opens for a single probe.
 */

import { RateLimitError } from '../services/apiErrors';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const DEFAULT_OPTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1500,
  maxDelayMs: 20_000,
  onRetry: () => {},
};

function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError) {
    // Daily quota exhaustion is NOT retryable — don't hammer the server.
    const msg = (err as Error).message ?? '';
    if (msg.includes('квота') || msg.includes('quota') || msg.includes('исцрпена') || msg.includes('exhausted')) {
      return false;
    }
    return true; // Transient rate limit (429 rate_limit type)
  }
  if (err instanceof TypeError && (err as TypeError).message.includes('fetch')) return true; // Network error
  if (err instanceof Error && err.name === 'NetworkError') return true;
  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, onRetry } = { ...DEFAULT_OPTS, ...opts };
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxRetries) throw err;
      // Exponential backoff with ±20% jitter
      const exp = baseDelayMs * 2 ** attempt;
      const jitter = exp * 0.2 * (Math.random() * 2 - 1);
      const delayMs = Math.min(exp + jitter, maxDelayMs);
      onRetry(attempt + 1, Math.round(delayMs), err);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ── Circuit Breaker ───────────────────────────────────────────────────────────

const CIRCUIT_OPEN_THRESHOLD = 5;    // failures before opening
const CIRCUIT_WINDOW_MS = 60_000;    // 1 minute rolling window
const CIRCUIT_RESET_MS  = 120_000;   // 2 minutes before half-open probe

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitEntry {
  state: CircuitState;
  failures: number;
  windowStart: number;
  openedAt: number;
}

const circuits = new Map<string, CircuitEntry>();

function getCircuit(key: string): CircuitEntry {
  if (!circuits.has(key)) {
    circuits.set(key, { state: 'closed', failures: 0, windowStart: Date.now(), openedAt: 0 });
  }
  return circuits.get(key)!;
}

export function circuitBreakerCall<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const circuit = getCircuit(key);
  const now = Date.now();

  // Reset window
  if (now - circuit.windowStart > CIRCUIT_WINDOW_MS) {
    circuit.failures = 0;
    circuit.windowStart = now;
  }

  if (circuit.state === 'open') {
    if (now - circuit.openedAt > CIRCUIT_RESET_MS) {
      circuit.state = 'half-open';
    } else {
      return Promise.reject(new RateLimitError('AI сервисот е временски недостапен. Обидете се повторно за кратко.'));
    }
  }

  return fn().then(
    (result) => {
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
      }
      return result;
    },
    (err) => {
      circuit.failures++;
      if (circuit.failures >= CIRCUIT_OPEN_THRESHOLD) {
        circuit.state = 'open';
        circuit.openedAt = Date.now();
      } else if (circuit.state === 'half-open') {
        circuit.state = 'open';
        circuit.openedAt = Date.now();
      }
      throw err;
    },
  );
}
