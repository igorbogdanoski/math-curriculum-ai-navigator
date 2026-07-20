import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockReqRes(method: string, headers: Record<string, string> = {}) {
  const req = { method, headers } as any;
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    end() { return this; },
  };
  return { req, res };
}

const verifyIdToken = vi.fn();
const portalSessionsCreate = vi.fn();
const firestoreDocs = new Map<string, Record<string, unknown>>();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: () => [{}], // pretend already initialized
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) }),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => firestoreDocs.get(`${name}/${id}`) }),
      }),
    }),
  }),
}));
vi.mock('stripe', () => ({
  default: class {
    billingPortal = { sessions: { create: (...args: unknown[]) => portalSessionsCreate(...args) } };
  },
}));

describe('/api/stripe-portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreDocs.clear();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
  });
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('rejects a missing Authorization header', async () => {
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST');
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(portalSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer badtoken' });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 503 when Stripe env vars are not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);
    expect(res.statusCode).toBe(503);
  });

  it('returns 404 when the caller has no stripeCustomerId on file', async () => {
    firestoreDocs.set('users/u1', { name: 'Teacher' });
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(portalSessionsCreate).not.toHaveBeenCalled();
  });

  it('creates a portal session for a known Stripe customer and returns its url', async () => {
    firestoreDocs.set('users/u1', { name: 'Teacher', stripeCustomerId: 'cus_1' });
    portalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/session/abc' });
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ url: 'https://billing.stripe.com/session/abc' });
    expect(portalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_1' }),
    );
  });

  it('returns 500 (not the raw Stripe error) when session creation throws', async () => {
    firestoreDocs.set('users/u1', { stripeCustomerId: 'cus_1' });
    portalSessionsCreate.mockRejectedValue(new Error('internal stripe detail'));
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to create billing portal session' });
  });

  it('responds 200 with no body on OPTIONS preflight', async () => {
    const { default: handler } = await import('./stripe-portal');
    const { req, res } = mockReqRes('OPTIONS');
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
