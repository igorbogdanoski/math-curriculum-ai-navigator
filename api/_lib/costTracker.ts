/**
 * api/_lib/costTracker.ts — П26 AI cost guard.
 *
 * Per-day token usage accounting per (userId, model). The tracker keeps
 * an in-memory map of `${YYYY-MM-DD}|${userId}|${model}` → tokens and
 * emits a single `console.warn` (Vercel log → Sentry breadcrumb) when a
 * user crosses the configured daily token budget.
 *
 * This is a *warm-container* signal: cold starts reset the counters. For
 * durable enforcement, mirror these counters into Firestore/Upstash; this
 * module is the cheap always-on guard that catches obvious abuse spikes.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Default daily token budget per user across all models. */
export const DEFAULT_USER_DAILY_TOKEN_BUDGET = 2_000_000;

/** Per-model daily budgets (override default). */
export const MODEL_DAILY_BUDGETS: Readonly<Record<string, number>> = Object.freeze({
  // Vision/thinking models cost more — keep a tighter leash.
  'gemini-3.1-pro-preview': 500_000,
  'gemini-2.5-pro': 750_000,
});

interface UsageEntry {
  userId: string;
  model: string;
  day: string;
  tokensIn: number;
  tokensOut: number;
  warned: boolean;
}

const usage = new Map<string, UsageEntry>();

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function entryKey(day: string, userId: string, model: string): string {
  return `${day}|${userId}|${model}`;
}

export interface RecordTokensInput {
  userId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** Override clock for tests. */
  now?: number;
}

export function recordTokens(input: RecordTokensInput): UsageEntry {
  const ts = input.now ?? Date.now();
  const day = dayKey(ts);
  const key = entryKey(day, input.userId, input.model);
  let entry = usage.get(key);
  if (!entry) {
    entry = {
      userId: input.userId,
      model: input.model,
      day,
      tokensIn: 0,
      tokensOut: 0,
      warned: false,
    };
    usage.set(key, entry);
  }
  entry.tokensIn += Math.max(0, Math.floor(input.tokensIn || 0));
  entry.tokensOut += Math.max(0, Math.floor(input.tokensOut || 0));

  const total = entry.tokensIn + entry.tokensOut;
  const budget = MODEL_DAILY_BUDGETS[input.model] ?? DEFAULT_USER_DAILY_TOKEN_BUDGET;
  if (!entry.warned && total > budget) {
    entry.warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[cost-guard] user=${input.userId} model=${input.model} tokens=${total} exceeded daily budget=${budget}`,
    );
  }
  return entry;
}

export interface UsageSnapshot {
  day: string;
  userId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  total: number;
  budget: number;
  overBudget: boolean;
}

export function getUsageSnapshot(): UsageSnapshot[] {
  const out: UsageSnapshot[] = [];
  for (const e of usage.values()) {
    const total = e.tokensIn + e.tokensOut;
    const budget = MODEL_DAILY_BUDGETS[e.model] ?? DEFAULT_USER_DAILY_TOKEN_BUDGET;
    out.push({
      day: e.day,
      userId: e.userId,
      model: e.model,
      tokensIn: e.tokensIn,
      tokensOut: e.tokensOut,
      total,
      budget,
      overBudget: total > budget,
    });
  }
  return out;
}

/** GC entries older than the retention window (default: 2 days). */
export function gcOldEntries(retentionDays = 2, now = Date.now()): number {
  let removed = 0;
  const cutoff = now - retentionDays * DAY_MS;
  for (const [key, entry] of usage.entries()) {
    if (Date.parse(`${entry.day}T00:00:00Z`) < cutoff) {
      usage.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Test-only — reset the in-memory state. */
export function _resetForTests(): void {
  usage.clear();
}
