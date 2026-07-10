import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __testables } from './matura-grade';

describe('matura-grade pure helpers', () => {
  it('hashAnswer is deterministic for the same input', () => {
    expect(__testables.hashAnswer('2x+3')).toBe(__testables.hashAnswer('2x+3'));
    expect(__testables.hashAnswer('2x+3')).not.toBe(__testables.hashAnswer('2x+4'));
  });

  it('buildGradeCacheKey combines examId/questionNumber/hashed answer', () => {
    const key = __testables.buildGradeCacheKey('exam1', 3, 'answer');
    expect(key).toBe(`exam1_q3_${__testables.hashAnswer('answer')}`);
  });

  it('clampScore clamps to [0, maxScore] and rounds, defaulting non-numeric to 0', () => {
    expect(__testables.clampScore(5, 10)).toBe(5);
    expect(__testables.clampScore(-3, 10)).toBe(0);
    expect(__testables.clampScore(15, 10)).toBe(10);
    expect(__testables.clampScore(4.6, 10)).toBe(5);
    expect(__testables.clampScore('not a number', 10)).toBe(0);
    expect(__testables.clampScore(NaN, 10)).toBe(0);
  });

  it('safeParseJSON extracts and parses the first {...} block, tolerating surrounding text', () => {
    expect(__testables.safeParseJSON('here is json {"score":5,"correct":true} done')).toEqual({ score: 5, correct: true });
    expect(__testables.safeParseJSON(undefined)).toBeNull();
    expect(__testables.safeParseJSON('not json at all')).toBeNull();
    expect(__testables.safeParseJSON('{"broken":')).toBeNull();
  });

  it('splitTwoPartAnswer parses "A. x, B. y" in Latin or Cyrillic labels', () => {
    expect(__testables.splitTwoPartAnswer('A. 96, B. 10')).toEqual({ a: '96', b: '10' });
    expect(__testables.splitTwoPartAnswer('А. 5, Б. 7')).toEqual({ a: '5', b: '7' });
    expect(__testables.splitTwoPartAnswer('not a two-part answer')).toBeNull();
  });
});

// ─── Gate wiring: matura-grade must actually enforce auth/rate-limit/credit gates ──────────
// This is the regression the audit flagged (C1): the route previously skipped both.

function mockReqRes(body: Record<string, unknown> = {}) {
  const req = { method: 'POST', headers: { authorization: 'Bearer faketoken' }, body } as any;
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

const authenticateAndRateLimit = vi.fn();
const requireSufficientCredits = vi.fn();
const deductCreditsServerSide = vi.fn(async () => { /* no-op */ });
const generateContent = vi.fn();

vi.mock('./_lib/sharedUtils.js', () => ({
  setCorsHeaders: vi.fn(),
  authenticateAndRateLimit: (...args: unknown[]) => authenticateAndRateLimit(...args),
  requireSufficientCredits: (...args: unknown[]) => requireSufficientCredits(...args),
}));

vi.mock('./_lib/aiCredits.js', () => ({
  deductCreditsServerSide: (...args: unknown[]) => deductCreditsServerSide(...args),
}));

vi.mock('./_lib/sloTracker.js', () => ({ recordLatency: vi.fn() }));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: (...args: unknown[]) => generateContent(...args) };
    }
  },
}));

const firestoreDocs = new Map<string, Record<string, unknown>>();
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        const path = `${name}/${id}`;
        return {
          get: async () => ({
            exists: firestoreDocs.has(path),
            data: () => firestoreDocs.get(path),
          }),
          set: async (data: Record<string, unknown>) => { firestoreDocs.set(path, data); },
        };
      },
    }),
  }),
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));

describe('matura-grade — auth/credit gate wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreDocs.clear();
    process.env.GEMINI_API_KEY = 'test-key-1234567890';
  });
  afterEach(() => { delete process.env.GEMINI_API_KEY; });

  it('never calls Gemini when auth/rate-limit fails', async () => {
    authenticateAndRateLimit.mockImplementation(async (_req: unknown, res: any) => {
      res.status(401).json({ error: 'Invalid or expired authentication token' });
      return null;
    });
    const { default: handler } = await import('./matura-grade');
    const { req, res } = mockReqRes({ mode: 'part2', examId: 'e1', questionNumber: 1, questionText: 'Q', maxScore: 2, answer: 'x' });

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(requireSufficientCredits).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('never calls Gemini when the caller has insufficient credits', async () => {
    authenticateAndRateLimit.mockResolvedValue('u1');
    requireSufficientCredits.mockImplementation(async (_req: unknown, res: any) => {
      res.status(402).json({ error: 'Insufficient AI credits.', quotaType: 'credits' });
      return false;
    });
    const { default: handler } = await import('./matura-grade');
    const { req, res } = mockReqRes({ mode: 'part2', examId: 'e1', questionNumber: 1, questionText: 'Q', maxScore: 2, answer: 'x' });

    await handler(req, res);

    expect(res.statusCode).toBe(402);
    expect(generateContent).not.toHaveBeenCalled();
    expect(deductCreditsServerSide).not.toHaveBeenCalled();
  });

  it('grades, caches, and deducts credits once the gate passes (happy path)', async () => {
    authenticateAndRateLimit.mockResolvedValue('u1');
    requireSufficientCredits.mockResolvedValue(true);
    generateContent.mockResolvedValue({
      response: { text: () => '{"score":2,"correct":true,"comment":"ok","feedback":"Точно."}' },
    });
    const { default: handler } = await import('./matura-grade');
    const { req, res } = mockReqRes({
      mode: 'part2', examId: 'e1', questionNumber: 1, questionText: 'Реши равенка',
      correctAnswer: '5', answer: 'нешто различно', maxScore: 2,
    });

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ score: 2, correct: true });
    expect(deductCreditsServerSide).toHaveBeenCalledWith('u1', 'TEXT_BASIC');
    expect(firestoreDocs.size).toBe(1);
  });
});
