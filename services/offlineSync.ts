/**
 * S37-D2 — Offline-first sync orchestrator.
 *
 * Builds on top of the existing `pending_quizzes` IndexedDB store (see
 * `services/indexedDBService.ts`) and adds:
 *
 *   • `flushPendingQuizzes(uploader, opts)` — drains the queue with
 *     exponential-backoff retry on transient failures, leaves the entry
 *     in place on permanent failures so the user can re-try later.
 *   • `registerBackgroundSync(tag)` — best-effort SW Background Sync
 *     registration; gracefully no-ops on browsers that lack support.
 *   • Pure helpers (`computeBackoffMs`, `isTransientError`,
 *     `partitionFlushOutcome`) — exported for unit testing without IDB.
 */

import type { QuizResult } from './firestoreService';
import {
  getPendingQuizzes,
  clearPendingQuiz,
} from './indexedDBService';
import { logger } from '../utils/logger';

// ─── Pure helpers (unit-tested) ──────────────────────────────────────────────

export const BG_SYNC_TAG = 'mathnav-flush-pending-quizzes';

/** Exponential backoff with jitter, capped at maxMs. Pure & deterministic
 *  when `random` is supplied (unit tests pass `() => 0.5`). */
export function computeBackoffMs(
  attempt: number,
  opts: { baseMs?: number; maxMs?: number; random?: () => number } = {},
): number {
  const base = opts.baseMs ?? 500;
  const max = opts.maxMs ?? 30_000;
  const r = (opts.random ?? Math.random)();
  const expo = base * Math.pow(2, Math.max(0, attempt));
  // Decorrelated jitter: pick uniformly in [base, expo*1.5]
  const jittered = base + r * (expo * 1.5 - base);
  return Math.min(max, Math.max(base, jittered));
}

/** Heuristic: which errors are worth retrying vs giving up on. */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // Network / quota / temporary unavailability — retry
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('unavailable') ||
    msg.includes('failed to fetch') ||
    msg.includes('quic') ||
    msg.includes('fetch failed') ||
    msg.includes('429') ||
    msg.includes('503')
  ) return true;
  // Auth / permission / validation — do NOT retry (user must intervene)
  return false;
}

export interface FlushOutcome {
  id: string;
  status: 'uploaded' | 'transient-fail' | 'permanent-fail';
  error?: unknown;
}

/** Bucket flush outcomes for caller logging. Pure. */
export function partitionFlushOutcome(outcomes: readonly FlushOutcome[]): {
  uploaded: string[];
  transientFails: FlushOutcome[];
  permanentFails: FlushOutcome[];
} {
  return {
    uploaded:        outcomes.filter(o => o.status === 'uploaded').map(o => o.id),
    transientFails:  outcomes.filter(o => o.status === 'transient-fail'),
    permanentFails:  outcomes.filter(o => o.status === 'permanent-fail'),
  };
}

// ─── Side-effect API ─────────────────────────────────────────────────────────

export type QuizUploader = (q: QuizResult) => Promise<void>;

interface FlushOpts {
  /** Maximum retry attempts per item before treating as transient-fail. */
  maxAttempts?: number;
  /** Override sleep for unit tests (returns immediately). */
  sleep?: (ms: number) => Promise<void>;
  /** Override backoff random source (deterministic for tests). */
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Drain `pending_quizzes` through the supplied uploader. */
export async function flushPendingQuizzes(
  uploader: QuizUploader,
  opts: FlushOpts = {},
): Promise<FlushOutcome[]> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random;
  const pending = await getPendingQuizzes();
  const outcomes: FlushOutcome[] = [];

  for (const entry of pending) {
    let attempt = 0;
    let lastErr: unknown = null;
    let uploaded = false;
    while (attempt < maxAttempts) {
      try {
        await uploader(entry.quizResult);
        await clearPendingQuiz(entry.id);
        outcomes.push({ id: entry.id, status: 'uploaded' });
        uploaded = true;
        break;
      } catch (err) {
        lastErr = err;
        if (!isTransientError(err)) {
          // Permanent — stop retrying this entry, leave it queued
          outcomes.push({ id: entry.id, status: 'permanent-fail', error: err });
          break;
        }
        attempt++;
        if (attempt < maxAttempts) {
          await sleep(computeBackoffMs(attempt, { random }));
        }
      }
    }
    if (!uploaded && outcomes.find(o => o.id === entry.id) === undefined) {
      outcomes.push({ id: entry.id, status: 'transient-fail', error: lastErr });
    }
  }

  const summary = partitionFlushOutcome(outcomes);
  logger.info('[Offline Sync] flush complete', {
    uploaded: summary.uploaded.length,
    transient: summary.transientFails.length,
    permanent: summary.permanentFails.length,
  });
  return outcomes;
}

/**
 * Register a Background Sync event with the active Service Worker so the
 * browser flushes queued quizzes when connectivity returns, even if the
 * tab is closed. No-op on browsers without the API.
 */
export async function registerBackgroundSync(
  tag: string = BG_SYNC_TAG,
): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync;
    if (!sync) return false;
    await sync.register(tag);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wire a `window.online` listener that flushes the queue immediately when
 * the device regains connectivity. Returns an unsubscribe fn.
 */
export function startOnlineFlushListener(uploader: QuizUploader): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    flushPendingQuizzes(uploader).catch(() => {/* logged inside */});
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
