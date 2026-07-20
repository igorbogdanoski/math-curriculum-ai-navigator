import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function mockReqRes(method: string, rawBody: string, headers: Record<string, string> = {}) {
  const listeners: Record<string, ((arg?: unknown) => void)[]> = {};
  const req = {
    method,
    headers,
    on(event: string, cb: (arg?: unknown) => void) {
      (listeners[event] ??= []).push(cb);
      return req;
    },
    // Simulate the stream emitting the body then ending, on next tick.
    __emit() {
      for (const cb of listeners.data ?? []) cb(Buffer.from(rawBody));
      for (const cb of listeners.end ?? []) cb();
    },
  } as any;
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
    end() { this.ended = true; return this; },
  };
  return { req, res };
}

const constructEvent = vi.fn();
const firestoreUpdate = vi.fn();
const firestoreDocs = new Map<string, Record<string, unknown>>();
// Maps stripeCustomerId -> uid, populated by tests to simulate an existing users doc
// (as written by the checkout.session.completed handler) that invoice/subscription
// events look up via a `where('stripeCustomerId', '==', ...)` query.
const usersByCustomerId = new Map<string, string>();

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: () => [{}],
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        update: async (data: Record<string, unknown>) => {
          firestoreUpdate(`${name}/${id}`, data);
          firestoreDocs.set(`${name}/${id}`, data);
        },
      }),
      where: (field: string, _op: string, value: string) => ({
        limit: () => ({
          get: async () => {
            const uid = field === 'stripeCustomerId' ? usersByCustomerId.get(value) : undefined;
            if (!uid) return { empty: true, docs: [] };
            return {
              empty: false,
              docs: [{
                ref: {
                  update: async (data: Record<string, unknown>) => {
                    firestoreUpdate(`${name}/${uid}`, data);
                    firestoreDocs.set(`${name}/${uid}`, data);
                  },
                },
              }],
            };
          },
        }),
      }),
    }),
  }),
}));
vi.mock('stripe', () => ({
  default: class {
    webhooks = { constructEvent: (...args: unknown[]) => constructEvent(...args) };
  },
}));

async function callHandler(req: any, res: any) {
  const { default: handler } = await import('./stripe-webhook');
  const p = handler(req, res);
  req.__emit();
  await p;
}

describe('/api/stripe-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreDocs.clear();
    usersByCustomerId.clear();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  });
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('rejects non-POST methods', async () => {
    const { default: handler } = await import('./stripe-webhook');
    const { req, res } = mockReqRes('GET', '');
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 503 when Stripe env vars are missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
    await callHandler(req, res);
    expect(res.statusCode).toBe(503);
  });

  it('rejects an invalid signature with 400, without touching Firestore', async () => {
    constructEvent.mockImplementation(() => { throw new Error('signature mismatch'); });
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'bad-sig' });
    await callHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('signature mismatch');
    expect(firestoreUpdate).not.toHaveBeenCalled();
  });

  it('acknowledges (200) without writing when checkout.session.completed has no uid', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', client_reference_id: null, metadata: {} } },
    });
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
    await callHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(firestoreUpdate).not.toHaveBeenCalled();
  });

  it('grants Pro entitlements for a valid checkout.session.completed event', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', client_reference_id: 'u1', metadata: { uid: 'u1' }, customer: 'cus_1' } },
    });
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
    await callHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(firestoreUpdate).toHaveBeenCalledWith('users/u1', expect.objectContaining({
      isPremium: true,
      tier: 'Pro',
      hasUnlimitedCredits: true,
      stripeCustomerId: 'cus_1',
      stripeSessionId: 'cs_1',
    }));
  });

  it('returns 500 (so Stripe retries) when the Firestore write fails, instead of swallowing it', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', client_reference_id: 'u1', metadata: { uid: 'u1' } } },
    });
    firestoreUpdate.mockImplementationOnce(() => { throw new Error('firestore unavailable'); });
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
    await callHandler(req, res);

    expect(res.statusCode).toBe(500);
  });

  it('ignores unrelated event types but still acknowledges', async () => {
    constructEvent.mockReturnValue({ type: 'some.other.event', data: { object: {} } });
    const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
    await callHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(firestoreUpdate).not.toHaveBeenCalled();
  });

  describe('subscription-mode events (Wave 13.2, inert until subscriptions are enabled)', () => {
    it('invoice.paid renews Pro for the user matched by stripeCustomerId', async () => {
      usersByCustomerId.set('cus_1', 'u1');
      constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: { object: { customer: 'cus_1', lines: { data: [{ period: { end: 1893456000 } }] } } },
      });
      const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
      await callHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(firestoreUpdate).toHaveBeenCalledWith('users/u1', expect.objectContaining({
        isPremium: true,
        tier: 'Pro',
        hasUnlimitedCredits: true,
        proExpiresAt: new Date(1893456000 * 1000).toISOString(),
      }));
    });

    it('invoice.paid acknowledges without writing when no user matches the customer', async () => {
      constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: { object: { customer: 'cus_unknown', lines: { data: [] } } },
      });
      const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
      await callHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(firestoreUpdate).not.toHaveBeenCalled();
    });

    it('customer.subscription.deleted downgrades the matched user to Free', async () => {
      usersByCustomerId.set('cus_2', 'u2');
      constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { customer: 'cus_2' } },
      });
      const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
      await callHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(firestoreUpdate).toHaveBeenCalledWith('users/u2', expect.objectContaining({
        isPremium: false,
        hasUnlimitedCredits: false,
        tier: 'Free',
      }));
    });

    it('invoice.payment_failed just acknowledges without touching Firestore', async () => {
      constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { id: 'in_1', customer: 'cus_3' } },
      });
      const { req, res } = mockReqRes('POST', '{}', { 'stripe-signature': 'sig' });
      await callHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(firestoreUpdate).not.toHaveBeenCalled();
    });
  });
});
