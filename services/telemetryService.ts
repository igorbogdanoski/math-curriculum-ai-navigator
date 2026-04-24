import posthog from 'posthog-js';

/**
 * S39-F1 — PostHog telemetry wrapper.
 *
 * Setup:
 *   VITE_POSTHOG_KEY=phc_xxx
 *   VITE_POSTHOG_HOST=https://eu.posthog.com   (default if unset)
 *
 * Disabled when key is missing OR in dev mode.
 * All exports are safe no-ops when PostHog is not initialised.
 */

export type TelemetryUserRole = 'teacher' | 'student' | 'school_admin' | 'unknown';

/**
 * Canonical event taxonomy (S39-F2). Keep in sync with analytics dashboard.
 * `feature_open_<name>` is intentionally open-ended.
 */
export type TelemetryEventName =
  | 'signup_completed'
  | 'login_completed'
  | 'first_quiz_generated'
  | 'first_lesson_saved'
  | 'first_extraction_run'
  | 'credit_consumed'
  | 'quota_warning_seen'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'experiment_assigned'
  | `feature_open_${string}`
  | `experiment_${string}`;

export interface TelemetryUserProperties {
  userRole?: TelemetryUserRole;
  gradeLevel?: number;
  schoolId?: string;
  sessionN?: number;
  [key: string]: unknown;
}

interface TelemetryConfig {
  key?: string;
  host: string;
  enabled: boolean;
}

let initialised = false;

function readConfig(): TelemetryConfig {
  const env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined) as
    | Record<string, string | boolean | undefined>
    | undefined;
  const key = (env?.VITE_POSTHOG_KEY as string | undefined) ?? undefined;
  const host = (env?.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';
  const isDev = Boolean(env?.DEV);
  const enabled = Boolean(key) && !isDev;
  return { key, host, enabled };
}

export function isTelemetryEnabled(): boolean {
  return readConfig().enabled && initialised;
}

export function initTelemetry(): void {
  if (initialised) return;
  if (typeof window === 'undefined') return;
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.key) return;
  try {
    posthog.init(cfg.key, {
      api_host: cfg.host,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'localStorage+cookie',
      loaded: () => {
        if (typeof console !== 'undefined' && (import.meta as ImportMeta).env?.DEV) {
          console.info('[telemetry] PostHog ready', cfg.host);
        }
      },
    });
    initialised = true;
  } catch {
    initialised = false;
  }
}

export function identifyTelemetryUser(uid: string, props: TelemetryUserProperties = {}): void {
  if (!isTelemetryEnabled()) return;
  try {
    posthog.identify(uid, sanitizeProps(props));
  } catch {
    /* no-op */
  }
}

export function resetTelemetryUser(): void {
  if (!isTelemetryEnabled()) return;
  try {
    posthog.reset();
  } catch {
    /* no-op */
  }
}

export function trackEvent(
  name: TelemetryEventName,
  properties: Record<string, string | number | boolean | undefined | null> = {},
): void {
  if (!isTelemetryEnabled()) return;
  try {
    posthog.capture(name, sanitizeProps(properties));
  } catch {
    /* no-op */
  }
}

/** Internal — pure & testable. Removes undefined / null values + clamps strings. */
export function sanitizeProps<T extends Record<string, unknown>>(props: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      out[k] = v.length > 256 ? `${v.slice(0, 253)}...` : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Pure helper — derives PostHog sample-rate by user role per the S39 plan. */
export function sampleRateForRole(role: TelemetryUserRole | undefined): number {
  if (role === 'teacher') return 1.0;
  if (role === 'student') return 0.5;
  return 0.25;
}

/**
 * Returns true when an event should be sampled-in based on a deterministic
 * stable hash of the (uid + event-name) pair so the same user/event combo
 * is consistently included or excluded across sessions.
 */
export function shouldSampleEvent(
  uid: string,
  eventName: string,
  role: TelemetryUserRole | undefined,
): boolean {
  const rate = sampleRateForRole(role);
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  let hash = 0;
  const seed = `${uid}:${eventName}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const bucket = (hash % 1000) / 1000;
  return bucket < rate;
}

// ─── S39-F2: Activation funnel helpers ──────────────────────────────────────

const FIRST_EVENT_PREFIX = 'tlm_first_event:';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* SSR / privacy mode */ }
  return null;
}

/** Pure logic: was this first-time event already recorded? */
export function hasFirstEventBeenRecorded(
  storage: StorageLike | null,
  uid: string,
  eventName: TelemetryEventName,
): boolean {
  if (!storage) return false;
  return storage.getItem(`${FIRST_EVENT_PREFIX}${uid}:${eventName}`) === '1';
}

/** Pure logic: mark a first-time event as recorded (idempotent). */
export function markFirstEventRecorded(
  storage: StorageLike | null,
  uid: string,
  eventName: TelemetryEventName,
): void {
  if (!storage) return;
  try { storage.setItem(`${FIRST_EVENT_PREFIX}${uid}:${eventName}`, '1'); } catch { /* quota */ }
}

/**
 * Track a first-time-only event for a user. The event fires at most once
 * per (uid, eventName) pair across sessions on the same browser profile.
 * Returns true if the event was emitted now, false if it was already recorded.
 */
export function trackFirstTimeEvent(
  uid: string | null | undefined,
  eventName: TelemetryEventName,
  properties: Record<string, string | number | boolean | undefined | null> = {},
): boolean {
  if (!uid) return false;
  const storage = getStorage();
  if (hasFirstEventBeenRecorded(storage, uid, eventName)) return false;
  markFirstEventRecorded(storage, uid, eventName);
  trackEvent(eventName, { ...properties, firstTime: true });
  return true;
}

/** Pure: returns true when the new balance crossed the low-quota warning threshold. */
export function shouldEmitQuotaWarning(
  previousBalance: number,
  newBalance: number,
  threshold = 10,
): boolean {
  return previousBalance > threshold && newBalance <= threshold && newBalance >= 0;
}

/**
 * Records a credit consumption event and, if the new balance crossed below
 * the low-quota threshold, also fires `quota_warning_seen` exactly once at
 * the crossing moment.
 */
// ─── S39-F6: A/B activation kill-switch ─────────────────────────────────────

export type ExperimentBucket = 'A' | 'B';

/**
 * Deterministically assigns a user to bucket A or B for a named experiment.
 * `splitPercent` is the fraction (0..1) routed to bucket A (control).
 *   splitPercent = 0.5  →  50/50 split
 *   splitPercent = 1.0  →  everyone in A (kill-switch OFF, control everywhere)
 *   splitPercent = 0.0  →  everyone in B (kill-switch fully ON)
 *
 * Same (uid, experimentName) pair always returns the same bucket, so
 * users have a consistent experience across sessions.
 */
export function assignExperimentBucket(
  uid: string,
  experimentName: string,
  splitPercent = 0.5,
): ExperimentBucket {
  if (splitPercent >= 1) return 'A';
  if (splitPercent <= 0) return 'B';
  let hash = 0;
  const seed = `exp:${experimentName}:${uid}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const bucket = (hash % 1000) / 1000;
  return bucket < splitPercent ? 'A' : 'B';
}

/**
 * Records an experiment assignment exactly once per (uid, experimentName).
 * Returns the chosen bucket regardless of whether the event was emitted now.
 */
export function trackExperimentAssignment(
  uid: string | null | undefined,
  experimentName: string,
  splitPercent = 0.5,
): ExperimentBucket | null {
  if (!uid) return null;
  const bucket = assignExperimentBucket(uid, experimentName, splitPercent);
  const storage = getStorage();
  const key = `exp_assigned:${uid}:${experimentName}`;
  const already = storage?.getItem(key) ?? null;
  if (already !== bucket) {
    try { storage?.setItem(key, bucket); } catch { /* quota */ }
    trackEvent('experiment_assigned', { experiment: experimentName, bucket, splitPercent });
  }
  return bucket;
}

export function trackCreditConsumed(opts: {
  uid?: string | null;
  amount: number;
  previousBalance: number;
  newBalance: number;
  reason?: string;
  threshold?: number;
}): void {
  trackEvent('credit_consumed', {
    amount: opts.amount,
    balanceAfter: opts.newBalance,
    reason: opts.reason,
  });
  if (shouldEmitQuotaWarning(opts.previousBalance, opts.newBalance, opts.threshold)) {
    trackEvent('quota_warning_seen', {
      threshold: opts.threshold ?? 10,
      balance: opts.newBalance,
    });
  }
}
