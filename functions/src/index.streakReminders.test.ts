/**
 * Unit tests for the P3 daily streak-reminder scheduled function
 * (sendDailyStreakReminders) and its pure eligibility check (isStreakAtRisk).
 *
 * Strategy matches index.notifications.test.ts: mock 'firebase-functions/v1'
 * so pubsub.schedule(...).timeZone(...).onRun(handler) returns the inner
 * handler directly, and mock 'firebase-admin' with a small in-memory
 * Firestore fake — extended here to support the collection-level
 * where().orderBy().limit().get() query this function needs (student_accounts
 * whole-collection scan, quiz_results filtered-by-deviceId lookup).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  https: { onCall: (handler: unknown) => handler },
  firestore: {
    document: () => ({
      onCreate: (handler: unknown) => handler,
      onWrite: (handler: unknown) => handler,
    }),
  },
  pubsub: {
    schedule: () => ({ timeZone: () => ({ onRun: (handler: () => Promise<unknown>) => handler }) }),
  },
}));

type DocData = Record<string, unknown> | undefined;

function makeFakeFirestore(
  collections: Record<string, Record<string, DocData>> = {},
) {
  function makeDocRef(collName: string, id: string) {
    return {
      id,
      get: async () => {
        const data = collections[collName]?.[id];
        return { exists: data !== undefined, data: () => data };
      },
    };
  }

  function collection(name: string) {
    const docs = collections[name] ?? {};
    const api = {
      doc: (id: string) => makeDocRef(name, id),
      // Whole-collection scan (student_accounts)
      get: async () => ({
        docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })),
      }),
      // Filtered scan (quiz_results — only the pieces this function needs)
      where: (field: string, _op: string, value: unknown) => ({
        orderBy: () => ({
          limit: (n: number) => ({
            get: async () => ({
              empty: false,
              docs: Object.entries(docs)
                .filter(([, data]) => (data as Record<string, unknown> | undefined)?.[field] === value)
                .slice(0, n)
                .map(([id, data]) => ({ id, data: () => data })),
            }),
          }),
        }),
      }),
    };
    return api;
  }

  return { collection };
}

let fakeDb: ReturnType<typeof makeFakeFirestore>;
let sendMock: ReturnType<typeof vi.fn>;

vi.mock('firebase-admin', () => {
  const firestoreFn = vi.fn(() => fakeDb) as unknown as { (): unknown; FieldValue: unknown };
  firestoreFn.FieldValue = { serverTimestamp: () => 'SERVER_TS' };
  return {
    initializeApp: vi.fn(),
    firestore: firestoreFn,
    messaging: vi.fn(() => ({ send: (...args: unknown[]) => sendMock(...args) })),
  };
});

import { sendDailyStreakReminders, isStreakAtRisk } from './index';

describe('isStreakAtRisk', () => {
  it('is at risk when currentStreak > 0 and last activity was yesterday', () => {
    expect(isStreakAtRisk({ currentStreak: 3, lastActivityDate: '2026-07-11' }, '2026-07-11')).toBe(true);
  });

  it('is not at risk when the student already played today (lastActivityDate is today, not yesterday)', () => {
    expect(isStreakAtRisk({ currentStreak: 3, lastActivityDate: '2026-07-12' }, '2026-07-11')).toBe(false);
  });

  it('is not at risk when the streak already lapsed (last activity older than yesterday)', () => {
    expect(isStreakAtRisk({ currentStreak: 3, lastActivityDate: '2026-07-05' }, '2026-07-11')).toBe(false);
  });

  it('is not at risk when there is no streak to lose', () => {
    expect(isStreakAtRisk({ currentStreak: 0, lastActivityDate: '2026-07-11' }, '2026-07-11')).toBe(false);
  });

  it('is not at risk when there is no gamification record at all', () => {
    expect(isStreakAtRisk(undefined, '2026-07-11')).toBe(false);
  });
});

describe('sendDailyStreakReminders', () => {
  beforeEach(() => {
    sendMock = vi.fn().mockResolvedValue('message-id');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T18:00:00'));
  });

  it('sends a push to a Google-linked student whose streak lapses today', async () => {
    fakeDb = makeFakeFirestore({
      student_accounts: {
        'uid-1': { name: 'Марко', linkedDeviceIds: ['device-1'] },
      },
      quiz_results: {
        'q-1': { deviceId: 'device-1', teacherUid: 'teacher-1', playedAt: 'x' },
      },
      student_gamification: {
        'teacher-1_Марко': { currentStreak: 5, lastActivityDate: '2026-07-11' },
      },
      user_tokens: {
        'uid-1_web': { token: 'fcm-token-1' },
      },
    });

    await (sendDailyStreakReminders as any)();

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload] = sendMock.mock.calls[0];
    expect(payload.token).toBe('fcm-token-1');
    expect(payload.notification.body).toContain('5');
    expect(payload.data.type).toBe('streak_reminder');
  });

  it('does not notify a student who already played today', async () => {
    fakeDb = makeFakeFirestore({
      student_accounts: { 'uid-1': { name: 'Марко', linkedDeviceIds: ['device-1'] } },
      quiz_results: { 'q-1': { deviceId: 'device-1', teacherUid: 'teacher-1' } },
      student_gamification: { 'teacher-1_Марко': { currentStreak: 5, lastActivityDate: '2026-07-12' } },
      user_tokens: { 'uid-1_web': { token: 'fcm-token-1' } },
    });

    await (sendDailyStreakReminders as any)();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does not notify a student with no linked devices (never bridged to a teacherUid)', async () => {
    fakeDb = makeFakeFirestore({
      student_accounts: { 'uid-1': { name: 'Марко', linkedDeviceIds: [] } },
    });

    await (sendDailyStreakReminders as any)();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('does not notify when the student has no FCM token registered', async () => {
    fakeDb = makeFakeFirestore({
      student_accounts: { 'uid-1': { name: 'Марко', linkedDeviceIds: ['device-1'] } },
      quiz_results: { 'q-1': { deviceId: 'device-1', teacherUid: 'teacher-1' } },
      student_gamification: { 'teacher-1_Марко': { currentStreak: 5, lastActivityDate: '2026-07-11' } },
      user_tokens: {},
    });

    await (sendDailyStreakReminders as any)();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('one malformed student_accounts entry does not block a real one in the same batch', async () => {
    fakeDb = makeFakeFirestore({
      student_accounts: {
        'uid-broken': { linkedDeviceIds: ['device-x'] }, // missing name — should skip silently
        'uid-1': { name: 'Марко', linkedDeviceIds: ['device-1'] },
      },
      quiz_results: { 'q-1': { deviceId: 'device-1', teacherUid: 'teacher-1' } },
      student_gamification: { 'teacher-1_Марко': { currentStreak: 2, lastActivityDate: '2026-07-11' } },
      user_tokens: { 'uid-1_web': { token: 'fcm-token-1' } },
    });

    await (sendDailyStreakReminders as any)();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
