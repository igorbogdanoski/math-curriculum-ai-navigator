/**
 * api/cas-verify.test.ts — unit tests for /api/cas-verify.
 *
 * Mocks getFirebaseAdmin so the endpoint runs in its dev-mode auth-bypass path
 * (NODE_ENV !== 'production'), matching how /api/health.test.ts avoids needing a
 * live Firebase Admin instance in unit tests.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./_lib/sharedUtils.js', async () => {
  const actual = await vi.importActual<typeof import('./_lib/sharedUtils')>('./_lib/sharedUtils');
  return { ...actual, getFirebaseAdmin: vi.fn(() => null) };
});

import handler from './cas-verify';

function mockReqRes(method: string, body?: unknown) {
  const req = { method, headers: {}, socket: {}, body } as any;
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

describe('/api/cas-verify', () => {
  it('responds 200 on OPTIONS preflight', async () => {
    const { req, res } = mockReqRes('OPTIONS');
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it('rejects GET with 405', async () => {
    const { req, res } = mockReqRes('GET');
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('mode=equivalence: returns equivalent for the flagship "2x+2 vs 2+2x" case', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'equivalence', latexA: '2x+2', latexB: '2+2x' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ verdict: 'equivalent' });
  });

  it('mode=equivalence: returns 400 when latexA/latexB are missing', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'equivalence', latexA: '2x' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('mode=equation: confirms a correct claimed root', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'equation', equation: '2x+3=7', variable: 'x', claimedValue: '2' });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ verdict: 'equivalent' });
  });

  it('mode=equation: returns 400 when required fields are missing', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'equation', equation: '2x+3=7' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for an unknown mode', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'not_a_real_mode' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('sets CORS headers on every response', async () => {
    const { req, res } = mockReqRes('POST', { mode: 'equivalence', latexA: '1', latexB: '1' });
    await handler(req, res);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });
});
