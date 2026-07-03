/**
 * utils/logger.ts — Централен логер
 *
 * Во development: пишува на конзола (info + warn + error).
 * Во production: ги прескокнува info; warn/error се праќаат на Sentry ако е конфигуриран.
 *
 * Употреба:
 *   import { logger } from '../utils/logger';
 *   logger.info('Loaded', { count: 5 });
 *   logger.warn('Slow query', { ms: 450 });
 *   logger.error('Firestore write failed', err, { uid });
 */

const isDev = import.meta.env.DEV;

/** Exported for direct unit testing of the Sentry bridge, independent of the isDev gate below. */
export function captureSentry(level: 'warning' | 'error', msg: string, err?: Error, ctx?: Record<string, unknown>): void {
  // Dynamic import: avoids pulling the Sentry SDK into every module that
  // imports the logger (nearly the whole app) when nothing has errored yet.
  // Fire-and-forget with a swallowed .catch — never let the logger itself throw,
  // including asynchronously (a rejected import() would otherwise escape a sync try/catch).
  import('../services/sentryService')
    .then(({ captureException, captureMessage }) => {
      if (level === 'error' && err) {
        captureException(err, ctx);
      } else {
        captureMessage(msg, level, ctx);
      }
    })
    .catch(() => { /* best-effort — never let the logger throw */ });
}

export const logger = {
  /** Dev-only debug log — silent in production */
  debug(msg: string, ctx?: unknown): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${msg}`, ctx ?? '');
    }
  },

  /** Dev-only info log — silent in production */
  info(msg: string, ctx?: unknown): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${msg}`, ctx ?? '');
    }
  },

  /** Logged in all envs; Sentry warning in production */
  warn(msg: string, ctx?: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${msg}`, ctx ?? '');
    if (!isDev) captureSentry('warning', msg, undefined, ctx instanceof Object ? ctx as Record<string, unknown> : undefined);
  },

  /** Logged in all envs; Sentry exception in production */
  error(msg: string, err?: unknown, ctx?: unknown): void {
    const e = err instanceof Error ? err : err !== undefined ? new Error(String(err)) : undefined;
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${msg}`, e ?? '', ctx ?? '');
    if (!isDev) captureSentry('error', msg, e, ctx instanceof Object ? ctx as Record<string, unknown> : undefined);
  },
};
