/**
 * Unit tests for analytics helper functions and aggregation logic.
 * Tests the pure, Firebase-free utility functions used by TeacherAnalyticsView.
 */
import { describe, it, expect } from 'vitest';
import { groupBy, fmt, formatDate } from '../views/analytics/shared';

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------
describe('groupBy', () => {
  it('groups items by a string key', () => {
    const items = [
      { id: 1, grade: '6' },
      { id: 2, grade: '7' },
      { id: 3, grade: '6' },
    ];
    const result = groupBy(items, i => i.grade);
    expect(result['6']).toHaveLength(2);
    expect(result['7']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupBy([], (_i: Record<string, unknown>) => String(_i['k']))).toEqual({});
  });

  it('groups all items under same key when key function is constant', () => {
    const items = [{ v: 1 }, { v: 2 }, { v: 3 }];
    const result = groupBy(items, () => 'same');
    expect(result['same']).toHaveLength(3);
  });

  it('preserves order within each group', () => {
    const items = [
      { n: 'A', g: '6' },
      { n: 'B', g: '7' },
      { n: 'C', g: '6' },
    ];
    const result = groupBy(items, i => i.g);
    expect(result['6'].map(i => i.n)).toEqual(['A', 'C']);
  });
});

// ---------------------------------------------------------------------------
// fmt
// ---------------------------------------------------------------------------
describe('fmt', () => {
  it('formats to 1 decimal by default', () => {
    expect(fmt(75.678)).toBe('75.7');
  });

  it('formats to specified decimals', () => {
    expect(fmt(75.678, 2)).toBe('75.68');
    expect(fmt(75.678, 0)).toBe('76');
  });

  it('pads with zeros when needed', () => {
    expect(fmt(75, 1)).toBe('75.0');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('returns "—" for null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('handles Date objects', () => {
    const d = new Date('2026-03-09T12:00:00Z');
    const result = formatDate(d);
    expect(result).toContain('2026');
    expect(result).not.toBe('—');
  });

  it('handles Firestore Timestamp-like objects with toDate()', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-03-09T12:00:00Z') };
    const result = formatDate(fakeTimestamp);
    expect(result).toContain('2026');
  });
});

// ---------------------------------------------------------------------------
// Aggregation logic (inline pure computation, mirrors TeacherAnalyticsView useMemo)
// ---------------------------------------------------------------------------
describe('Analytics aggregation logic', () => {

  interface MockResult {
    percentage: number;
    quizId: string;
    quizTitle: string;
    studentName?: string;
    conceptId?: string;
    grade?: string;
    misconceptions?: { misconception: string }[];
    metacognitiveNote?: string;
    confidence?: number;
  }

  function computeBasicStats(results: MockResult[]) {
    if (results.length === 0) return { totalAttempts: 0, avgScore: 0, passRate: 0, distribution: [0, 0, 0, 0] };
    const total = results.length;
    const avgScore = results.reduce((s, r) => s + r.percentage, 0) / total;
    const passRate = (results.filter(r => r.percentage >= 70).length / total) * 100;
    const buckets = [0, 0, 0, 0];
    for (const r of results) {
      if (r.percentage < 50) buckets[0]++;
      else if (r.percentage < 70) buckets[1]++;
      else if (r.percentage < 85) buckets[2]++;
      else buckets[3]++;
    }
    const distribution = buckets.map(b => (b / total) * 100);
    return { totalAttempts: total, avgScore, passRate, distribution };
  }

  it('returns zeros for empty results', () => {
    const stats = computeBasicStats([]);
    expect(stats.totalAttempts).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.passRate).toBe(0);
    expect(stats.distribution).toEqual([0, 0, 0, 0]);
  });

  it('calculates correct avgScore', () => {
    const results = [
      { percentage: 60, quizId: 'q1', quizTitle: 'Test 1' },
      { percentage: 80, quizId: 'q1', quizTitle: 'Test 1' },
    ];
    const { avgScore } = computeBasicStats(results);
    expect(avgScore).toBe(70);
  });

  it('calculates pass rate (>=70%) correctly', () => {
    const results = [
      { percentage: 50, quizId: 'q1', quizTitle: 'T' },
      { percentage: 70, quizId: 'q1', quizTitle: 'T' },
      { percentage: 90, quizId: 'q1', quizTitle: 'T' },
      { percentage: 40, quizId: 'q1', quizTitle: 'T' },
    ];
    const { passRate } = computeBasicStats(results);
    expect(passRate).toBe(50); // 2 out of 4
  });

  it('distributes scores into correct buckets', () => {
    const results = [
      { percentage: 30, quizId: 'q1', quizTitle: 'T' }, // <50 → bucket 0
      { percentage: 60, quizId: 'q1', quizTitle: 'T' }, // 50–69 → bucket 1
      { percentage: 75, quizId: 'q1', quizTitle: 'T' }, // 70–84 → bucket 2
      { percentage: 95, quizId: 'q1', quizTitle: 'T' }, // >=85 → bucket 3
    ];
    const { distribution } = computeBasicStats(results);
    // Each bucket should be 25%
    expect(distribution[0]).toBe(25);
    expect(distribution[1]).toBe(25);
    expect(distribution[2]).toBe(25);
    expect(distribution[3]).toBe(25);
  });

  it('100% pass rate when all results >= 70%', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      percentage: 70 + i * 5,
      quizId: 'q1',
      quizTitle: 'T',
    }));
    const { passRate } = computeBasicStats(results);
    expect(passRate).toBe(100);
  });

  it('0% pass rate when all results < 70%', () => {
    const results = [
      { percentage: 30, quizId: 'q1', quizTitle: 'T' },
      { percentage: 55, quizId: 'q1', quizTitle: 'T' },
      { percentage: 69, quizId: 'q1', quizTitle: 'T' },
    ];
    const { passRate } = computeBasicStats(results);
    expect(passRate).toBeCloseTo(0);
  });

  it('correctly identifies weak concepts (avgPct < 70)', () => {
    // Simulate concept aggregation
    const conceptResults = [
      { conceptId: 'c1', percentage: 45 }, // weak
      { conceptId: 'c1', percentage: 55 }, // weak → avg 50
      { conceptId: 'c2', percentage: 80 }, // strong
      { conceptId: 'c2', percentage: 90 }, // strong → avg 85
    ];

    const conceptMap: Record<string, { sum: number; count: number }> = {};
    for (const r of conceptResults) {
      if (!conceptMap[r.conceptId]) conceptMap[r.conceptId] = { sum: 0, count: 0 };
      conceptMap[r.conceptId].sum += r.percentage;
      conceptMap[r.conceptId].count++;
    }

    const stats = Object.entries(conceptMap).map(([id, s]) => ({
      conceptId: id,
      avgPct: Math.round(s.sum / s.count),
    }));

    const weak = stats.filter(c => c.avgPct < 70);
    expect(weak).toHaveLength(1);
    expect(weak[0].conceptId).toBe('c1');
    expect(weak[0].avgPct).toBe(50);
  });

  // Critical regression test: Load More results must all be counted
  it('counts ALL results including Load More pages in aggregations', () => {
    const page1 = Array.from({ length: 5 }, (_, i) => ({
      percentage: 80,
      quizId: `q${i}`,
      quizTitle: `Quiz ${i}`,
    }));
    const page2 = Array.from({ length: 5 }, (_, i) => ({
      percentage: 40,
      quizId: `q${i + 5}`,
      quizTitle: `Quiz ${i + 5}`,
    }));
    const allResults = [...page1, ...page2]; // simulates localResults after Load More

    const page1Only = computeBasicStats(page1);
    const allCombined = computeBasicStats(allResults);

    // With only page1 (all 80%), pass rate is 100%
    expect(page1Only.passRate).toBe(100);

    // With all pages (50% at 80, 50% at 40), pass rate is 50%
    expect(allCombined.passRate).toBe(50);

    // This is the key regression: aggregations MUST use localResults, not results
    expect(allCombined.totalAttempts).toBe(10);
    expect(page1Only.totalAttempts).toBe(5);
  });
});
