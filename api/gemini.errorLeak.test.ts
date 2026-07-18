import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression test for L4: the server must never forward the raw upstream Gemini SDK
// error text to the client — only a generic, categorized message.

function mockReqRes(body: Record<string, unknown>) {
  const req = { method: 'POST', headers: { authorization: 'Bearer faketoken' }, body, socket: {} } as any;
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

const SENSITIVE_UPSTREAM_TEXT = 'upstream 500: internal endpoint https://secret-internal.googleapis.com/v1/leak failed for key AIzaFAKEKEY123';

vi.mock('./_lib/sharedUtils.js', () => ({
  setCorsHeaders: vi.fn(),
  authenticateAndValidate: vi.fn(async () => ({
    model: 'gemini-3-flash-preview',
    contents: 'hello',
    config: {},
  })),
  requireSufficientCredits: vi.fn(async () => true),
  getRequestPrincipal: vi.fn(() => 'u1'),
}));

vi.mock('./_lib/sloTracker.js', () => ({ recordLatency: vi.fn() }));
vi.mock('./_lib/costTracker.js', () => ({ recordTokens: vi.fn() }));
vi.mock('./_lib/aiCredits.js', () => ({
  reserveCredits: vi.fn(async () => ({ ok: true, amount: 5 })),
  refundCredits: vi.fn(async () => undefined),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => { throw new Error(SENSITIVE_UPSTREAM_TEXT); },
      };
    }
  },
}));

describe('/api/gemini — never leaks the raw upstream SDK error text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key-1234567890';
  });

  it('returns a generic error message, not the raw upstream text', async () => {
    const { default: handler } = await import('./gemini');
    const { req, res } = mockReqRes({});

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).not.toContain('secret-internal');
    expect(res.body.error).not.toContain('AIzaFAKEKEY123');
    expect(res.body.error).toBe('Серверска грешка (500).');
  });
});
