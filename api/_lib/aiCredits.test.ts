import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deductCreditsServerSide, reserveCredits, refundCredits } from './aiCredits';
import { getFirebaseAdmin } from './sharedUtils';

vi.mock('./sharedUtils', () => ({
  getFirebaseAdmin: vi.fn(() => ({})), // truthy — pretend a service account is configured
  evaluateCreditGate: vi.fn((data: Record<string, unknown>) => {
    const balance = typeof data.aiCreditsBalance === 'number' ? data.aiCreditsBalance : 0;
    const bypassed = data.role === 'admin' || data.hasUnlimitedCredits === true;
    return { bypassed, balance };
  }),
}));

// Minimal fake Firestore transaction harness — captures what `.update()` was called with.
function makeFirestoreMock(userData: Record<string, unknown> | undefined) {
  const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  const docRef = { path: 'users/u1' };
  const runTransaction = vi.fn(async (fn: (t: unknown) => Promise<unknown>) => {
    const transaction = {
      get: vi.fn(async () => ({
        exists: userData !== undefined,
        data: () => userData,
      })),
      update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
        updateCalls.push({ path: ref.path, data });
      }),
    };
    return await fn(transaction);
  });
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => docRef) })),
    runTransaction,
  };
  return { db, updateCalls };
}

describe('deductCreditsServerSide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirebaseAdmin).mockReturnValue({} as any);
  });

  it('no-ops locally when no service account is configured', async () => {
    vi.mocked(getFirebaseAdmin).mockReturnValue(null as any);
    await expect(deductCreditsServerSide('u1', 'TEXT_BASIC')).resolves.toBeUndefined();
  });

  it('decrements balance by the costKey amount for a Free-tier user', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await fn('u1', 'TEXT_BASIC'); // TEXT_BASIC = 1

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 9 });
  });

  it('floors at 0 rather than going negative', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 2, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await fn('u1', 'PRESENTATION'); // PRESENTATION = 10, balance only 2

    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 0 });
  });

  it('falls back to TEXT_BASIC cost for an unknown/missing costKey', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await fn('u1', 'NOT_A_REAL_KEY');

    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 9 }); // TEXT_BASIC = 1
  });

  it('enforces the model floor when costKey under-declares relative to the model used', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 20, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    // TEXT_BASIC=1, but the ultimate model floor (8) should win.
    await fn('u1', 'TEXT_BASIC', 'gemini-3.1-pro-preview');

    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 12 });
  });

  it('uses the declared costKey amount when it already exceeds the model floor', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 20, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    // ANNUAL_PLAN=10 already exceeds the default-model floor (1).
    await fn('u1', 'ANNUAL_PLAN', 'gemini-3-flash-preview');

    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 10 });
  });

  it('skips the floor entirely when no model is passed (backward compatible)', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 20, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await fn('u1', 'TEXT_BASIC');

    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 19 });
  });

  it('does not write anything when the user is bypassed (admin/unlimited)', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10, role: 'admin' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await fn('u1', 'ANNUAL_PLAN');

    expect(updateCalls).toHaveLength(0);
  });

  it('does not throw when the user doc does not exist', async () => {
    const { db, updateCalls } = makeFirestoreMock(undefined);
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await expect(fn('ghost', 'TEXT_BASIC')).resolves.toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });

  it('swallows a transaction failure instead of throwing', async () => {
    const db = {
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ path: 'users/u1' })) })),
      runTransaction: vi.fn(async () => { throw new Error('firestore unavailable'); }),
    };
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { deductCreditsServerSide: fn } = await import('./aiCredits');

    await expect(fn('u1', 'TEXT_BASIC')).resolves.toBeUndefined();
  });
});

// 2026-07-18 (audit_2026_07_18_full_app_review): reserveCredits()/refundCredits() replace the
// old check-then-later-deduct pair (requireSufficientCredits + deductCreditsServerSide) at the
// actual billing call sites — the check and the deduction now happen in the SAME transaction,
// closing a race where concurrent requests at low balance could each pass an earlier, separate
// balance check before any of them had deducted.
describe('reserveCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirebaseAdmin).mockReturnValue({} as any);
  });

  it('no-ops (ok:true, amount:0) locally when no service account is configured', async () => {
    vi.mocked(getFirebaseAdmin).mockReturnValue(null as any);
    await expect(reserveCredits('u1', 'TEXT_BASIC')).resolves.toEqual({ ok: true, amount: 0 });
  });

  it('reserves (checks and deducts atomically) for a Free-tier user with sufficient balance', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'TEXT_BASIC')).resolves.toEqual({ ok: true, amount: 1 });
    expect(updateCalls).toEqual([{ path: 'users/u1', data: { aiCreditsBalance: 9 } }]);
  });

  it('rejects (ok:false) without writing anything when balance is already 0', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 0, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'TEXT_BASIC')).resolves.toEqual({ ok: false, amount: 0 });
    expect(updateCalls).toHaveLength(0);
  });

  it('bypasses (ok:true, amount:0, no write) for an admin/unlimited user', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10, role: 'admin' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'ANNUAL_PLAN')).resolves.toEqual({ ok: true, amount: 0 });
    expect(updateCalls).toHaveLength(0);
  });

  it('rejects when the user doc does not exist', async () => {
    const { db, updateCalls } = makeFirestoreMock(undefined);
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('ghost', 'TEXT_BASIC')).resolves.toEqual({ ok: false, amount: 0 });
    expect(updateCalls).toHaveLength(0);
  });

  it('enforces the model floor, same as deductCreditsServerSide', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 20, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'TEXT_BASIC', 'gemini-3.1-pro-preview')).resolves.toEqual({ ok: true, amount: 8 });
    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 12 });
  });

  it('floors the new balance at 0 rather than going negative', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 2, tier: 'Free' });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'PRESENTATION')).resolves.toEqual({ ok: true, amount: 10 });
    expect(updateCalls[0].data).toEqual({ aiCreditsBalance: 0 });
  });

  it('rejects (ok:false, amount:0) instead of throwing when the transaction fails', async () => {
    const db = {
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ path: 'users/u1' })) })),
      runTransaction: vi.fn(async () => { throw new Error('firestore unavailable'); }),
    };
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { reserveCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 'TEXT_BASIC')).resolves.toEqual({ ok: false, amount: 0 });
  });
});

describe('refundCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFirebaseAdmin).mockReturnValue({} as any);
  });

  it('no-ops locally when no service account is configured', async () => {
    vi.mocked(getFirebaseAdmin).mockReturnValue(null as any);
    await expect(refundCredits('u1', 5)).resolves.toBeUndefined();
  });

  it('no-ops for a zero or negative amount (covers the bypassed/local-dev reservation case)', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 10 });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { refundCredits: fn } = await import('./aiCredits');

    await fn('u1', 0);
    await fn('u1', -5);
    expect(updateCalls).toHaveLength(0);
  });

  it('adds the amount back to the current balance', async () => {
    const { db, updateCalls } = makeFirestoreMock({ aiCreditsBalance: 4 });
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { refundCredits: fn } = await import('./aiCredits');

    await fn('u1', 6);
    expect(updateCalls).toEqual([{ path: 'users/u1', data: { aiCreditsBalance: 10 } }]);
  });

  it('does not throw when the user doc does not exist', async () => {
    const { db, updateCalls } = makeFirestoreMock(undefined);
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { refundCredits: fn } = await import('./aiCredits');

    await expect(fn('ghost', 5)).resolves.toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });

  it('swallows a transaction failure instead of throwing', async () => {
    const db = {
      collection: vi.fn(() => ({ doc: vi.fn(() => ({ path: 'users/u1' })) })),
      runTransaction: vi.fn(async () => { throw new Error('firestore unavailable'); }),
    };
    vi.doMock('firebase-admin/firestore', () => ({ getFirestore: () => db }));
    vi.resetModules();
    const { refundCredits: fn } = await import('./aiCredits');

    await expect(fn('u1', 5)).resolves.toBeUndefined();
  });
});
