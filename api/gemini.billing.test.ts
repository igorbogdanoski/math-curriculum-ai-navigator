import { describe, it, expect, vi, beforeEach } from 'vitest';

// Focused regression test for H5: the server must not bill for a response it asked for
// as JSON but that came back malformed/unrecoverable — see utils/jsonRecovery.ts.

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

const deductCreditsServerSide = vi.fn(async () => { /* no-op */ });
let mockResponseText = '{"ok":true}';

vi.mock('./_lib/sharedUtils.js', () => ({
  setCorsHeaders: vi.fn(),
  authenticateAndValidate: vi.fn(async (req: { body: Record<string, unknown> }) => ({
    model: 'gemini-3-flash-preview',
    contents: 'hello',
    config: { responseMimeType: 'application/json' },
    costKey: req.body.costKey as string | undefined,
  })),
  requireSufficientCredits: vi.fn(async () => true),
  getRequestPrincipal: vi.fn(() => 'u1'),
}));

vi.mock('./_lib/sloTracker.js', () => ({ recordLatency: vi.fn() }));
vi.mock('./_lib/costTracker.js', () => ({ recordTokens: vi.fn() }));
vi.mock('./_lib/aiCredits.js', () => ({
  deductCreditsServerSide: (...args: unknown[]) => deductCreditsServerSide(...args),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: {
            candidates: [{ content: {} }],
            text: () => mockResponseText,
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
          },
        }),
      };
    }
  },
}));

describe('/api/gemini — billing gate on JSON responses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key-1234567890';
  });

  it('does not deduct credits when the response is malformed, unrecoverable JSON', async () => {
    mockResponseText = 'Извинете, не можам да генерирам.';
    const { default: handler } = await import('./gemini');
    const { req, res } = mockReqRes({ costKey: 'TEXT_BASIC' });

    await handler(req, res);

    expect(res.statusCode).toBe(200); // still returns the response to the client
    expect(deductCreditsServerSide).not.toHaveBeenCalled();
  });

  it('deducts credits once when the response is valid JSON', async () => {
    mockResponseText = '{"title":"T","questions":[]}';
    const { default: handler } = await import('./gemini');
    const { req, res } = mockReqRes({ costKey: 'TEXT_BASIC' });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(deductCreditsServerSide).toHaveBeenCalledTimes(1);
    expect(deductCreditsServerSide).toHaveBeenCalledWith('u1', 'TEXT_BASIC', 'gemini-3-flash-preview');
  });

  it('deducts credits for recoverable truncated JSON, not just perfectly-formed JSON', async () => {
    mockResponseText = '{"title":"T","items":["a","b unfinis';
    const { default: handler } = await import('./gemini');
    const { req, res } = mockReqRes({ costKey: 'TEXT_BASIC' });

    await handler(req, res);

    expect(deductCreditsServerSide).toHaveBeenCalledTimes(1);
  });
});
