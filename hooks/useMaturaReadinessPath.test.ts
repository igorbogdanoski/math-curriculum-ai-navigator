import { describe, it, expect } from 'vitest';
import { computeReadinessPath } from './useMaturaReadinessPath';
import type { UseMaturaStatsResult } from './useMaturaStats';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

type WeakConcepts = UseMaturaStatsResult['weakConcepts'];

function makeConcept(id: string, pct: number, title = `Концепт ${id}`): WeakConcepts[number] {
  return {
    concept: {
      id,
      title,
      gradeLevel: 10,
      topicId: 'topic-1',
      description: '',
      assessmentStandards: [],
    },
    pct,
    questions: 5,
  };
}

const WEAK = [
  makeConcept('c1', 0),   // uncovered
  makeConcept('c2', 20),  // weak
  makeConcept('c3', 40),  // weak
  makeConcept('c4', 60),  // above threshold — excluded
];

// ─── examPassed ───────────────────────────────────────────────────────────────

describe('computeReadinessPath — examPassed', () => {
  it('examPassed = false when days > 0', () => {
    const result = computeReadinessPath(WEAK, 30);
    expect(result.examPassed).toBe(false);
  });

  it('examPassed = true when days = 0 (today)', () => {
    const result = computeReadinessPath(WEAK, 0);
    expect(result.examPassed).toBe(true);
  });

  it('examPassed = true when days < 0 (past)', () => {
    const result = computeReadinessPath(WEAK, -10);
    expect(result.examPassed).toBe(true);
  });

  it('returns empty steps when exam has passed', () => {
    const result = computeReadinessPath(WEAK, -5);
    expect(result.steps).toHaveLength(0);
  });

  it('onTrack = false when exam has passed', () => {
    const result = computeReadinessPath(WEAK, -5);
    expect(result.onTrack).toBe(false);
  });

  it('daysUntilExam clamped to 1 even when negative (effectiveDays)', () => {
    const result = computeReadinessPath(WEAK, -99);
    expect(result.daysUntilExam).toBe(1);
  });
});

// ─── PASS_THRESHOLD filtering ─────────────────────────────────────────────────

describe('computeReadinessPath — concept filtering', () => {
  it('excludes concepts at or above 55%', () => {
    const result = computeReadinessPath(WEAK, 30);
    const ids = result.steps.map(s => s.conceptId);
    expect(ids).not.toContain('c4');
  });

  it('includes concepts below 55%', () => {
    const result = computeReadinessPath(WEAK, 30);
    const ids = result.steps.map(s => s.conceptId);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
    expect(ids).toContain('c3');
  });

  it('uncovered (pct=0) concepts rank first', () => {
    const result = computeReadinessPath(WEAK, 30);
    expect(result.steps[0].conceptId).toBe('c1');
    expect(result.steps[0].status).toBe('uncovered');
  });

  it('weak concepts sorted ascending by pct after uncovered', () => {
    const result = computeReadinessPath(WEAK, 30);
    expect(result.steps[1].pct).toBeLessThanOrEqual(result.steps[2].pct);
  });

  it('returns empty steps when all concepts are above threshold', () => {
    const allPassing = [makeConcept('a', 60), makeConcept('b', 80)];
    const result = computeReadinessPath(allPassing, 30);
    expect(result.steps).toHaveLength(0);
  });

  it('returns empty steps when weakConcepts is empty', () => {
    const result = computeReadinessPath([], 30);
    expect(result.steps).toHaveLength(0);
  });
});

// ─── weeklyHours scheduling ───────────────────────────────────────────────────

describe('computeReadinessPath — weekly scheduling', () => {
  it('assigns weekNumber starting at 1', () => {
    const result = computeReadinessPath(WEAK, 14); // 2 weeks
    expect(result.steps[0].weekNumber).toBe(1);
  });

  it('recommendedPerWeek = ceil(concepts / weeks)', () => {
    // 3 concepts, 3 weeks → 1/week
    const result = computeReadinessPath(WEAK, 21);
    expect(result.recommendedPerWeek).toBe(1);
  });

  it('recommendedPerWeek minimum is 1', () => {
    // 1 concept, 100 weeks
    const result = computeReadinessPath([makeConcept('x', 0)], 700);
    expect(result.recommendedPerWeek).toBe(1);
  });

  it('onTrack when concepts ≤ weeks available', () => {
    // 3 concepts, 4 weeks → onTrack
    const result = computeReadinessPath(WEAK, 28);
    expect(result.onTrack).toBe(true);
  });

  it('not onTrack when concepts > weeks available', () => {
    // 3 concepts, 1 week
    const result = computeReadinessPath(WEAK, 7);
    expect(result.onTrack).toBe(false);
  });
});

// ─── rank and status fields ───────────────────────────────────────────────────

describe('computeReadinessPath — step fields', () => {
  it('rank starts at 1 and increments', () => {
    const result = computeReadinessPath(WEAK, 30);
    result.steps.forEach((s, i) => expect(s.rank).toBe(i + 1));
  });

  it('priority equals rank', () => {
    const result = computeReadinessPath(WEAK, 30);
    result.steps.forEach(s => expect(s.priority).toBe(s.rank));
  });

  it('status = uncovered when pct = 0', () => {
    const result = computeReadinessPath([makeConcept('z', 0)], 30);
    expect(result.steps[0].status).toBe('uncovered');
  });

  it('status = weak when 0 < pct < 55', () => {
    const result = computeReadinessPath([makeConcept('z', 30)], 30);
    expect(result.steps[0].status).toBe('weak');
  });
});
