/**
 * Regression test for the logger -> Sentry bridge.
 *
 * captureSentry previously read `(globalThis as any).Sentry`, which is never
 * assigned anywhere in the app (Sentry is only ever imported as an ES module
 * in services/sentryService.ts) — so every logger.error/warn call silently
 * failed to reach Sentry in production. Fixed by dynamically importing
 * services/sentryService.ts directly instead of relying on a global.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureSentry } from './logger';

const captureExceptionMock = vi.fn();
const captureMessageMock = vi.fn();

vi.mock('../services/sentryService', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

describe('logger.captureSentry — Sentry bridge', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
    captureMessageMock.mockClear();
  });

  it('routes error-level calls with an Error to sentryService.captureException', async () => {
    const err = new Error('Firestore write failed');
    captureSentry('error', 'Firestore write failed', err, { uid: 'u1' });

    await vi.waitFor(() => expect(captureExceptionMock).toHaveBeenCalledTimes(1));
    expect(captureExceptionMock).toHaveBeenCalledWith(err, { uid: 'u1' });
    expect(captureMessageMock).not.toHaveBeenCalled();
  });

  it('routes warning-level calls to sentryService.captureMessage', async () => {
    captureSentry('warning', 'Slow query', undefined, { ms: 450 });

    await vi.waitFor(() => expect(captureMessageMock).toHaveBeenCalledTimes(1));
    expect(captureMessageMock).toHaveBeenCalledWith('Slow query', 'warning', { ms: 450 });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('falls back to captureMessage for an error-level call with no Error object', async () => {
    captureSentry('error', 'Something failed', undefined, undefined);

    await vi.waitFor(() => expect(captureMessageMock).toHaveBeenCalledTimes(1));
    expect(captureMessageMock).toHaveBeenCalledWith('Something failed', 'error', undefined);
  });

  it('never throws even if the dynamic import rejects', async () => {
    vi.doMock('../services/sentryService', () => {
      throw new Error('module load failed');
    });
    expect(() => captureSentry('error', 'x', new Error('y'))).not.toThrow();
  });
});
