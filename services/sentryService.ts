import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

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

/** Manually report a caught error (e.g. in catch blocks). */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  const isTypedAppError =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'retryable' in error;

  const appError = isTypedAppError
    ? (error as { code: string; retryable: boolean; name?: string; userMessage?: string })
    : null;

  const tags: Record<string, string> = {
    error_type: appError ? 'app_error' : 'untyped_error',
  };

  if (appError) {
    tags.app_error_code = appError.code;
    tags.app_error_retryable = String(appError.retryable);
    if (appError.name) {
      tags.app_error_name = appError.name;
    }
  }

  const extra = {
    ...(context ?? {}),
    ...(appError?.userMessage ? { appErrorUserMessage: appError.userMessage } : {}),
  };

  Sentry.captureException(error, { tags, extra });
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
  if (!import.meta.env.VITE_SENTRY_DSN || !import.meta.env.PROD) return;

  const sendToSentry = (metric: Metric) => {
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
      },
    });
  };

  onLCP(sendToSentry);
  onCLS(sendToSentry);
  onINP(sendToSentry);
  onFCP(sendToSentry);
  onTTFB(sendToSentry);
}
