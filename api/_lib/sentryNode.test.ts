import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();
const sentryAddBreadcrumb = vi.fn();
const sentryCaptureMessage = vi.fn();

vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => sentryInit(...args),
  captureException: (...args: unknown[]) => sentryCaptureException(...args),
  addBreadcrumb: (...args: unknown[]) => sentryAddBreadcrumb(...args),
  captureMessage: (...args: unknown[]) => sentryCaptureMessage(...args),
}));

function mockReqRes(method = 'POST') {
  const req = { method } as any;
  const res: any = {
    statusCode: 200,
    headersSent: false,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; this.headersSent = true; return this; },
  };
  return { req, res };
}

describe('api/_lib/sentryNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.SENTRY_DSN;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_ENV;
  });
  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_ENV;
  });

  it('initApiSentry is a no-op when SENTRY_DSN is not configured', async () => {
    const { initApiSentry } = await import('./sentryNode');
    initApiSentry();
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it('initApiSentry initializes Sentry once, tagging release from VERCEL_GIT_COMMIT_SHA', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    process.env.VERCEL_ENV = 'production';
    const { initApiSentry } = await import('./sentryNode');

    initApiSentry();
    initApiSentry(); // second call must not re-init

    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: 'https://fake@o0.ingest.sentry.io/1',
      release: 'mismath@abcdef1',
      environment: 'production',
    }));
  });

  it('captureApiException is a no-op when SENTRY_DSN is not configured', async () => {
    const { captureApiException } = await import('./sentryNode');
    captureApiException(new Error('boom'));
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('captureApiException reports with extra context when configured', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    const { captureApiException } = await import('./sentryNode');
    const err = new Error('boom');
    captureApiException(err, { endpoint: 'test-endpoint' });
    expect(sentryCaptureException).toHaveBeenCalledWith(err, { extra: { endpoint: 'test-endpoint' } });
  });

  it('withErrorTracking lets a successful handler run through untouched', async () => {
    const { withErrorTracking } = await import('./sentryNode');
    const inner = vi.fn(async (_req: any, res: any) => { res.status(200).json({ ok: true }); });
    const wrapped = withErrorTracking('my-endpoint', inner);

    const { req, res } = mockReqRes();
    await wrapped(req, res);

    expect(inner).toHaveBeenCalledWith(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('withErrorTracking captures a thrown error and returns a clean 500', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    const { withErrorTracking } = await import('./sentryNode');
    const boom = new Error('internal failure');
    const inner = vi.fn(async () => { throw boom; });
    const wrapped = withErrorTracking('my-endpoint', inner);

    const { req, res } = mockReqRes();
    await wrapped(req, res);

    expect(sentryCaptureException).toHaveBeenCalledWith(boom, { extra: { endpoint: 'my-endpoint', method: 'POST' } });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('captureApiMessage forwards tags/extra to Sentry when configured', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    const { captureApiMessage } = await import('./sentryNode');
    captureApiMessage('Cost-guard alert', 'warning', { tags: { component: 'cost-guard' }, extra: { total: 100 } });
    expect(sentryCaptureMessage).toHaveBeenCalledWith('Cost-guard alert', {
      level: 'warning',
      tags: { component: 'cost-guard' },
      extra: { total: 100 },
    });
  });

  it('addApiBreadcrumb is a no-op when SENTRY_DSN is not configured', async () => {
    const { addApiBreadcrumb } = await import('./sentryNode');
    addApiBreadcrumb('security.csp', 'CSP violation');
    expect(sentryAddBreadcrumb).not.toHaveBeenCalled();
  });

  it('addApiBreadcrumb forwards to Sentry when configured', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    const { addApiBreadcrumb } = await import('./sentryNode');
    addApiBreadcrumb('security.csp', 'CSP violation', { directive: 'script-src' }, 'warning');
    expect(sentryAddBreadcrumb).toHaveBeenCalledWith({
      category: 'security.csp',
      message: 'CSP violation',
      data: { directive: 'script-src' },
      level: 'warning',
    });
  });

  it('withErrorTracking does not double-respond if the handler already sent headers before throwing', async () => {
    process.env.SENTRY_DSN = 'https://fake@o0.ingest.sentry.io/1';
    const { withErrorTracking } = await import('./sentryNode');
    const inner = vi.fn(async (_req: any, res: any) => {
      res.status(200).json({ partial: true });
      throw new Error('late failure after response sent');
    });
    const wrapped = withErrorTracking('my-endpoint', inner);

    const { req, res } = mockReqRes();
    await wrapped(req, res);

    expect(res.statusCode).toBe(200); // untouched — not overwritten with a 500
    expect(res.body).toEqual({ partial: true });
    expect(sentryCaptureException).toHaveBeenCalled(); // still reported, just didn't re-respond
  });
});
