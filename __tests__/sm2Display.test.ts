import { describe, it, expect } from 'vitest';
import {
  getNextReviewLabel,
  isDueForReview,
  sortByReviewUrgency,
  updateRecordAfterReview,
  createInitialRecord,
  type SpacedRepRecord,
} from '../utils/spacedRepetition';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRecord(daysFromNow: number, studentId = 's1', conceptId = 'c1'): SpacedRepRecord {
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  return {
    studentId,
    conceptId,
    easeFactor: 2.5,
    interval: Math.abs(daysFromNow),
    repetitions: 1,
    nextReviewDate: next.toISOString(),
    lastReviewedAt: new Date().toISOString(),
  };
}

// ── getNextReviewLabel ────────────────────────────────────────────────────────

describe('getNextReviewLabel — UI labels shown in StudentProgressView', () => {
  it('overdue record shows "Денес"', () => {
    const record = makeRecord(-3);
    expect(getNextReviewLabel(record)).toBe('Денес');
  });

  it('due today shows "Денес"', () => {
    const record = makeRecord(0);
    expect(getNextReviewLabel(record)).toBe('Денес');
  });

  it('due tomorrow shows "Утре"', () => {
    const record = makeRecord(1);
    expect(getNextReviewLabel(record)).toBe('Утре');
  });

  it('due in 5 days shows "За 5 дена"', () => {
    const record = makeRecord(5);
    expect(getNextReviewLabel(record)).toBe('За 5 дена');
  });

  it('due in exactly 7 days shows "За 1 недела"', () => {
    const record = makeRecord(7);
    expect(getNextReviewLabel(record)).toBe('За 1 недела');
  });

  it('due in 14 days shows "За 2 недели"', () => {
    const record = makeRecord(14);
    expect(getNextReviewLabel(record)).toBe('За 2 недели');
  });

  it('due in 21 days shows "За 3 недели"', () => {
    const record = makeRecord(21);
    expect(getNextReviewLabel(record)).toBe('За 3 недели');
  });
});

// ── isDueForReview ────────────────────────────────────────────────────────────

describe('isDueForReview — filter logic for review queue', () => {
  it('overdue record is due', () => {
    expect(isDueForReview(makeRecord(-1))).toBe(true);
  });

  it('record due today is due', () => {
    expect(isDueForReview(makeRecord(0))).toBe(true);
  });

  it('record due tomorrow is NOT due', () => {
    expect(isDueForReview(makeRecord(1))).toBe(false);
  });

  it('record due in 7 days is NOT due', () => {
    expect(isDueForReview(makeRecord(7))).toBe(false);
  });
});

// ── sortByReviewUrgency ───────────────────────────────────────────────────────

describe('sortByReviewUrgency — ordering the review queue', () => {
  it('sorts overdue records before upcoming ones', () => {
    const records = [
      makeRecord(5, 's1', 'future'),
      makeRecord(-3, 's1', 'overdue'),
      makeRecord(1, 's1', 'tomorrow'),
    ];
    const sorted = sortByReviewUrgency(records);
    expect(sorted[0].conceptId).toBe('overdue');
    expect(sorted[1].conceptId).toBe('tomorrow');
    expect(sorted[2].conceptId).toBe('future');
  });

  it('empty array returns empty array', () => {
    expect(sortByReviewUrgency([])).toEqual([]);
  });

  it('single record returns single record unchanged', () => {
    const r = makeRecord(0, 's1', 'solo');
    expect(sortByReviewUrgency([r])).toHaveLength(1);
  });
});

// ── SM-2 display integration ──────────────────────────────────────────────────

describe('SM-2 display integration — after updateRecordAfterReview', () => {
  it('after 95% score the label is NOT "Денес" (scheduled for future)', () => {
    const initial = createInitialRecord('student1', 'concept1');
    const updated = updateRecordAfterReview(initial, 95);
    const label = getNextReviewLabel(updated);
    // After perfect recall, review is scheduled for future
    expect(label).not.toBe('Денес');
    expect(updated.interval).toBeGreaterThan(0);
  });

  it('after 20% score (fail) the record stays due soon', () => {
    const initial = createInitialRecord('student1', 'concept1');
    const updated = updateRecordAfterReview(initial, 20);
    // Failed recall resets to interval 1 → due tomorrow
    expect(updated.interval).toBe(1);
    expect(getNextReviewLabel(updated)).toBe('Утре');
  });

  it('due filter: freshly created record is always due', () => {
    const record = createInitialRecord('student1', 'concept1');
    expect(isDueForReview(record)).toBe(true);
  });

  it('after success: record is no longer immediately due', () => {
    const initial = createInitialRecord('s1', 'c1');
    const updated = updateRecordAfterReview(initial, 90);
    expect(isDueForReview(updated)).toBe(false);
  });

  it('multiple reviews build up interval (spaced repetition effect)', () => {
    let record = createInitialRecord('s1', 'math-fractions');
    // Simulate 4 successful reviews
    record = updateRecordAfterReview(record, 85); // review 1
    const interval1 = record.interval;
    record = updateRecordAfterReview(record, 90); // review 2
    const interval2 = record.interval;
    record = updateRecordAfterReview(record, 88); // review 3
    const interval3 = record.interval;
    // Intervals should grow monotonically
    expect(interval2).toBeGreaterThan(interval1);
    expect(interval3).toBeGreaterThan(interval2);
  });
});
