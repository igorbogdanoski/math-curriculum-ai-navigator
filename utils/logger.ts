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

function captureSentry(level: 'warning' | 'error', msg: string, err?: Error, ctx?: object): void {
  try {
    // Sentry is optional — only used if loaded via CDN or npm in the future.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (globalThis as any).Sentry;
    if (!Sentry) return;
    if (level === 'error' && err) {
      Sentry.captureException(err, { extra: ctx });
    } else {
      Sentry.captureMessage(msg, level, { extra: ctx });
    }
  } catch {
    // Never let the logger itself throw
  }
}

export const logger = {
  /** Dev-only info log — silent in production */
  info(msg: string, ctx?: object): void {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(`[INFO] ${msg}`, ctx ?? '');
    }
  },

  /** Logged in all envs; Sentry warning in production */
  warn(msg: string, ctx?: object): void {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${msg}`, ctx ?? '');
    if (!isDev) captureSentry('warning', msg, undefined, ctx);
  },

  /** Logged in all envs; Sentry exception in production */
  error(msg: string, err?: Error | unknown, ctx?: object): void {
    const e = err instanceof Error ? err : err !== undefined ? new Error(String(err)) : undefined;
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${msg}`, e ?? '', ctx ?? '');
    if (!isDev) captureSentry('error', msg, e, ctx);
  },
};
