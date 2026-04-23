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
  | `feature_open_${string}`;

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
