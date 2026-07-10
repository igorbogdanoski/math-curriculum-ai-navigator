import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockReqRes(query: Record<string, string>, body: Record<string, unknown> = {}) {
  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer faketoken' },
    query,
    body,
    socket: { remoteAddress: '203.0.113.5' },
  } as any;
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() { /* no-op */ },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    end() { return this; },
  };
  return { req, res };
}

const verifyIdToken = vi.fn();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: () => [{}], // pretend already initialized — skip the cert/env path entirely
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) }),
}));

describe('matura-share — handleSign rate limiting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SHARE_SIGNING_SECRET = 'test-secret';
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
    const { __testables } = await import('./matura-share');
    __testables.resetSignRateLimitState();
  });
  afterEach(() => { delete process.env.SHARE_SIGNING_SECRET; });

  it('signs successfully for a normal request', async () => {
    const { default: handler } = await import('./matura-share');
    const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' }, ttlDays: 7 });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.startsWith('v1.')).toBe(true);
  });

  it('rejects the 21st sign request within a minute from the same uid', async () => {
    const { default: handler } = await import('./matura-share');

    for (let i = 0; i < 20; i++) {
      const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
    }

    const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
    await handler(req, res);

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ quotaType: 'rate' });
  });

  it('rate limit is scoped per-uid — a different caller is unaffected', async () => {
    const { default: handler } = await import('./matura-share');

    for (let i = 0; i < 20; i++) {
      const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
      await handler(req, res);
    }
    // 21st request for u1 is blocked
    {
      const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
      await handler(req, res);
      expect(res.statusCode).toBe(429);
    }

    // A different authenticated user is not affected by u1's limit
    verifyIdToken.mockResolvedValue({ uid: 'u2' });
    const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('does not rate-limit handleVerify', async () => {
    const { default: handler } = await import('./matura-share');
    // Exhaust the sign limiter for u1 first
    for (let i = 0; i < 21; i++) {
      const { req, res } = mockReqRes({ action: 'sign' }, { payload: { examId: 'e1' } });
      await handler(req, res);
    }

    const { req, res } = mockReqRes({ action: 'verify', token: 'not-a-real-token' });
    req.method = 'GET';
    await handler(req, res);

    // Rejected for being an invalid token shape, NOT for rate limiting (400, not 429)
    expect(res.statusCode).toBe(400);
  });
});
