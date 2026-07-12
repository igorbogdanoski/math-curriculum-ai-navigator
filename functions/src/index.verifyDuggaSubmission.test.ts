/**
 * Unit tests for verifyDuggaSubmission (functions/src/index.ts) — the Dugga
 * exam-integrity Cloud Function. Mocks 'firebase-functions/v1' so
 * firestore.document(...).onCreate(handler) returns the inner handler directly
 * (no emulator needed), and mocks 'firebase-admin' with a small in-memory
 * Firestore fake — mirrors index.creditFunctions.test.ts's established pattern.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSubmissionSeal } from './duggaSubmissionSeal';

vi.mock('firebase-functions/v1', () => ({
  https: { onCall: (handler: unknown) => handler },
  firestore: {
    document: () => ({
      onCreate: (handler: unknown) => handler,
      onWrite: (handler: unknown) => handler,
    }),
  },
  pubsub: {
    schedule: () => ({ timeZone: () => ({ onRun: (handler: unknown) => handler }) }),
  },
}));

type DocData = Record<string, unknown> | undefined;

function makeFakeFirestore(initialDocs: Record<string, DocData> = {}) {
  const store = new Map<string, DocData>(Object.entries(initialDocs));
  function collection(name: string) {
    return {
      doc: (id: string) => ({
        get: async () => ({
          exists: store.has(`${name}/${id}`) && store.get(`${name}/${id}`) !== undefined,
          data: () => store.get(`${name}/${id}`),
        }),
      }),
    };
  }
  return { collection, _store: store };
}

let fakeDb: ReturnType<typeof makeFakeFirestore>;

vi.mock('firebase-admin', () => {
  const firestoreFn = vi.fn(() => fakeDb) as unknown as { (): unknown; FieldValue: unknown };
  firestoreFn.FieldValue = { serverTimestamp: () => 'SERVER_TS' };
  return { initializeApp: vi.fn(), firestore: firestoreFn, auth: vi.fn(), messaging: vi.fn() };
});

import { verifyDuggaSubmission } from './index';

function makeSnap(id: string, data: Record<string, unknown>) {
  const updateCalls: Record<string, unknown>[] = [];
  const snap = {
    id,
    data: () => data,
    ref: { update: async (d: Record<string, unknown>) => { updateCalls.push(d); } },
  };
  return { snap, updateCalls };
}

const MC_QUESTION = { id: 'q1', type: 'multiple_choice', points: 10, options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B' }] };
const UNVERIFIED_QUESTION = { id: 'q2', type: 'fill_blanks', points: 5, correctAnswer: 'x' };

describe('verifyDuggaSubmission', () => {
  beforeEach(() => { fakeDb = makeFakeFirestore(); });

  it('returns early (no update) when testId or answers is missing', async () => {
    const { snap, updateCalls } = makeSnap('s1', { testId: 't1' }); // no answers
    await verifyDuggaSubmission(snap as never, {} as never);
    expect(updateCalls).toHaveLength(0);
  });

  it('returns early (no update) when the referenced test does not exist', async () => {
    const { snap, updateCalls } = makeSnap('s2', { testId: 'missing-test', answers: { q1: 'a' } });
    await verifyDuggaSubmission(snap as never, {} as never);
    expect(updateCalls).toHaveLength(0);
  });

  it('stamps matches=true and does NOT touch score/percentage when the client score is honest', async () => {
    fakeDb._store.set('dugga_tests/t1', { questions: [MC_QUESTION] });
    const { snap, updateCalls } = makeSnap('s3', {
      testId: 't1', answers: { q1: 'a' }, score: 10, totalPoints: 10, percentage: 100,
    });

    await verifyDuggaSubmission(snap as never, {} as never);

    expect(updateCalls).toHaveLength(1);
    const update = updateCalls[0] as { serverVerification: { matches: boolean; corrected?: boolean }; score?: number };
    expect(update.serverVerification.matches).toBe(true);
    expect(update.serverVerification.corrected).toBeUndefined();
    expect(update.score).toBeUndefined();
  });

  it('auto-corrects score/percentage for a fully-deterministic test with a fabricated score', async () => {
    fakeDb._store.set('dugga_tests/t1', { questions: [MC_QUESTION] });
    // Student actually picked the wrong option "b" but claims a perfect score.
    const { snap, updateCalls } = makeSnap('s4', {
      testId: 't1', answers: { q1: 'b' }, score: 10, totalPoints: 10, percentage: 100,
    });

    await verifyDuggaSubmission(snap as never, {} as never);

    const update = updateCalls[0] as { serverVerification: { matches: boolean; corrected: boolean; clientReportedScore: number }; score: number; percentage: number };
    expect(update.serverVerification.matches).toBe(false);
    expect(update.serverVerification.corrected).toBe(true);
    expect(update.serverVerification.clientReportedScore).toBe(10);
    expect(update.score).toBe(0);
    expect(update.percentage).toBe(0);
  });

  it('does NOT auto-correct when the test mixes in an unverified (CAS/complex-grader) question', async () => {
    fakeDb._store.set('dugga_tests/t1', { questions: [MC_QUESTION, UNVERIFIED_QUESTION] });
    const { snap, updateCalls } = makeSnap('s5', {
      testId: 't1', answers: { q1: 'b', q2: 'x' }, score: 15, totalPoints: 15, percentage: 100,
    });

    await verifyDuggaSubmission(snap as never, {} as never);

    const update = updateCalls[0] as { serverVerification: { matches: boolean; corrected?: boolean; unverifiedQuestionIds: string[] } };
    expect(update.serverVerification.unverifiedQuestionIds).toEqual(['q2']);
    expect(update.serverVerification.matches).toBe(false);
    expect(update.serverVerification.corrected).toBeUndefined();
    expect('score' in update).toBe(false);
  });

  it('does NOT auto-correct a final-exam-mode submission with an invalid seal, even if fully verifiable', async () => {
    fakeDb._store.set('dugga_tests/t1', { questions: [MC_QUESTION], finalExamMode: true });
    const { snap, updateCalls } = makeSnap('s6', {
      testId: 't1', studentUid: 'u1', answers: { q1: 'b' }, score: 10, totalPoints: 10,
      submissionSeal: 'not-a-real-seal',
    });

    await verifyDuggaSubmission(snap as never, {} as never);

    const update = updateCalls[0] as { serverVerification: { sealValid: boolean; corrected?: boolean } };
    expect(update.serverVerification.sealValid).toBe(false);
    expect(update.serverVerification.corrected).toBeUndefined();
    expect('score' in update).toBe(false);
  });

  it('DOES auto-correct a final-exam-mode submission with a valid seal and a fabricated score', async () => {
    fakeDb._store.set('dugga_tests/t1', { questions: [MC_QUESTION], finalExamMode: true });
    const answers = { q1: 'b' };
    const seal = computeSubmissionSeal({ testId: 't1', studentUid: 'u1', answers });
    const { snap, updateCalls } = makeSnap('s7', {
      testId: 't1', studentUid: 'u1', answers, score: 10, totalPoints: 10, submissionSeal: seal,
    });

    await verifyDuggaSubmission(snap as never, {} as never);

    const update = updateCalls[0] as { serverVerification: { sealValid: boolean; corrected: boolean }; score: number };
    expect(update.serverVerification.sealValid).toBe(true);
    expect(update.serverVerification.corrected).toBe(true);
    expect(update.score).toBe(0);
  });
});
