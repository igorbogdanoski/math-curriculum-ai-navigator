/**
 * Tests for the per-question Matura SM-2 service (T3.1).
 *
 * We exercise only the pure helpers (`computeNextRecord` / `dueRecords`).
 * The Firestore I/O wrappers are thin and covered by the existing
 * `firestoreServiceMatura.test.ts` mocking pattern.
 */
import { describe, it, expect } from 'vitest';
import {
  computeNextRecord,
  dueRecords,
  type MaturaSpacedRecord,
} from '../services/firestoreService.maturaSpacedRep';

const FROZEN_NOW = new Date('2026-04-10T12:00:00Z');

function baseRecord(over: Partial<MaturaSpacedRecord> = {}): MaturaSpacedRecord {
  return {
    uid: 'u1',
    examId: 'e1',
    questionNumber: 1,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: FROZEN_NOW.toISOString(),
    lastReviewedAt: FROZEN_NOW.toISOString(),
    lastPct: 0,
    attempts: 0,
    everCorrect: false,
    ...over,
  };
}

describe('computeNextRecord', () => {
  it('creates a fresh record when no previous exists', () => {
    const r = computeNextRecord(null, {
      uid: 'u1', examId: 'e1', questionNumber: 7, pct: 100, now: FROZEN_NOW,
    });
    expect(r.uid).toBe('u1');
    expect(r.examId).toBe('e1');
    expect(r.questionNumber).toBe(7);
    expect(r.attempts).toBe(1);
    expect(r.everCorrect).toBe(true);
    expect(r.lastPct).toBe(100);
    // SM-2: first successful review → interval = 1 day
    const nextMs = new Date(r.nextReviewDate).getTime();
    expect(nextMs - FROZEN_NOW.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('increments attempts and updates lastPct on each call', () => {
    const r1 = computeNextRecord(null, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 80, now: FROZEN_NOW,
    });
    const r2 = computeNextRecord(r1, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 50, now: FROZEN_NOW,
    });
    expect(r1.attempts).toBe(1);
    expect(r2.attempts).toBe(2);
    expect(r2.lastPct).toBe(50);
  });

  it('failed recall (pct < 60) resets repetitions and shortens interval', () => {
    const prev = baseRecord({ easeFactor: 2.6, interval: 30, repetitions: 4 });
    const next = computeNextRecord(prev, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 20, now: FROZEN_NOW,
    });
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
  });

  it('preserves everCorrect once it has been true', () => {
    const prev = baseRecord({ everCorrect: true });
    const next = computeNextRecord(prev, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 0, now: FROZEN_NOW,
    });
    expect(next.everCorrect).toBe(true);
  });

  it('only marks everCorrect at pct >= 75', () => {
    const r1 = computeNextRecord(null, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 70, now: FROZEN_NOW,
    });
    expect(r1.everCorrect).toBe(false);
    const r2 = computeNextRecord(null, {
      uid: 'u1', examId: 'e1', questionNumber: 1, pct: 75, now: FROZEN_NOW,
    });
    expect(r2.everCorrect).toBe(true);
  });
});

describe('dueRecords', () => {
  it('returns only records whose nextReviewDate is <= now, sorted by urgency', () => {
    const overdue = baseRecord({ questionNumber: 1, nextReviewDate: '2026-04-08T00:00:00Z' });
    const dueToday = baseRecord({ questionNumber: 2, nextReviewDate: '2026-04-10T11:00:00Z' });
    const future = baseRecord({ questionNumber: 3, nextReviewDate: '2026-04-15T00:00:00Z' });
    const due = dueRecords([future, dueToday, overdue], FROZEN_NOW);
    expect(due.map((d) => d.questionNumber)).toEqual([1, 2]);
  });

  it('returns empty array when no records are due', () => {
    const future = baseRecord({ nextReviewDate: '2027-01-01T00:00:00Z' });
    expect(dueRecords([future], FROZEN_NOW)).toEqual([]);
  });
});
