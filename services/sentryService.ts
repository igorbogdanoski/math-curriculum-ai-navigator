import * as Sentry from '@sentry/react';

/**
 * Sentry Application Monitoring
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
  if (!dsn) return; // no-op in dev or when DSN is not configured

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    // Only capture events in production to avoid polluting dev data
    enabled: import.meta.env.PROD,
    // Capture 100% of errors, 10% of performance transactions
    tracesSampleRate: 0.1,
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
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
