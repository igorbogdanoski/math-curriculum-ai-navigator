/**
 * S39-F5 — Cohort & activity metrics (pure, testable).
 *
 * All functions here are time-pure: callers pass `now` (epoch ms) so
 * tests can fix a deterministic clock. Inputs may use Firestore
 * `Timestamp`, JS `Date`, ISO strings, or epoch numbers — `toEpochMs`
 * normalises them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UserActivityRecord {
  uid: string;
  createdAt?: unknown;
  lastLoginAt?: unknown;
  lastSeenAt?: unknown;
  role?: string;
}

export interface ActivityCounts {
  dau: number;
  wau: number;
  mau: number;
  totalRegistered: number;
}

export interface CohortRetentionPoint {
  cohortStart: number;
  cohortSize: number;
  /** map: dayOffset → number of users who returned on that day-after-signup */
  retainedByDay: Record<number, number>;
}

/** Normalises a value into epoch milliseconds, or null if unparseable. */
export function toEpochMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: < 10^12 → seconds; else ms
    return value < 1e12 ? value * 1000 : value;
  }
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    const v = value as { seconds?: unknown; nanoseconds?: unknown; toMillis?: () => number };
    if (typeof v.toMillis === 'function') {
      try { return v.toMillis(); } catch { /* fallthrough */ }
    }
    if (typeof v.seconds === 'number') {
      const ns = typeof v.nanoseconds === 'number' ? v.nanoseconds : 0;
      return v.seconds * 1000 + Math.floor(ns / 1e6);
    }
  }
  return null;
}

/** Returns the most recent activity epoch for a user, or null. */
export function lastActivityMs(u: UserActivityRecord): number | null {
  const candidates = [u.lastSeenAt, u.lastLoginAt, u.createdAt].map(toEpochMs);
  let best: number | null = null;
  for (const c of candidates) {
    if (c != null && (best == null || c > best)) best = c;
  }
  return best;
}

/** Counts DAU (24h), WAU (7d), MAU (30d) and total registrations. */
export function computeActivityCounts(
  users: UserActivityRecord[],
  now: number,
): ActivityCounts {
  const day = now - DAY_MS;
  const week = now - 7 * DAY_MS;
  const month = now - 30 * DAY_MS;
  let dau = 0, wau = 0, mau = 0;
  for (const u of users) {
    const t = lastActivityMs(u);
    if (t == null) continue;
    if (t >= day) dau++;
    if (t >= week) wau++;
    if (t >= month) mau++;
  }
  return { dau, wau, mau, totalRegistered: users.length };
}

/** Retention rate (0..1) — WAU / total non-zero MAU; null if MAU is zero. */
export function computeStickinessRatio(counts: ActivityCounts): number | null {
  if (counts.mau === 0) return null;
  return counts.dau / counts.mau;
}

/** Bucket users into weekly cohorts by signup; returns sorted by cohortStart asc. */
export function bucketWeeklyCohorts(
  users: UserActivityRecord[],
  now: number,
  weeksBack = 8,
): CohortRetentionPoint[] {
  const buckets = new Map<number, UserActivityRecord[]>();
  const earliest = startOfUtcDay(now) - weeksBack * 7 * DAY_MS;

  for (const u of users) {
    const created = toEpochMs(u.createdAt);
    if (created == null || created < earliest) continue;
    const cohortStart = startOfUtcWeek(created);
    const list = buckets.get(cohortStart) ?? [];
    list.push(u);
    buckets.set(cohortStart, list);
  }

  const out: CohortRetentionPoint[] = [];
  for (const [cohortStart, list] of buckets) {
    const retainedByDay: Record<number, number> = {};
    for (const u of list) {
      const last = lastActivityMs(u);
      if (last == null) continue;
      const offset = Math.floor((startOfUtcDay(last) - cohortStart) / DAY_MS);
      if (offset >= 0 && offset <= 30) {
        retainedByDay[offset] = (retainedByDay[offset] ?? 0) + 1;
      }
    }
    out.push({ cohortStart, cohortSize: list.length, retainedByDay });
  }
  return out.sort((a, b) => a.cohortStart - b.cohortStart);
}

/** UTC midnight of the given epoch. */
export function startOfUtcDay(epoch: number): number {
  const d = new Date(epoch);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** UTC Monday 00:00 of the given epoch's week (week starts Monday). */
export function startOfUtcWeek(epoch: number): number {
  const day = startOfUtcDay(epoch);
  const dow = new Date(day).getUTCDay(); // 0..6, Sun=0
  const offsetDays = (dow + 6) % 7; // Mon=0, Sun=6
  return day - offsetDays * DAY_MS;
}

/**
 * Credit-burn ratio (S39 north-star input): share of registered users that
 * have consumed any credits below a given remaining-balance threshold.
 * Returns 0..1; 0 when no users.
 */
export function computeCreditBurnRatio(
  users: { aiCreditsBalance?: number }[],
  initialGrant = 50,
  burnThreshold = 0,
): number {
  if (users.length === 0) return 0;
  let burned = 0;
  for (const u of users) {
    const bal = typeof u.aiCreditsBalance === 'number' ? u.aiCreditsBalance : initialGrant;
    if (bal <= burnThreshold) burned++;
  }
  return burned / users.length;
}
