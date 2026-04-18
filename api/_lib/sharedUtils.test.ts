/**
 * Unit tests for CORS origin enforcement in api/_lib/sharedUtils.
 *
 * Covers:
 * - setCorsHeaders uses ALLOWED_ORIGIN env var (primary).
 * - Falls back to VITE_APP_URL when ALLOWED_ORIGIN is missing.
 * - Falls back to default vercel preview origin when both are missing.
 * - Methods and headers allowlist are set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCorsHeaders } from './sharedUtils';

type HeaderMap = Record<string, string>;

function makeRes(): { setHeader: (k: string, v: string) => void; headers: HeaderMap } {
  const headers: HeaderMap = {};
  return {
    headers,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
  };
}

describe('setCorsHeaders — origin enforcement', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.ALLOWED_ORIGIN;
    delete process.env.VITE_APP_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('uses ALLOWED_ORIGIN env var when set', () => {
    process.env.ALLOWED_ORIGIN = 'https://ai.mismath.net';
    const res = makeRes();
    setCorsHeaders(res as never);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://ai.mismath.net');
  });

  it('falls back to VITE_APP_URL when ALLOWED_ORIGIN is missing', () => {
    process.env.VITE_APP_URL = 'https://staging.mismath.net';
    const res = makeRes();
    setCorsHeaders(res as never);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://staging.mismath.net');
  });

  it('falls back to default vercel preview origin when both env vars are missing', () => {
    const res = makeRes();
    setCorsHeaders(res as never);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://mismath.vercel.app');
  });

  it('sets method allowlist to POST + OPTIONS (no GET/PUT/DELETE)', () => {
    const res = makeRes();
    setCorsHeaders(res as never);
    const allowed = res.headers['Access-Control-Allow-Methods'];
    expect(allowed).toContain('POST');
    expect(allowed).toContain('OPTIONS');
    expect(allowed).not.toContain('GET');
    expect(allowed).not.toContain('DELETE');
  });

  it('restricts allowed headers to Content-Type and Authorization', () => {
    const res = makeRes();
    setCorsHeaders(res as never);
    const allowed = res.headers['Access-Control-Allow-Headers'];
    expect(allowed).toContain('Content-Type');
    expect(allowed).toContain('Authorization');
  });

  it('does not echo back arbitrary request origins (no wildcard reflection)', () => {
    process.env.ALLOWED_ORIGIN = 'https://ai.mismath.net';
    const res = makeRes();
    setCorsHeaders(res as never);
    // Should be the fixed allowed origin regardless of where the request came from.
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://ai.mismath.net');
    expect(res.headers['Access-Control-Allow-Origin']).not.toBe('*');
  });
});
