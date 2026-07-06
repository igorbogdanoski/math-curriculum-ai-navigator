import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deductCreditsServerSide } from './aiCredits';
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
  const runTransaction = vi.fn(async (fn: (t: unknown) => Promise<void>) => {
    const transaction = {
      get: vi.fn(async () => ({
        exists: userData !== undefined,
        data: () => userData,
      })),
      update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
        updateCalls.push({ path: ref.path, data });
      }),
    };
    await fn(transaction);
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
