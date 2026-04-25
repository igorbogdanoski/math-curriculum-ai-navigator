import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { ErrorCode, toAppError } from '../utils/errors';

/**
 * Sentry Application Monitoring + Core Web Vitals
 *
 * Setup:
 *  1. Create a project at https://sentry.io → Settings → Projects → DSN
 *  2. Add VITE_SENTRY_DSN=https://xxx@oxx.ingest.sentry.io/xxx to .env
 *  3. Sentry is automatically disabled when VITE_SENTRY_DSN is not set.
 *
 * For source maps in production (better stack traces):
 *  npm install --save-dev @sentry/vite-plugin
 *  Add SENTRY_AUTH_TOKEN + sentryVitePlugin() to vite.config.ts
 */

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  // Basic validation to prevent "Invalid Sentry Dsn" noise in console
  if (!dsn || !dsn.startsWith('https://') || !dsn.includes('@sentry.io')) {
    // DSN not configured or invalid — Sentry disabled (expected in envs without DSN set)
    return;
  }

  Sentry.init({
    dsn,
    release: (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ?? undefined,
    environment: import.meta.env.MODE, // 'development' | 'production'
    // Only capture events in production to avoid polluting dev data
    enabled: import.meta.env.PROD,
    // Capture 100% of errors and 100% of performance transactions for early phase
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Filter out known non-critical noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'auth/network-request-failed',
      'auth/popup-closed-by-user',
      'ChunkLoadError',
    ],
    // Don't send events for these URL patterns (e.g. local dev)
    denyUrls: [
      /localhost/,
      /127\.0\.0\.1/,
    ],
  });
}

/** Call after teacher logs in to attach identity to Sentry events. */
export function setSentryUser(uid: string, email?: string): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser({ id: uid, email });
}

/** Call after logout to clear user context. */
export function clearSentryUser(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser(null);
}

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Maps any thrown value → { code, retryable, errorType }.
 * Ensures every captureException call emits a specific app_error_code tag
 * so Sentry UNCLASSIFIED ratio stays below the L2 threshold (≤15%).
 *
 * Priority order:
 *   1. AppError subclasses (already have .code + .retryable)
 *   2. ApiError subclasses (detect by .name, map to ErrorCode)
 *   3. Plain Error / unknown → toAppError() heuristic classifier
 */
function classifyError(error: unknown): {
  code: string;
  retryable: boolean;
  errorType: 'app_error' | 'api_error' | 'untyped_error';
  errorName?: string;
  userMessage?: string;
} {
  // 1) Already a typed AppError
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'retryable' in error
  ) {
    const e = error as { code: string; retryable: boolean; name?: string; userMessage?: string };
    return { code: e.code, retryable: e.retryable, errorType: 'app_error', errorName: e.name, userMessage: e.userMessage };
  }

  // 2) ApiError subclasses (no .code but have a discriminating .name)
  if (error instanceof Error) {
    switch (error.name) {
      case 'RateLimitError': return { code: ErrorCode.QUOTA_EXHAUSTED,    retryable: false, errorType: 'api_error', errorName: error.name };
      case 'AuthError':      return { code: ErrorCode.NOT_AUTHENTICATED,  retryable: false, errorType: 'api_error', errorName: error.name };
      case 'ServerError':    return { code: ErrorCode.AI_UNAVAILABLE,     retryable: true,  errorType: 'api_error', errorName: error.name };
      case 'BadInputError':  return { code: ErrorCode.VALIDATION_FAILED,  retryable: false, errorType: 'api_error', errorName: error.name };
      case 'ApiError':       return { code: ErrorCode.AI_UNAVAILABLE,     retryable: true,  errorType: 'api_error', errorName: error.name };
      default: break;
    }

    // 3) Heuristic classification via toAppError
    const classified = toAppError(error);
    return { code: classified.code, retryable: classified.retryable, errorType: 'untyped_error', errorName: error.name };
  }

  return { code: ErrorCode.UNKNOWN, retryable: false, errorType: 'untyped_error' };
}

/** Manually report a caught error (e.g. in catch blocks). */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const { code, retryable, errorType, errorName, userMessage } = classifyError(error);

  const tags: Record<string, string> = {
    error_type: errorType,
    app_error_code: code,           // always present — eliminates UNCLASSIFIED at source
    app_error_retryable: String(retryable),
  };
  if (errorName) tags.app_error_name = errorName;

  const extra = {
    ...(context ?? {}),
    ...(userMessage ? { appErrorUserMessage: userMessage } : {}),
  };

  Sentry.captureException(error, { tags, extra });
}

/**
 * Best-effort device-type detection (S40-M1) for Web Vitals bucketing.
 * Uses User-Agent Client Hints when available; otherwise a UA + viewport
 * heuristic. Returns one of mobile / tablet / desktop / unknown.
 */
export type DetectedDevice = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export function detectDeviceType(): DetectedDevice {
  if (typeof navigator === 'undefined') return 'unknown';
  // UA-CH first (Chromium browsers)
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  const ua = navigator.userAgent || '';
  const isTabletUA = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua));
  if (isTabletUA) return 'tablet';
  if (uaData && typeof uaData.mobile === 'boolean') {
    return uaData.mobile ? 'mobile' : 'desktop';
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  // viewport fallback for environments without UA hints
  const w = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
  if (w > 0 && w < 768) return 'mobile';
  if (w >= 768 && w < 1024) return 'tablet';
  if (w >= 1024) return 'desktop';
  return 'unknown';
}

/**
 * Measure and report Core Web Vitals to Sentry.
 * Call once after app renders. No-op when Sentry DSN is not configured.
 *
 * Metrics reported: LCP, CLS, FCP, INP, TTFB
 * Thresholds (Google):
 *   LCP  good <2.5s  | needs improvement <4s  | poor ≥4s
 *   CLS  good <0.1   | needs improvement <0.25 | poor ≥0.25
 *   INP  good <200ms | needs improvement <500ms| poor ≥500ms
 *   FCP  good <1.8s  | needs improvement <3s   | poor ≥3s
 *   TTFB good <800ms | needs improvement <1.8s | poor ≥1.8s
 */
export function reportWebVitals(): void {
  // П23: telemetry runs in production whether or not Sentry DSN is configured.
  // - Sentry path: rich event with rating + navigationType (when DSN set).
  // - Beacon path: small POST to /api/web-vitals so the in-memory aggregator
  //   in api/_lib/webVitalsBuffer.ts can compute p50/p75/p95 per metric on
  //   warm containers, surfaced via GET /api/web-vitals.
  if (!import.meta.env.PROD) return;

  const hasSentry = Boolean(import.meta.env.VITE_SENTRY_DSN);
  const detectedDevice = detectDeviceType();

  const sendToSentry = (metric: Metric) => {
    if (!hasSentry) return;
    Sentry.captureEvent({
      message: `Web Vital: ${metric.name}`,
      level: 'info',
      extra: {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        rating: metric.rating,   // 'good' | 'needs-improvement' | 'poor'
        navigationType: metric.navigationType,
      },
      tags: {
        'web_vital': metric.name,
        'web_vital_rating': metric.rating,
        'device_type': detectedDevice,
      },
    });
  };

  const sendBeacon = (metric: Metric) => {
    try {
      const value = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value);
      const device = detectDeviceType();
      const payload = JSON.stringify({ name: metric.name, value, device });
      // sendBeacon is unaffected by page-unload; works without keepalive flags.
      // Falls back to fetch() with keepalive when sendBeacon is unavailable
      // (older Safari / non-browser test envs).
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (nav?.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        nav.sendBeacon('/api/web-vitals', blob);
      } else if (typeof fetch !== 'undefined') {
        void fetch('/api/web-vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // beacon is best-effort
    }
  };

  const dispatch = (metric: Metric) => {
    sendToSentry(metric);
    sendBeacon(metric);
  };

  onLCP(dispatch);
  onCLS(dispatch);
  onINP(dispatch);
  onFCP(dispatch);
  onTTFB(dispatch);
}
