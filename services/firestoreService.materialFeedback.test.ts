import { describe, expect, it } from 'vitest';

import { buildFeedbackReasonBreakdown, createEmptyFeedbackReasonCounts } from './firestoreService.materialFeedback';

describe('buildFeedbackReasonBreakdown', () => {
  it('creates stable zeroed counts for all taxonomy codes', () => {
    const counts = createEmptyFeedbackReasonCounts();

    expect(counts.grammar).toBe(0);
    expect(counts.pedagogy).toBe(0);
    expect(counts.assessment_alignment).toBe(0);
    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
  });

  it('aggregates statuses, counts, percentages, and top reasons', () => {
    const breakdown = buildFeedbackReasonBreakdown([
      { status: 'approved', reasonCodes: [] },
      { status: 'revision_requested', reasonCodes: ['clarity', 'example_needed'] },
      { status: 'revision_requested', reasonCodes: ['clarity'] },
      { status: 'rejected', reasonCodes: ['accuracy', 'clarity'] },
    ], 14);

    expect(breakdown.totalFeedback).toBe(4);
    expect(breakdown.approved).toBe(1);
    expect(breakdown.revision_requested).toBe(2);
    expect(breakdown.rejected).toBe(1);
    expect(breakdown.reasonCounts.clarity).toBe(3);
    expect(breakdown.reasonCounts.example_needed).toBe(1);
    expect(breakdown.reasonCounts.accuracy).toBe(1);
    expect(breakdown.reasonPercentages.clarity).toBe(75);
    expect(breakdown.topReasons[0]).toEqual({
      code: 'clarity',
      count: 3,
      percentage: 75,
    });
    expect(breakdown.periodDays).toBe(14);
  });

  it('returns an empty breakdown when there is no feedback', () => {
    const breakdown = buildFeedbackReasonBreakdown([], 30);

    expect(breakdown.totalFeedback).toBe(0);
    expect(breakdown.topReasons).toEqual([]);
    expect(Object.values(breakdown.reasonCounts).every((value) => value === 0)).toBe(true);
    expect(Object.values(breakdown.reasonPercentages).every((value) => value === 0)).toBe(true);
  });
});