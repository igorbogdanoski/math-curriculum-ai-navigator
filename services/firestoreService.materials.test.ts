import { describe, it, expect } from 'vitest';
import { buildAIMaterialFeedbackSummaryFromEvents } from './firestoreService.materials';

describe('buildAIMaterialFeedbackSummaryFromEvents', () => {
  it('aggregates edit/reject/accept counts per material type', () => {
    const summary = buildAIMaterialFeedbackSummaryFromEvents([
      { materialType: 'assessment', action: 'edit_started' },
      { materialType: 'assessment', action: 'edit_saved' },
      { materialType: 'assessment', action: 'reject_edit' },
      { materialType: 'assessment', action: 'accept_saved' },
      { materialType: 'ideas', action: 'edit_regenerated' },
      { materialType: 'ideas', action: 'reject_visual' },
    ], 14);

    expect(summary.windowDays).toBe(14);
    expect(summary.totalEvents).toBe(6);

    const assessment = summary.byMaterialType.find((r) => r.materialType === 'assessment');
    expect(assessment).toEqual({
      materialType: 'assessment',
      total: 4,
      editEvents: 2,
      rejectEvents: 1,
      acceptEvents: 1,
    });

    const ideas = summary.byMaterialType.find((r) => r.materialType === 'ideas');
    expect(ideas).toEqual({
      materialType: 'ideas',
      total: 2,
      editEvents: 1,
      rejectEvents: 1,
      acceptEvents: 0,
    });
  });

  it('sorts rows by total descending and falls back to other type', () => {
    const summary = buildAIMaterialFeedbackSummaryFromEvents([
      { materialType: 'rubric', action: 'accept_saved' },
      { materialType: 'other', action: 'accept_saved' },
      { materialType: undefined as any, action: 'edit_started' },
      { materialType: 'presentation', action: 'reject_visual' },
      { materialType: 'presentation', action: 'edit_regenerated' },
      { materialType: 'presentation', action: 'accept_saved' },
    ]);

    expect(summary.byMaterialType[0].materialType).toBe('presentation');
    expect(summary.byMaterialType[0].total).toBe(3);

    const other = summary.byMaterialType.find((r) => r.materialType === 'other');
    expect(other?.total).toBe(2);
    expect(other?.editEvents).toBe(1);
    expect(other?.acceptEvents).toBe(1);
  });

  it('counts total events even when action prefix is unrecognized', () => {
    const summary = buildAIMaterialFeedbackSummaryFromEvents([
      { materialType: 'assessment', action: 'edit_saved' },
      { materialType: 'assessment', action: 'accept_saved' },
      { materialType: 'assessment', action: 'edit_started' },
      { materialType: 'assessment', action: 'reject_edit' },
      { materialType: 'assessment', action: 'edit_regenerated' },
      { materialType: 'assessment', action: 'accept_saved' },
      { materialType: 'assessment', action: 'reject_visual' },
      { materialType: 'assessment', action: 'edit_saved' },
      { materialType: 'assessment', action: 'accept_saved' },
      { materialType: 'assessment', action: 'noop_action' as any },
    ] as any);

    expect(summary.totalEvents).toBe(10);
    const assessment = summary.byMaterialType[0];
    expect(assessment.total).toBe(10);
    expect(assessment.editEvents).toBe(4);
    expect(assessment.rejectEvents).toBe(2);
    expect(assessment.acceptEvents).toBe(3);
  });
});
