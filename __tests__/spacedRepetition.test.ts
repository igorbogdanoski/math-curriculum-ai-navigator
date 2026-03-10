import { describe, it, expect } from 'vitest';
import {
  percentageToQuality,
  calcNextSM2,
  createInitialRecord,
  updateRecordAfterReview,
  isDueForReview,
  sortByReviewUrgency,
  type SpacedRepRecord,
} from '../utils/spacedRepetition';

// ── percentageToQuality ───────────────────────────────────────────────────────
describe('percentageToQuality', () => {
  it('maps >=90 to quality 5 (perfect)', () => {
    expect(percentageToQuality(100)).toBe(5);
    expect(percentageToQuality(90)).toBe(5);
  });
  it('maps 75–89 to quality 4', () => {
    expect(percentageToQuality(75)).toBe(4);
    expect(percentageToQuality(89)).toBe(4);
  });
  it('maps 60–74 to quality 3', () => {
    expect(percentageToQuality(60)).toBe(3);
    expect(percentageToQuality(74)).toBe(3);
  });
  it('maps 45–59 to quality 2', () => {
    expect(percentageToQuality(45)).toBe(2);
    expect(percentageToQuality(59)).toBe(2);
  });
  it('maps 25–44 to quality 1', () => {
    expect(percentageToQuality(25)).toBe(1);
    expect(percentageToQuality(44)).toBe(1);
  });
  it('maps <25 to quality 0 (blackout)', () => {
    expect(percentageToQuality(0)).toBe(0);
    expect(percentageToQuality(24)).toBe(0);
  });
});

// ── calcNextSM2 ──────────────────────────────────────────────────────────────
describe('calcNextSM2', () => {
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };

  it('first correct review (q=5) → interval=1, reps=1', () => {
    const result = calcNextSM2(initial, 5);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.easeFactor).toBeGreaterThan(2.5); // ease increases on perfect
  });

  it('second correct review → interval=6, reps=2', () => {
    const afterFirst = calcNextSM2(initial, 5);
    const afterSecond = calcNextSM2(afterFirst, 5);
    expect(afterSecond.interval).toBe(6);
    expect(afterSecond.repetitions).toBe(2);
  });

  it('third correct review → interval = round(6 * easeFactor)', () => {
    const s1 = calcNextSM2(initial, 5);
    const s2 = calcNextSM2(s1, 5);
    const s3 = calcNextSM2(s2, 5);
    expect(s3.interval).toBe(Math.round(6 * s2.easeFactor));
    expect(s3.repetitions).toBe(3);
  });

  it('failed recall (q<3) resets reps to 0 and interval to 1', () => {
    const afterTwo = calcNextSM2(calcNextSM2(initial, 5), 5);
    expect(afterTwo.repetitions).toBe(2);

    const failed = calcNextSM2(afterTwo, 1);
    expect(failed.repetitions).toBe(0);
    expect(failed.interval).toBe(1);
  });

  it('ease factor never drops below 1.3', () => {
    let state = { easeFactor: 1.35, interval: 10, repetitions: 5 };
    // Quality 0 causes the steepest ease decrease
    const result = calcNextSM2(state, 0);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('ease factor increases on perfect recall (q=5)', () => {
    const result = calcNextSM2({ easeFactor: 2.5, interval: 1, repetitions: 1 }, 5);
    expect(result.easeFactor).toBeCloseTo(2.6, 1);
  });

  it('ease factor decreases on difficult but correct recall (q=3)', () => {
    const result = calcNextSM2({ easeFactor: 2.5, interval: 1, repetitions: 1 }, 3);
    expect(result.easeFactor).toBeLessThan(2.5);
  });
});

// ── createInitialRecord ──────────────────────────────────────────────────────
describe('createInitialRecord', () => {
  it('creates a record with default SM-2 values', () => {
    const record = createInitialRecord('student-1', 'concept-fractions');
    expect(record.studentId).toBe('student-1');
    expect(record.conceptId).toBe('concept-fractions');
    expect(record.easeFactor).toBe(2.5);
    expect(record.interval).toBe(0);
    expect(record.repetitions).toBe(0);
  });

  it('sets nextReviewDate to now (due immediately)', () => {
    const before = Date.now();
    const record = createInitialRecord('s', 'c');
    const next = new Date(record.nextReviewDate).getTime();
    expect(next).toBeGreaterThanOrEqual(before);
    expect(next).toBeLessThanOrEqual(Date.now() + 100);
  });
});

// ── updateRecordAfterReview ──────────────────────────────────────────────────
describe('updateRecordAfterReview', () => {
  it('advances nextReviewDate into the future on success', () => {
    const record = createInitialRecord('s', 'c');
    const updated = updateRecordAfterReview(record, 85); // quality 4
    const nextDate = new Date(updated.nextReviewDate);
    expect(nextDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('keeps interval=1 after failed recall', () => {
    const record = createInitialRecord('s', 'c');
    const updated = updateRecordAfterReview(record, 20); // quality 0
    expect(updated.interval).toBe(1);
    expect(updated.repetitions).toBe(0);
  });

  it('builds up interval over consecutive successful reviews', () => {
    let record = createInitialRecord('s', 'c');
    record = updateRecordAfterReview(record, 90); // rep 1 → interval 1
    record = updateRecordAfterReview(record, 90); // rep 2 → interval 6
    record = updateRecordAfterReview(record, 90); // rep 3 → interval ~15+
    expect(record.interval).toBeGreaterThan(6);
    expect(record.repetitions).toBe(3);
  });
});

// ── isDueForReview ───────────────────────────────────────────────────────────
describe('isDueForReview', () => {
  it('returns true when nextReviewDate is in the past', () => {
    const record = createInitialRecord('s', 'c');
    const pastRecord: SpacedRepRecord = {
      ...record,
      nextReviewDate: new Date(Date.now() - 1000).toISOString(),
    };
    expect(isDueForReview(pastRecord)).toBe(true);
  });

  it('returns false when nextReviewDate is in the future', () => {
    const record = createInitialRecord('s', 'c');
    const futureRecord: SpacedRepRecord = {
      ...record,
      nextReviewDate: new Date(Date.now() + 86400000).toISOString(), // +1 day
    };
    expect(isDueForReview(futureRecord)).toBe(false);
  });
});

// ── sortByReviewUrgency ──────────────────────────────────────────────────────
describe('sortByReviewUrgency', () => {
  it('sorts overdue concepts first', () => {
    const now = Date.now();
    const records: SpacedRepRecord[] = [
      { ...createInitialRecord('s', 'c3'), nextReviewDate: new Date(now + 86400000 * 3).toISOString() },
      { ...createInitialRecord('s', 'c1'), nextReviewDate: new Date(now - 86400000).toISOString() }, // overdue
      { ...createInitialRecord('s', 'c2'), nextReviewDate: new Date(now + 86400000).toISOString() },
    ];

    const sorted = sortByReviewUrgency(records);
    expect(sorted[0].conceptId).toBe('c1'); // overdue first
    expect(sorted[1].conceptId).toBe('c2');
    expect(sorted[2].conceptId).toBe('c3');
  });

  it('does not mutate the original array', () => {
    const records = [createInitialRecord('s', 'a'), createInitialRecord('s', 'b')];
    const original = [...records];
    sortByReviewUrgency(records);
    expect(records[0].conceptId).toBe(original[0].conceptId);
  });
});
