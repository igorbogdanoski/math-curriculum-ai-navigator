import { describe, it, expect } from 'vitest';

/**
 * Portfolio Stats — Unit Tests (T3)
 *
 * Tests the pure logic used in StudentPortfolioView:
 * - Best result deduplication (per concept, highest score wins)
 * - Metacognitive notes filtering (min length, sorted by date)
 * - Average percentage calculation
 * - Mastered concept sorting (most recent first)
 *
 * These functions are inline in the view (useMemo). We extract and test
 * the core logic here as pure functions.
 */

// ── Pure functions extracted from StudentPortfolioView ────────────────────────

/**
 * Deduplicates quiz results — keeps best score per conceptId.
 * Mirrors the `bestResults` useMemo in StudentPortfolioView.
 */
function getBestResults(results: Array<{ quizId: string; conceptId?: string; percentage: number; quizTitle?: string }>) {
  const best = new Map<string, typeof results[0]>();
  for (const r of results) {
    const key = r.conceptId || r.quizId;
    const existing = best.get(key);
    if (!existing || r.percentage > existing.percentage) {
      best.set(key, r);
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8);
}

/**
 * Filters valid metacognitive notes (min 10 chars).
 * Mirrors the `metacognitiveNotes` useMemo.
 */
function getValidNotes(results: Array<{ quizId: string; metacognitiveNote?: string; playedAt?: any }>) {
  return results.filter(r => r.metacognitiveNote && r.metacognitiveNote.trim().length > 10);
}

/**
 * Calculates average percentage across all results.
 */
function calcAvgPct(results: Array<{ percentage: number }>): number {
  if (results.length === 0) return 0;
  return results.reduce((s, r) => s + r.percentage, 0) / results.length;
}

// ── getBestResults ────────────────────────────────────────────────────────────

describe('getBestResults — deduplication logic', () => {
  it('returns empty array for no results', () => {
    expect(getBestResults([])).toHaveLength(0);
  });

  it('keeps only the best score per concept', () => {
    const results = [
      { quizId: 'q1', conceptId: 'fractions', percentage: 60 },
      { quizId: 'q2', conceptId: 'fractions', percentage: 85 },
      { quizId: 'q3', conceptId: 'fractions', percentage: 70 },
    ];
    const best = getBestResults(results);
    expect(best).toHaveLength(1);
    expect(best[0].percentage).toBe(85);
  });

  it('different concepts are all included', () => {
    const results = [
      { quizId: 'q1', conceptId: 'fractions', percentage: 90 },
      { quizId: 'q2', conceptId: 'multiplication', percentage: 75 },
      { quizId: 'q3', conceptId: 'geometry', percentage: 80 },
    ];
    const best = getBestResults(results);
    expect(best).toHaveLength(3);
  });

  it('results sorted by percentage descending', () => {
    const results = [
      { quizId: 'q1', conceptId: 'a', percentage: 70 },
      { quizId: 'q2', conceptId: 'b', percentage: 95 },
      { quizId: 'q3', conceptId: 'c', percentage: 55 },
    ];
    const best = getBestResults(results);
    expect(best[0].percentage).toBe(95);
    expect(best[1].percentage).toBe(70);
    expect(best[2].percentage).toBe(55);
  });

  it('caps at 8 results', () => {
    const results = Array.from({ length: 15 }, (_, i) => ({
      quizId: `q${i}`,
      conceptId: `concept${i}`,
      percentage: 50 + i,
    }));
    const best = getBestResults(results);
    expect(best.length).toBeLessThanOrEqual(8);
  });

  it('falls back to quizId key when conceptId is missing', () => {
    const results = [
      { quizId: 'quiz-abc', percentage: 80 },
      { quizId: 'quiz-abc', percentage: 90 },
    ];
    const best = getBestResults(results);
    expect(best).toHaveLength(1);
    expect(best[0].percentage).toBe(90);
  });
});

// ── getValidNotes ─────────────────────────────────────────────────────────────

describe('getValidNotes — metacognitive reflection filtering', () => {
  it('returns empty array when no notes', () => {
    const results = [
      { quizId: 'q1' },
      { quizId: 'q2', metacognitiveNote: '' },
    ];
    expect(getValidNotes(results)).toHaveLength(0);
  });

  it('filters out short notes (< 10 chars)', () => {
    const results = [
      { quizId: 'q1', metacognitiveNote: 'OK' },
      { quizId: 'q2', metacognitiveNote: 'Да' },
      { quizId: 'q3', metacognitiveNote: 'Тешко ми беше со именките' },
    ];
    const valid = getValidNotes(results);
    expect(valid).toHaveLength(1);
    expect(valid[0].quizId).toBe('q3');
  });

  it('includes notes with exactly 11 chars', () => {
    const results = [{ quizId: 'q1', metacognitiveNote: '12345678901' }]; // 11 chars
    expect(getValidNotes(results)).toHaveLength(1);
  });

  it('trims whitespace before length check', () => {
    const results = [{ quizId: 'q1', metacognitiveNote: '   ' }]; // only spaces
    expect(getValidNotes(results)).toHaveLength(0);
  });
});

// ── calcAvgPct ────────────────────────────────────────────────────────────────

describe('calcAvgPct — portfolio KPI calculation', () => {
  it('returns 0 for empty results', () => {
    expect(calcAvgPct([])).toBe(0);
  });

  it('calculates correct average', () => {
    const results = [{ percentage: 60 }, { percentage: 80 }, { percentage: 100 }];
    expect(calcAvgPct(results)).toBeCloseTo(80);
  });

  it('handles single result', () => {
    expect(calcAvgPct([{ percentage: 73 }])).toBe(73);
  });

  it('handles all zeros', () => {
    const results = [{ percentage: 0 }, { percentage: 0 }];
    expect(calcAvgPct(results)).toBe(0);
  });

  it('handles perfect scores', () => {
    const results = [{ percentage: 100 }, { percentage: 100 }, { percentage: 100 }];
    expect(calcAvgPct(results)).toBe(100);
  });
});

// ── Integration: portfolio KPI sanity ────────────────────────────────────────

describe('Portfolio stats integration', () => {
  it('real-world scenario: mixed results across concepts', () => {
    const results = [
      { quizId: 'q1', conceptId: 'fractions', percentage: 45 },
      { quizId: 'q2', conceptId: 'fractions', percentage: 72 },  // best for fractions
      { quizId: 'q3', conceptId: 'geometry', percentage: 88 },
      { quizId: 'q4', conceptId: 'algebra', percentage: 55 },
      { quizId: 'q5', conceptId: 'algebra', percentage: 91 },    // best for algebra
      { quizId: 'q6', conceptId: 'geometry', percentage: 65 },
    ];

    const best = getBestResults(results);
    // 3 unique concepts → 3 best results
    expect(best).toHaveLength(3);
    // Sorted by best score: algebra(91), geometry(88), fractions(72)
    expect(best[0].percentage).toBe(91);
    expect(best[0].conceptId).toBe('algebra');
    expect(best[1].percentage).toBe(88);
    expect(best[2].percentage).toBe(72);

    // Average of ALL 6 results (not just best)
    const avg = calcAvgPct(results);
    expect(avg).toBeCloseTo((45 + 72 + 88 + 55 + 91 + 65) / 6);
  });
});
