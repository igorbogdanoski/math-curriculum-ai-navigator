/**
 * Unit tests for the money/credit-mutating Cloud Functions callables
 * (deductCredits, grantReferralBonus, grantDemoCredits) — previously 0% covered.
 *
 * Strategy: mock 'firebase-functions/v1' so https.onCall(handler) returns the
 * inner handler directly (no live emulator needed), and mock 'firebase-admin'
 * with a small in-memory Firestore fake supporting collection/doc/get and
 * runTransaction. This exercises the real business logic (auth checks, tier
 * bypass rules, transaction math) without needing firebase-functions-test or
 * the emulator suite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above the rest of the module, so the HttpsError
// class must be declared inside the factory rather than referenced from outer scope.
vi.mock('firebase-functions/v1', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  }
  return {
    https: {
      onCall: (handler: (data: unknown, context: unknown) => unknown) => handler,
      HttpsError,
    },
    firestore: {
      document: () => ({
        onCreate: (handler: unknown) => handler,
        onWrite: (handler: unknown) => handler,
      }),
    },
  };
});

// ─── In-memory Firestore fake ──────────────────────────────────────────────────
type DocData = Record<string, unknown> | undefined;

function makeFakeFirestore(initialDocs: Record<string, DocData> = {}) {
  const store = new Map<string, DocData>(Object.entries(initialDocs));

  function makeDocRef(path: string) {
    return {
      __path: path,
      get: async () => ({
        exists: store.has(path) && store.get(path) !== undefined,
        data: () => store.get(path),
      }),
    };
  }

  function collection(name: string) {
    return { doc: (id: string) => makeDocRef(`${name}/${id}`) };
  }

  const tx = {
    get: async (ref: { __path: string }) => ({
      exists: store.has(ref.__path) && store.get(ref.__path) !== undefined,
      data: () => store.get(ref.__path),
    }),
    update: (ref: { __path: string }, data: Record<string, unknown>) => {
      store.set(ref.__path, { ...(store.get(ref.__path) ?? {}), ...data });
    },
    set: (ref: { __path: string }, data: Record<string, unknown>) => {
      store.set(ref.__path, data);
    },
  };

  return {
    collection,
    runTransaction: async (cb: (tx: typeof tx) => Promise<unknown>) => cb(tx),
    _store: store,
  };
}

let fakeDb: ReturnType<typeof makeFakeFirestore>;

vi.mock('firebase-admin', () => {
  const firestoreFn = vi.fn(() => fakeDb) as unknown as { (): unknown; FieldValue: unknown };
  firestoreFn.FieldValue = { serverTimestamp: () => 'SERVER_TS' };
  return {
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    auth: vi.fn(),
    messaging: vi.fn(),
  };
});

// Import after mocks are declared (vi.mock is hoisted, but the fakeDb assignment
// in beforeEach must run before each handler call, which it does since these are
// plain async functions invoked per-test, not re-imported).
import { deductCredits, grantReferralBonus, grantDemoCredits } from './index';

describe('deductCredits', () => {
  beforeEach(() => { fakeDb = makeFakeFirestore(); });

  it('rejects unauthenticated calls', async () => {
    await expect(deductCredits({ costKeys: ['TEXT_BASIC'] }, {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects a missing or empty costKeys array', async () => {
    await expect(deductCredits({}, { auth: { uid: 'u1' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(deductCredits({ costKeys: [] }, { auth: { uid: 'u1' } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects an unknown cost key — the server never trusts a raw client amount', async () => {
    await expect(deductCredits({ costKeys: ['NOT_A_REAL_COST'] }, { auth: { uid: 'u1' } }))
      .rejects.toMatchObject({ code: 'invalid-argument', message: expect.stringContaining('Unknown cost key') });
  });

  it('deducts the server-priced amount for a single cost key', async () => {
    fakeDb._store.set('users/u1', { aiCreditsBalance: 10, role: 'teacher', tier: 'Free' });
    const result = await deductCredits({ costKeys: ['TEXT_BASIC'] }, { auth: { uid: 'u1' } });
    expect(result).toEqual({ success: true, newBalance: 9 }); // TEXT_BASIC = 1
  });

  it('sums the server-priced amounts across multiple cost keys (e.g. text + illustration add-on)', async () => {
    fakeDb._store.set('users/u1', { aiCreditsBalance: 10, role: 'teacher', tier: 'Free' });
    const result = await deductCredits({ costKeys: ['TEXT_BASIC', 'ILLUSTRATION'] }, { auth: { uid: 'u1' } });
    expect(result).toEqual({ success: true, newBalance: 4 }); // 1 + 5 = 6 deducted
  });

  it('rejects when balance is insufficient for the requested cost', async () => {
    fakeDb._store.set('users/u1', { aiCreditsBalance: 3, role: 'teacher', tier: 'Free' });
    await expect(deductCredits({ costKeys: ['PRESENTATION'] }, { auth: { uid: 'u1' } })) // cost 10
      .rejects.toMatchObject({ code: 'resource-exhausted', message: expect.stringContaining('Insufficient AI credits') });
  });

  it('rejects when the user profile does not exist', async () => {
    await expect(deductCredits({ costKeys: ['TEXT_BASIC'] }, { auth: { uid: 'ghost' } }))
      .rejects.toMatchObject({ code: 'not-found', message: expect.stringContaining('User profile not found') });
  });

  it('bypasses deduction for admin role regardless of balance', async () => {
    fakeDb._store.set('users/admin1', { aiCreditsBalance: 0, role: 'admin' });
    const result = await deductCredits({ costKeys: ['ANNUAL_PLAN'] }, { auth: { uid: 'admin1' } });
    expect(result).toEqual({ success: true, newBalance: 0, bypassed: true });
    expect(fakeDb._store.get('users/admin1')).toEqual({ aiCreditsBalance: 0, role: 'admin' }); // unchanged
  });

  it('bypasses deduction for hasUnlimitedCredits regardless of balance', async () => {
    fakeDb._store.set('users/u1', { aiCreditsBalance: 0, role: 'teacher', hasUnlimitedCredits: true });
    const result = await deductCredits({ costKeys: ['ANNUAL_PLAN'] }, { auth: { uid: 'u1' } });
    expect(result).toMatchObject({ success: true, bypassed: true });
  });

  it('bypasses deduction for an active Pro tier', async () => {
    fakeDb._store.set('users/u1', { aiCreditsBalance: 0, role: 'teacher', tier: 'Pro' });
    const result = await deductCredits({ costKeys: ['ANNUAL_PLAN'] }, { auth: { uid: 'u1' } });
    expect(result).toMatchObject({ success: true, bypassed: true });
  });

  it('does NOT bypass an expired Pro tier — falls through to the real balance check', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    fakeDb._store.set('users/u1', { aiCreditsBalance: 0, role: 'teacher', tier: 'Pro', proExpiresAt: past });
    await expect(deductCredits({ costKeys: ['TEXT_BASIC'] }, { auth: { uid: 'u1' } }))
      .rejects.toMatchObject({ code: 'resource-exhausted', message: expect.stringContaining('Insufficient AI credits') });
  });
});

describe('grantReferralBonus', () => {
  beforeEach(() => { fakeDb = makeFakeFirestore(); });

  it('rejects unauthenticated calls', async () => {
    await expect(grantReferralBonus({ newUserUid: 'a', refCode: 'b' }, {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('requires both newUserUid and refCode', async () => {
    await expect(grantReferralBonus({ newUserUid: 'a' }, { auth: { uid: 'x' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(grantReferralBonus({ refCode: 'b' }, { auth: { uid: 'x' } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects self-referral', async () => {
    await expect(grantReferralBonus({ newUserUid: 'same', refCode: 'same' }, { auth: { uid: 'x' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects a caller claiming a referral bonus for an account that is not their own', async () => {
    // Security fix: without this check, any authenticated caller could pass two
    // arbitrary existing UIDs and farm free credits into accounts they don't own.
    fakeDb._store.set('users/referrer1', { aiCreditsBalance: 20 });
    fakeDb._store.set('users/newUser2', { aiCreditsBalance: 50 });

    await expect(grantReferralBonus({ newUserUid: 'newUser2', refCode: 'referrer1' }, { auth: { uid: 'someone-else' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    // Balances must be untouched.
    expect(fakeDb._store.get('users/referrer1')).toMatchObject({ aiCreditsBalance: 20 });
    expect(fakeDb._store.get('users/newUser2')).toMatchObject({ aiCreditsBalance: 50 });
  });

  it('rejects when either user does not exist', async () => {
    fakeDb._store.set('users/referrer1', { aiCreditsBalance: 0 });
    // newUser2 missing from store
    await expect(grantReferralBonus({ newUserUid: 'newUser2', refCode: 'referrer1' }, { auth: { uid: 'newUser2' } }))
      .rejects.toMatchObject({ code: 'not-found' });
  });

  it('grants +10 credits to both referrer and new user', async () => {
    fakeDb._store.set('users/referrer1', { aiCreditsBalance: 20 });
    fakeDb._store.set('users/newUser2', { aiCreditsBalance: 50 });

    const result = await grantReferralBonus({ newUserUid: 'newUser2', refCode: 'referrer1' }, { auth: { uid: 'newUser2' } });

    expect(result).toEqual({ success: true, alreadyGranted: false });
    expect(fakeDb._store.get('users/referrer1')).toMatchObject({ aiCreditsBalance: 30 });
    expect(fakeDb._store.get('users/newUser2')).toMatchObject({ aiCreditsBalance: 60 });
  });

  it('is idempotent — replaying an already-granted referral does not double-pay', async () => {
    fakeDb._store.set('users/referrer1', { aiCreditsBalance: 20 });
    fakeDb._store.set('users/newUser2', { aiCreditsBalance: 50 });
    fakeDb._store.set('referrals/referrer1_newUser2', { bonusGranted: true });

    const result = await grantReferralBonus({ newUserUid: 'newUser2', refCode: 'referrer1' }, { auth: { uid: 'newUser2' } });

    expect(result).toEqual({ success: true, alreadyGranted: true });
    // Balances must be untouched — this is the whole point of the idempotency guard
    expect(fakeDb._store.get('users/referrer1')).toMatchObject({ aiCreditsBalance: 20 });
    expect(fakeDb._store.get('users/newUser2')).toMatchObject({ aiCreditsBalance: 50 });
  });
});

describe('grantDemoCredits', () => {
  beforeEach(() => { fakeDb = makeFakeFirestore(); });

  it('rejects unauthenticated calls', async () => {
    await expect(grantDemoCredits({ targetUid: 'u1' }, {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects a non-admin caller', async () => {
    fakeDb._store.set('users/caller1', { role: 'teacher' });
    await expect(grantDemoCredits({ targetUid: 'u1' }, { auth: { uid: 'caller1' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('requires targetUid', async () => {
    fakeDb._store.set('users/admin1', { role: 'admin' });
    await expect(grantDemoCredits({}, { auth: { uid: 'admin1' } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects when the target user does not exist', async () => {
    fakeDb._store.set('users/admin1', { role: 'admin' });
    await expect(grantDemoCredits({ targetUid: 'ghost' }, { auth: { uid: 'admin1' } })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('grants the default 50 credits when amount is omitted', async () => {
    fakeDb._store.set('users/admin1', { role: 'admin' });
    fakeDb._store.set('users/target1', { aiCreditsBalance: 5 });

    const result = await grantDemoCredits({ targetUid: 'target1' }, { auth: { uid: 'admin1' } });

    expect(result).toEqual({ success: true, newBalance: 55 });
  });

  it('caps the granted amount at 500 even if a larger amount is requested', async () => {
    fakeDb._store.set('users/admin1', { role: 'admin' });
    fakeDb._store.set('users/target1', { aiCreditsBalance: 0 });

    const result = await grantDemoCredits({ targetUid: 'target1', amount: 99999 }, { auth: { uid: 'admin1' } });

    expect(result).toEqual({ success: true, newBalance: 500 });
  });

  it('ignores a non-positive requested amount and falls back to the 50-credit default', async () => {
    fakeDb._store.set('users/admin1', { role: 'admin' });
    fakeDb._store.set('users/target1', { aiCreditsBalance: 0 });

    const result = await grantDemoCredits({ targetUid: 'target1', amount: -10 }, { auth: { uid: 'admin1' } });

    expect(result).toEqual({ success: true, newBalance: 50 });
  });
});
