/**
 * S61-E1 / E3 — Tests for finalExamMode resolution + submission seal.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveExamMode,
  isWithinExamWindow,
} from '../utils/duggaFinalExamMode';
import {
  computeSubmissionSeal,
  verifySubmissionSeal,
  stableStringify,
} from '../utils/duggaSubmissionSeal';
import type { DuggaTest } from '../services/firestoreService.dugga';

type TestPatch = Partial<Pick<DuggaTest,
  'finalExamMode' | 'shuffleQuestions' | 'shuffleOptions' | 'disableHints'
  | 'finalExamOpensAt' | 'finalExamClosesAt'
>>;
const make = (patch: TestPatch): TestPatch => patch;

describe('resolveExamMode', () => {
  it('returns all-false defaults for non-exam test', () => {
    const r = resolveExamMode(make({}));
    expect(r.finalExam).toBe(false);
    expect(r.shuffleQuestions).toBe(false);
    expect(r.shuffleOptions).toBe(false);
    expect(r.disableHints).toBe(false);
    expect(r.sealSubmission).toBe(false);
    expect(r.pauseOnHidden).toBe(false);
  });

  it('flips defaults on under finalExamMode', () => {
    const r = resolveExamMode(make({ finalExamMode: true }));
    expect(r.finalExam).toBe(true);
    expect(r.shuffleQuestions).toBe(true);
    expect(r.shuffleOptions).toBe(true);
    expect(r.disableHints).toBe(true);
    expect(r.sealSubmission).toBe(true);
    expect(r.pauseOnHidden).toBe(true);
  });

  it('explicit overrides win over defaults', () => {
    const r = resolveExamMode(make({
      finalExamMode: true,
      shuffleQuestions: false,
      disableHints: false,
    }));
    expect(r.shuffleQuestions).toBe(false);
    expect(r.shuffleOptions).toBe(true);
    expect(r.disableHints).toBe(false);
    // sealSubmission remains tied to finalExam itself
    expect(r.sealSubmission).toBe(true);
  });
});

describe('isWithinExamWindow', () => {
  const now = new Date('2026-06-10T10:00:00Z');

  it('returns true when no window configured', () => {
    expect(isWithinExamWindow({}, now)).toBe(true);
  });

  it('rejects before open', () => {
    expect(isWithinExamWindow({ finalExamOpensAt: '2026-06-10T11:00:00Z' }, now)).toBe(false);
  });

  it('rejects after close', () => {
    expect(isWithinExamWindow({ finalExamClosesAt: '2026-06-10T09:00:00Z' }, now)).toBe(false);
  });

  it('accepts within window', () => {
    expect(isWithinExamWindow({
      finalExamOpensAt: '2026-06-10T08:00:00Z',
      finalExamClosesAt: '2026-06-10T12:00:00Z',
    }, now)).toBe(true);
  });

  it('handles Firestore Timestamp duck-type via seconds', () => {
    const seconds = Math.floor(new Date('2026-06-10T11:00:00Z').getTime() / 1000);
    expect(isWithinExamWindow({
      finalExamOpensAt: { seconds } as unknown as string,
    }, now)).toBe(false);
  });
});

describe('stableStringify', () => {
  it('orders object keys deterministically', () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('stringifies nested arrays of objects', () => {
    expect(stableStringify({ x: [{ b: 1, a: 2 }] }))
      .toBe('{"x":[{"a":2,"b":1}]}');
  });
});

describe('computeSubmissionSeal / verifySubmissionSeal', () => {
  const input = {
    testId: 'T1',
    studentUid: 'U1',
    answers: { q1: 'a', q2: ['x', 'y'] },
  };

  it('produces a 64-char hex digest', async () => {
    const seal = await computeSubmissionSeal(input);
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same payload regardless of key order', async () => {
    const a = await computeSubmissionSeal(input);
    const b = await computeSubmissionSeal({
      testId: 'T1', studentUid: 'U1',
      answers: { q2: ['x', 'y'], q1: 'a' },
    });
    expect(a).toBe(b);
  });

  it('changes when any field changes', async () => {
    const a = await computeSubmissionSeal(input);
    const b = await computeSubmissionSeal({ ...input, studentUid: 'U2' });
    const c = await computeSubmissionSeal({ ...input, answers: { q1: 'b', q2: ['x', 'y'] } });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('verifySubmissionSeal returns true for matching seal', async () => {
    const seal = await computeSubmissionSeal(input);
    expect(await verifySubmissionSeal(input, seal)).toBe(true);
    expect(await verifySubmissionSeal({ ...input, studentUid: 'U2' }, seal)).toBe(false);
  });
});
