/**
 * 2026-07-20 (closing "top tier" observability item, drifting-snuggling-wave.md). Server-side
 * counterpart to services/sentryService.ts (client-only until now). Found while researching
 * this feature: api/csp-report.ts and api/_lib/costTracker.ts already had Sentry-reporting code
 * paths, but both did `await import('@sentry/node')` against a package that was never actually
 * a dependency — those calls always failed and silently no-opped via `.catch(() => null)`. So
 * every serverless function's unhandled errors were previously invisible outside Vercel's own
 * raw function logs — this closes that gap for all 18 API endpoints at once via a single wrapper,
 * rather than needing every endpoint to remember to report errors itself.
 *
 * Deliberately a separate (non-VITE_-prefixed) `SENTRY_DSN` env var from the client's
 * `VITE_SENTRY_DSN` — Vite only inlines `VITE_`-prefixed vars into the client bundle at build
 * time, and Vercel serverless functions read `process.env` directly at runtime, so the two
 * sides need their own env var even when pointed at the same Sentry project/DSN value.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as Sentry from '@sentry/node';

let initialized = false;

export function initApiSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // disabled when not configured — same no-op contract as the client side

  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: sha ? `mismath@${sha.slice(0, 7)}` : 'dev',
    // Error tracking only for now — no server-side performance tracing yet.
    tracesSampleRate: 0,
  });
}

/** Manually report a caught error from within a handler (e.g. after a partial response). */
export function captureApiException(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  initApiSentry();
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Report a non-exception message (e.g. the cost-guard budget alert) as a Sentry issue. */
export function captureApiMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (!process.env.SENTRY_DSN) return;
  initApiSentry();
  Sentry.captureMessage(message, { level, tags: context?.tags, extra: context?.extra });
}

/** Record a breadcrumb (e.g. a CSP violation) on the Sentry event timeline, server-side. */
export function addApiBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (!process.env.SENTRY_DSN) return;
  initApiSentry();
  Sentry.addBreadcrumb({ category, message, data, level });
}

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

/**
 * Wraps a Vercel serverless function so any exception it throws is reported to Sentry (tagged
 * with the endpoint name + HTTP method) and still gets a clean 500 response, instead of either
 * vanishing into Vercel's logs alone or crashing the function with no response at all.
 */
export function withErrorTracking(endpointName: string, handler: ApiHandler): ApiHandler {
  return async (req: VercelRequest, res: VercelResponse) => {
    initApiSentry();
    try {
      return await handler(req, res);
    } catch (error) {
      captureApiException(error, { endpoint: endpointName, method: req.method });
      console.error(`[${endpointName}] Unhandled error:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}
