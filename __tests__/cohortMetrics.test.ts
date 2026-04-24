import { describe, it, expect } from 'vitest';
import {
  toEpochMs,
  lastActivityMs,
  computeActivityCounts,
  computeStickinessRatio,
  bucketWeeklyCohorts,
  startOfUtcDay,
  startOfUtcWeek,
  computeCreditBurnRatio,
  type UserActivityRecord,
} from '../utils/cohortMetrics';

const DAY = 24 * 60 * 60 * 1000;
// Fixed clock — Thu, 23 Apr 2026 12:00 UTC
const NOW = Date.UTC(2026, 3, 23, 12, 0, 0);

describe('toEpochMs', () => {
  it('passes through epoch ms numbers > 1e12', () => {
    expect(toEpochMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
  it('converts seconds (< 1e12) to ms', () => {
    expect(toEpochMs(1_700_000_000)).toBe(1_700_000_000_000);
  });
  it('parses ISO string', () => {
    expect(toEpochMs('2026-04-23T12:00:00.000Z')).toBe(NOW);
  });
  it('handles Firestore Timestamp { seconds, nanoseconds }', () => {
    expect(toEpochMs({ seconds: 1_700_000_000, nanoseconds: 500_000_000 })).toBe(1_700_000_000_500);
  });
  it('handles Firestore Timestamp with toMillis()', () => {
    expect(toEpochMs({ toMillis: () => 42 })).toBe(42);
  });
  it('returns null for null/undefined/garbage', () => {
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs(undefined)).toBeNull();
    expect(toEpochMs('not-a-date')).toBeNull();
  });
});

describe('lastActivityMs', () => {
  it('returns the most recent of seen/login/created', () => {
    expect(lastActivityMs({ uid: 'a', createdAt: 100, lastLoginAt: 200, lastSeenAt: 50 })).toBe(200_000);
  });
  it('returns null when all missing', () => {
    expect(lastActivityMs({ uid: 'a' })).toBeNull();
  });
});

describe('computeActivityCounts', () => {
  const users: UserActivityRecord[] = [
    { uid: '1', lastSeenAt: NOW - 2 * 60 * 60 * 1000 },     // active in last 24h
    { uid: '2', lastSeenAt: NOW - 3 * DAY },                 // 3 days ago → WAU
    { uid: '3', lastLoginAt: NOW - 10 * DAY },               // 10 days ago → MAU
    { uid: '4', createdAt: NOW - 60 * DAY },                 // outside MAU
    { uid: '5' },                                             // never active → ignored
  ];

  it('counts DAU/WAU/MAU correctly', () => {
    const c = computeActivityCounts(users, NOW);
    expect(c.dau).toBe(1);
    expect(c.wau).toBe(2);
    expect(c.mau).toBe(3);
    expect(c.totalRegistered).toBe(5);
  });

  it('stickiness ratio = DAU / MAU', () => {
    const c = computeActivityCounts(users, NOW);
    expect(computeStickinessRatio(c)).toBeCloseTo(1 / 3, 5);
  });

  it('stickiness null when MAU is zero', () => {
    expect(computeStickinessRatio({ dau: 0, wau: 0, mau: 0, totalRegistered: 0 })).toBeNull();
  });
});

describe('startOfUtcWeek', () => {
  it('snaps to Monday 00:00 UTC', () => {
    // 23 Apr 2026 is a Thursday → Monday is 20 Apr
    const monday = Date.UTC(2026, 3, 20);
    expect(startOfUtcWeek(NOW)).toBe(monday);
  });
  it('Sunday snaps back to previous Monday', () => {
    const sunday = Date.UTC(2026, 3, 26, 23, 59);
    const monday = Date.UTC(2026, 3, 20);
    expect(startOfUtcWeek(sunday)).toBe(monday);
  });
});

describe('startOfUtcDay', () => {
  it('zeros the time of day', () => {
    expect(startOfUtcDay(NOW)).toBe(Date.UTC(2026, 3, 23));
  });
});

describe('bucketWeeklyCohorts', () => {
  const users: UserActivityRecord[] = [
    { uid: 'a', createdAt: NOW - 1 * DAY, lastSeenAt: NOW },        // this week
    { uid: 'b', createdAt: NOW - 2 * DAY, lastSeenAt: NOW - 1 * DAY }, // this week
    { uid: 'c', createdAt: NOW - 9 * DAY, lastSeenAt: NOW - 9 * DAY }, // prior week, only day-0
    { uid: 'd', createdAt: NOW - 90 * DAY },                         // outside window
  ];

  it('groups users into weekly cohorts and ignores out-of-window', () => {
    const cohorts = bucketWeeklyCohorts(users, NOW, 4);
    const sizes = cohorts.map(c => c.cohortSize);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(3);
    expect(cohorts.length).toBeGreaterThanOrEqual(2);
  });

  it('sorted ascending by cohortStart', () => {
    const cohorts = bucketWeeklyCohorts(users, NOW, 8);
    for (let i = 1; i < cohorts.length; i++) {
      expect(cohorts[i].cohortStart).toBeGreaterThan(cohorts[i - 1].cohortStart);
    }
  });
});

describe('computeCreditBurnRatio', () => {
  it('returns 0 for empty input', () => {
    expect(computeCreditBurnRatio([])).toBe(0);
  });

  it('treats undefined balance as initialGrant (not burned)', () => {
    expect(computeCreditBurnRatio([{}, {}], 50)).toBe(0);
  });

  it('counts users at or below threshold (default 0)', () => {
    const users = [
      { aiCreditsBalance: 50 },
      { aiCreditsBalance: 0 },
      { aiCreditsBalance: 1 },
      { aiCreditsBalance: 0 },
    ];
    expect(computeCreditBurnRatio(users)).toBe(0.5);
  });

  it('respects custom threshold', () => {
    const users = [{ aiCreditsBalance: 5 }, { aiCreditsBalance: 15 }];
    expect(computeCreditBurnRatio(users, 50, 10)).toBe(0.5);
  });
});
