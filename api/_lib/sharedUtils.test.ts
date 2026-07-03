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
import { setCorsHeaders, evaluateCreditGate } from './sharedUtils';

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

describe('evaluateCreditGate — credit paywall decision logic', () => {
  it('a fresh free-tier user (50 credits) is not bypassed and has a positive balance', () => {
    const { bypassed, balance } = evaluateCreditGate({ role: 'teacher', tier: 'Free', aiCreditsBalance: 50 });
    expect(bypassed).toBe(false);
    expect(balance).toBe(50);
  });

  it('a user with 0 balance and no special tier is not bypassed', () => {
    const { bypassed, balance } = evaluateCreditGate({ role: 'teacher', tier: 'Free', aiCreditsBalance: 0 });
    expect(bypassed).toBe(false);
    expect(balance).toBe(0);
  });

  it('missing aiCreditsBalance defaults to 0, not undefined/NaN', () => {
    const { balance } = evaluateCreditGate({ role: 'teacher' });
    expect(balance).toBe(0);
  });

  it('admin role bypasses regardless of balance', () => {
    const { bypassed } = evaluateCreditGate({ role: 'admin', aiCreditsBalance: 0 });
    expect(bypassed).toBe(true);
  });

  it('hasUnlimitedCredits bypasses regardless of balance', () => {
    const { bypassed } = evaluateCreditGate({ role: 'teacher', hasUnlimitedCredits: true, aiCreditsBalance: 0 });
    expect(bypassed).toBe(true);
  });

  it('School and Unlimited tiers bypass regardless of balance', () => {
    expect(evaluateCreditGate({ tier: 'School', aiCreditsBalance: 0 }).bypassed).toBe(true);
    expect(evaluateCreditGate({ tier: 'Unlimited', aiCreditsBalance: 0 }).bypassed).toBe(true);
  });

  it('active Pro tier (no expiry) bypasses regardless of balance', () => {
    const { bypassed } = evaluateCreditGate({ tier: 'Pro', aiCreditsBalance: 0 });
    expect(bypassed).toBe(true);
  });

  it('active Pro tier (future expiry) bypasses', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const { bypassed } = evaluateCreditGate({ tier: 'Pro', proExpiresAt: future, aiCreditsBalance: 0 });
    expect(bypassed).toBe(true);
  });

  it('EXPIRED Pro tier does NOT bypass — must fall back to the real balance check', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const { bypassed } = evaluateCreditGate({ tier: 'Pro', proExpiresAt: past, aiCreditsBalance: 0 });
    expect(bypassed).toBe(false);
  });

  it('isPremium=true bypasses like an active Pro tier', () => {
    const { bypassed } = evaluateCreditGate({ isPremium: true, aiCreditsBalance: 0 });
    expect(bypassed).toBe(true);
  });
});
