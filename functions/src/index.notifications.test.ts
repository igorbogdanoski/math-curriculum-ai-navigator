/**
 * Unit tests for the fork/rate/adapt FCM notification triggers
 * (onScenarioForkedOrRated, onDuggaTestAdapted, onAnnualPlanForked).
 *
 * Strategy matches index.creditFunctions.test.ts: mock 'firebase-functions/v1' so
 * firestore.document(...).onCreate/onWrite return the inner handler directly, and
 * mock 'firebase-admin' with a small in-memory Firestore fake plus a spy-able
 * messaging().sendEachForMulticast().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      delete: async () => { store.delete(path); },
    };
  }

  function collection(name: string) {
    return { doc: (id: string) => makeDocRef(`${name}/${id}`) };
  }

  return { collection, _store: store };
}

let fakeDb: ReturnType<typeof makeFakeFirestore>;
let sendEachForMulticast: ReturnType<typeof vi.fn>;

vi.mock('firebase-admin', () => {
  const firestoreFn = vi.fn(() => fakeDb) as unknown as { (): unknown; FieldValue: unknown };
  firestoreFn.FieldValue = { serverTimestamp: () => 'SERVER_TS' };
  return {
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    messaging: vi.fn(() => ({ sendEachForMulticast: (...args: unknown[]) => sendEachForMulticast(...args) })),
  };
});

import { onScenarioForkedOrRated, onDuggaTestAdapted, onAnnualPlanForked } from './index';

function makeChange(before: DocData, after: DocData) {
  return {
    before: { exists: before !== undefined, data: () => before },
    after: { exists: after !== undefined, data: () => after },
  };
}

function makeSnap(data: DocData, id = 'new-doc-id') {
  return { id, data: () => data };
}

describe('onScenarioForkedOrRated', () => {
  beforeEach(() => {
    sendEachForMulticast = vi.fn().mockResolvedValue({ responses: [{ success: true }] });
  });

  it('notifies the original author when a new fork is created', async () => {
    fakeDb = makeFakeFirestore({
      'user_tokens/original-uid_web': { token: 'tok-original' },
      'users/forker-uid': { name: 'Марија' },
    });

    const after = { authorUid: 'forker-uid', originalAuthorUid: 'original-uid', title: 'Мојот план' };
    await (onScenarioForkedOrRated as any)(makeChange(undefined, after), { params: { entryId: 'entry-1' } });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const [payload] = sendEachForMulticast.mock.calls[0];
    expect(payload.tokens).toEqual(['tok-original']);
    expect(payload.notification.title).toContain('Марија');
    expect(payload.data.type).toBe('scenario_forked');
  });

  it('does not notify when the fork has no originalAuthorUid (not a fork)', async () => {
    fakeDb = makeFakeFirestore();
    const after = { authorUid: 'author-uid', title: 'Оригинал' };
    await (onScenarioForkedOrRated as any)(makeChange(undefined, after), { params: { entryId: 'entry-1' } });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('notifies the entry author when a new rating is added', async () => {
    fakeDb = makeFakeFirestore({
      'user_tokens/author-uid_web': { token: 'tok-author' },
      'users/rater-uid': { name: 'Петар' },
    });

    const before = { authorUid: 'author-uid', title: 'Тест', ratingsByUid: {} };
    const after = { authorUid: 'author-uid', title: 'Тест', ratingsByUid: { 'rater-uid': 5 } };
    await (onScenarioForkedOrRated as any)(makeChange(before, after), { params: { entryId: 'entry-1' } });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const [payload] = sendEachForMulticast.mock.calls[0];
    expect(payload.tokens).toEqual(['tok-author']);
    expect(payload.notification.title).toContain('Петар');
    expect(payload.data.type).toBe('scenario_rated');
  });

  it('does not notify on self-rating', async () => {
    fakeDb = makeFakeFirestore({ 'user_tokens/author-uid_web': { token: 'tok-author' } });
    const before = { authorUid: 'author-uid', ratingsByUid: {} };
    const after = { authorUid: 'author-uid', ratingsByUid: { 'author-uid': 4 } };
    await (onScenarioForkedOrRated as any)(makeChange(before, after), { params: { entryId: 'entry-1' } });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('does not notify when a rating is unchanged', async () => {
    fakeDb = makeFakeFirestore({ 'user_tokens/author-uid_web': { token: 'tok-author' } });
    const before = { authorUid: 'author-uid', ratingsByUid: { 'rater-uid': 5 } };
    const after = { authorUid: 'author-uid', ratingsByUid: { 'rater-uid': 5 } };
    await (onScenarioForkedOrRated as any)(makeChange(before, after), { params: { entryId: 'entry-1' } });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('prunes a stale token when delivery fails with a stale-token error code', async () => {
    fakeDb = makeFakeFirestore({
      'user_tokens/original-uid_web': { token: 'stale-tok' },
      'users/forker-uid': { name: 'Марија' },
    });
    sendEachForMulticast = vi.fn().mockResolvedValue({
      responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }],
    });

    const after = { authorUid: 'forker-uid', originalAuthorUid: 'original-uid', title: 'План' };
    await (onScenarioForkedOrRated as any)(makeChange(undefined, after), { params: { entryId: 'entry-1' } });

    expect(fakeDb._store.has('user_tokens/original-uid_web')).toBe(false);
  });
});

describe('onDuggaTestAdapted', () => {
  beforeEach(() => {
    sendEachForMulticast = vi.fn().mockResolvedValue({ responses: [{ success: true }] });
  });

  it('notifies the original author when a test is adapted', async () => {
    fakeDb = makeFakeFirestore({ 'user_tokens/original-uid_web': { token: 'tok-original' } });
    const test = {
      teacherUid: 'adapter-uid', teacherName: 'Ана',
      originalAuthorUid: 'original-uid', adaptedFromTitle: 'Тест за алгебра',
    };
    await (onDuggaTestAdapted as any)(makeSnap(test));

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const [payload] = sendEachForMulticast.mock.calls[0];
    expect(payload.notification.title).toContain('Ана');
    expect(payload.data.type).toBe('dugga_adapted');
  });

  it('does not notify when there is no adaptation (no originalAuthorUid)', async () => {
    fakeDb = makeFakeFirestore();
    const test = { teacherUid: 'author-uid', teacherName: 'Ана' };
    await (onDuggaTestAdapted as any)(makeSnap(test));
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('does not notify when adapting your own test', async () => {
    fakeDb = makeFakeFirestore({ 'user_tokens/same-uid_web': { token: 'tok' } });
    const test = { teacherUid: 'same-uid', originalAuthorUid: 'same-uid' };
    await (onDuggaTestAdapted as any)(makeSnap(test));
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});

describe('onAnnualPlanForked', () => {
  beforeEach(() => {
    sendEachForMulticast = vi.fn().mockResolvedValue({ responses: [{ success: true }] });
  });

  it('notifies the original author when a plan is forked', async () => {
    fakeDb = makeFakeFirestore({
      'user_tokens/original-uid_web': { token: 'tok-original' },
      'users/forker-uid': { name: 'Иван' },
    });
    const plan = { userId: 'forker-uid', isForked: true, originalAuthorUid: 'original-uid', subject: 'Математика', grade: '8' };
    await (onAnnualPlanForked as any)(makeSnap(plan));

    expect(sendEachForMulticast).toHaveBeenCalledTimes(1);
    const [payload] = sendEachForMulticast.mock.calls[0];
    expect(payload.notification.title).toContain('Иван');
    expect(payload.data.type).toBe('annual_plan_forked');
  });

  it('does not notify for a non-forked plan', async () => {
    fakeDb = makeFakeFirestore();
    const plan = { userId: 'author-uid', isForked: false };
    await (onAnnualPlanForked as any)(makeSnap(plan));
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});
