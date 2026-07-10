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
const sessionsCreate = vi.fn();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: () => [{}], // pretend already initialized
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: (...args: unknown[]) => verifyIdToken(...args) }),
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: (...args: unknown[]) => sessionsCreate(...args) } };
  },
}));

describe('/api/stripe-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_PRO_PRICE_ID = 'price_fake';
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'teacher@example.com' });
  });
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRO_PRICE_ID;
  });

  it('rejects a missing Authorization header', async () => {
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('POST');
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects an invalid/expired token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'));
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer badtoken' });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 503 when Stripe env vars are not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);
    expect(res.statusCode).toBe(503);
  });

  it('creates a checkout session for an authenticated user and returns its url', async () => {
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session/abc' });
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/session/abc' });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ client_reference_id: 'u1', metadata: { uid: 'u1', plan: 'pro' } }),
    );
  });

  it('returns 500 (not the raw Stripe error) when session creation throws', async () => {
    sessionsCreate.mockRejectedValue(new Error('card declined or whatever internal detail'));
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('POST', { authorization: 'Bearer goodtoken' });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to create payment session' });
  });

  it('responds 200 with no body on OPTIONS preflight', async () => {
    const { default: handler } = await import('./stripe-checkout');
    const { req, res } = mockReqRes('OPTIONS');
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});
