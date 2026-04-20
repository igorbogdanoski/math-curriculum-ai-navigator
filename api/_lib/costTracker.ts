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
    const msg = `[cost-guard] user=${input.userId} model=${input.model} tokens=${total} exceeded daily budget=${budget}`;
    // eslint-disable-next-line no-console
    console.warn(msg);
    // S36-B4: fire-and-forget alert dispatch (non-blocking, never throws)
    void dispatchCostAlert({ userId: input.userId, model: input.model, total, budget }).catch(() => { /* silent */ });
  }
  return entry;
}

// ── S36-B4: Alert dispatcher ─────────────────────────────────────────────────

/**
 * Sends a cost-guard alert via all configured channels:
 *   1. Always: Sentry captureMessage (warning level) — works if SENTRY_DSN is set
 *   2. Optional: Slack webhook if SLACK_WEBHOOK_URL env var is set
 *   3. Optional: Email via Resend if RESEND_API_KEY + ALERT_EMAIL env vars are set
 *
 * This function is fire-and-forget — never throws, never blocks the request.
 */
async function dispatchCostAlert(opts: {
  userId: string;
  model: string;
  total: number;
  budget: number;
}): Promise<void> {
  const { userId, model, total, budget } = opts;
  const pct = Math.round((total / budget) * 100);
  const summary = `Cost-guard: user ${userId} hit ${pct}% of daily budget on ${model} (${total}/${budget} tokens)`;

  // 1. Sentry — captureMessage creates a Sentry issue + email to project owners
  try {
    // Dynamic import via variable prevents Vite static analysis (package is server-only)
    const sentryPkg = '@sentry/node';
    const Sentry = await import(/* @vite-ignore */ sentryPkg).catch(() => null);
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(summary, {
        level: 'warning',
        tags: { component: 'cost-guard', model },
        extra: { userId, total, budget, pct },
      });
    }
  } catch { /* Sentry not available in this runtime */ }

  // 2. Slack — only if SLACK_WEBHOOK_URL is configured
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ *Math Navigator Cost Alert*\n${summary}`,
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `⚠️ *Cost Guard Triggered*\n• User: \`${userId}\`\n• Model: \`${model}\`\n• Tokens used: ${total.toLocaleString()} / ${budget.toLocaleString()} (${pct}%)\n• Day: ${new Date().toISOString().slice(0, 10)}` },
            },
          ],
        }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch { /* Slack down or misconfigured — ignore */ }
  }

  // 3. Resend email — only if RESEND_API_KEY + ALERT_EMAIL are configured
  const resendKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;
  if (resendKey && alertEmail) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'alerts@ai.mismath.net',
          to: alertEmail,
          subject: `⚠️ Cost-guard alert — ${model} ${pct}% budget`,
          html: `<p>${summary}</p><p>Date: ${new Date().toISOString()}</p>`,
        }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch { /* Resend down or misconfigured — ignore */ }
  }
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
