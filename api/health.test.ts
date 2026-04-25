/**
 * api/health.test.ts — S41-D5 unit tests for /api/health.
 */
import { describe, expect, it, vi } from 'vitest';
import handler from './health';

function mockReqRes(method: string) {
  const req = { method, headers: {}, query: {} } as any;
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

describe('/api/health', () => {
  it('responds 200 with ok body on GET', async () => {
    const { req, res } = mockReqRes('GET');
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'math-curriculum-ai-navigator' });
    expect(typeof (res.body as any).timestamp).toBe('string');
    expect(typeof (res.body as any).uptimeMs).toBe('number');
  });

  it('responds 200 with no body on HEAD', async () => {
    const { req, res } = mockReqRes('HEAD');
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
  });

  it('responds 204 on OPTIONS preflight', async () => {
    const { req, res } = mockReqRes('OPTIONS');
    await handler(req, res);
    expect(res.statusCode).toBe(204);
  });

  it('rejects POST with 405', async () => {
    const { req, res } = mockReqRes('POST');
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('sets no-store cache header', async () => {
    const { req, res } = mockReqRes('GET');
    await handler(req, res);
    expect(res.headers['Cache-Control']).toContain('no-store');
  });
});
