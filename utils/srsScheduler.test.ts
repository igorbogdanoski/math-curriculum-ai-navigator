import { describe, it, expect } from 'vitest';
import { buildReviewSchedule, getScheduleStats } from './srsScheduler';
import type { SpacedRepRecord } from './spacedRepetition';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<SpacedRepRecord> & { daysFromNow: number }): SpacedRepRecord {
  const { daysFromNow, ...rest } = overrides;
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  return {
    studentId: 'student1',
    conceptId: 'concept-' + Math.random().toString(36).slice(2),
    easeFactor: 2.5,
    interval: Math.abs(daysFromNow) || 1,
    repetitions: 1,
    nextReviewDate: next.toISOString(),
    lastReviewedAt: new Date().toISOString(),
    ...rest,
  };
}

// ── buildReviewSchedule ───────────────────────────────────────────────────────

describe('buildReviewSchedule', () => {
  it('places overdue record (daysFromNow=-2) into today', () => {
    const r = makeRecord({ daysFromNow: -2, conceptId: 'c1' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(1);
    expect(schedule.today[0].conceptId).toBe('c1');
    expect(schedule.today[0].overdue).toBe(true);
  });

  it('places a record due later today into today bucket', () => {
    // Bucketing is calendar-day based (see daysUntil's startOfDay normalization), so
    // "due later today" must land in `today` regardless of what hour it currently is —
    // unlike a raw-elapsed-hours check, this is deterministic no matter when the test runs.
    const r = makeRecord({ daysFromNow: 0, conceptId: 'c2' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(1);
    expect(schedule.today[0].overdue).toBe(false);
    expect(schedule.tomorrow).toHaveLength(0);
  });

  it('places daysFromNow=1 record into tomorrow', () => {
    const r = makeRecord({ daysFromNow: 1, conceptId: 'c3' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.tomorrow).toHaveLength(1);
    expect(schedule.tomorrow[0].conceptId).toBe('c3');
  });

  it('places daysFromNow=3 record into thisWeek', () => {
    const r = makeRecord({ daysFromNow: 3, conceptId: 'c4' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.thisWeek).toHaveLength(1);
    expect(schedule.thisWeek[0].conceptId).toBe('c4');
  });

  it('places daysFromNow=7 record into thisWeek (boundary)', () => {
    const r = makeRecord({ daysFromNow: 7, conceptId: 'c5' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.thisWeek).toHaveLength(1);
  });

  it('places daysFromNow=8 record into later', () => {
    const r = makeRecord({ daysFromNow: 8, conceptId: 'c6' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.later).toHaveLength(1);
    expect(schedule.later[0].conceptId).toBe('c6');
  });

  it('skips records with repetitions=0 and interval=0 (never quizzed)', () => {
    const r = makeRecord({ daysFromNow: 0, repetitions: 0, interval: 0 });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(0);
    expect(schedule.tomorrow).toHaveLength(0);
    expect(schedule.thisWeek).toHaveLength(0);
    expect(schedule.later).toHaveLength(0);
  });

  it('does NOT skip records with repetitions=0 but interval>0', () => {
    const r = makeRecord({ daysFromNow: 0, repetitions: 0, interval: 1 });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(1);
  });

  it('does NOT skip records with repetitions>0 and interval=0', () => {
    const r = makeRecord({ daysFromNow: 0, repetitions: 1, interval: 0 });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(1);
  });

  it('sorts today: overdue items come before due-today items', () => {
    const overdue = makeRecord({ daysFromNow: -3, conceptId: 'overdue', interval: 1 });
    const dueToday = makeRecord({ daysFromNow: 0, conceptId: 'today', interval: 2 });
    const schedule = buildReviewSchedule([dueToday, overdue]);
    expect(schedule.today[0].conceptId).toBe('overdue');
    expect(schedule.today[1].conceptId).toBe('today');
  });

  it('sets totalDue equal to today.length', () => {
    const r1 = makeRecord({ daysFromNow: -1, conceptId: 'a' });
    const r2 = makeRecord({ daysFromNow: 0, conceptId: 'b' });
    const r3 = makeRecord({ daysFromNow: 5, conceptId: 'c' });
    const schedule = buildReviewSchedule([r1, r2, r3]);
    expect(schedule.totalDue).toBe(2);
  });

  it('handles empty input', () => {
    const schedule = buildReviewSchedule([]);
    expect(schedule.today).toHaveLength(0);
    expect(schedule.tomorrow).toHaveLength(0);
    expect(schedule.thisWeek).toHaveLength(0);
    expect(schedule.later).toHaveLength(0);
    expect(schedule.totalDue).toBe(0);
  });

  it('maps SRSItem fields correctly from SpacedRepRecord', () => {
    const r = makeRecord({ daysFromNow: 0, conceptId: 'map-test', easeFactor: 1.8, interval: 4, repetitions: 3, studentId: 'stu99' });
    const schedule = buildReviewSchedule([r]);
    const item = schedule.today[0];
    expect(item.conceptId).toBe('map-test');
    expect(item.studentId).toBe('stu99');
    expect(item.easeFactor).toBe(1.8);
    expect(item.interval).toBe(4);
    expect(item.repetitions).toBe(3);
    expect(typeof item.nextReviewLabel).toBe('string');
    expect(typeof item.daysFromNow).toBe('number');
  });

  it('buckets by calendar day, not raw elapsed hours — a same-day item stays in "today" no matter the current hour', () => {
    // This used to be a raw-ms/24h floor: "22 hours from now" could land in `today` or
    // `tomorrow` depending purely on what hour the test happened to run at, and the same
    // raw-hours arithmetic misfiled real reviews by a day across a DST transition (a 23h
    // "spring forward" gap divided by a fixed 24h would floor to 0 instead of 1). Bucketing
    // is now based on calendar-day boundaries (see daysUntil), so this is deterministic.
    const r = makeRecord({ daysFromNow: 0, conceptId: 'boundary' });
    const schedule = buildReviewSchedule([r]);
    expect(schedule.today).toHaveLength(1);
    expect(schedule.tomorrow).toHaveLength(0);
  });

  it('sorts most-overdue items first within today bucket', () => {
    const veryOverdue = makeRecord({ daysFromNow: -5, conceptId: 'very', interval: 2 });
    const slightlyOverdue = makeRecord({ daysFromNow: -1, conceptId: 'slight', interval: 10 });
    const schedule = buildReviewSchedule([slightlyOverdue, veryOverdue]);
    expect(schedule.today[0].conceptId).toBe('very');
    expect(schedule.today[1].conceptId).toBe('slight');
  });
});

// ── getScheduleStats ──────────────────────────────────────────────────────────

describe('getScheduleStats', () => {
  it('returns zero stats for empty schedule', () => {
    const schedule = buildReviewSchedule([]);
    const stats = getScheduleStats(schedule);
    expect(stats.dueToday).toBe(0);
    expect(stats.dueTomorrow).toBe(0);
    expect(stats.dueThisWeek).toBe(0);
    expect(stats.total).toBe(0);
  });

  it('dueThisWeek includes tomorrow + thisWeek', () => {
    const records = [
      makeRecord({ daysFromNow: 1 }),  // tomorrow
      makeRecord({ daysFromNow: 4 }),  // thisWeek
      makeRecord({ daysFromNow: 10 }), // later
    ];
    const schedule = buildReviewSchedule(records);
    const stats = getScheduleStats(schedule);
    expect(stats.dueTomorrow).toBe(1);
    expect(stats.dueThisWeek).toBe(2);
    expect(stats.total).toBe(3);
  });

  it('total is sum of all four buckets', () => {
    const records = [
      makeRecord({ daysFromNow: -1 }),  // today (overdue)
      makeRecord({ daysFromNow: 0 }),   // today
      makeRecord({ daysFromNow: 1 }),   // tomorrow
      makeRecord({ daysFromNow: 3 }),   // thisWeek
      makeRecord({ daysFromNow: 14 }),  // later
    ];
    const schedule = buildReviewSchedule(records);
    const stats = getScheduleStats(schedule);
    expect(stats.dueToday).toBe(2);
    expect(stats.total).toBe(5);
  });
});
