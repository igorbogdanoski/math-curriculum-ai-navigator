/**
 * S61-C3 — Tests for the unit_circle_pick auto-grader.
 */
import { describe, it, expect } from 'vitest';
import {
  gradeUnitCirclePick,
  parseUnitCirclePick,
} from '../utils/duggaUnitCirclePickGrading';
import type { DuggaExpectedUnitCirclePick, DuggaQuestion } from '../services/firestoreService.dugga';
import { autoScore } from '../utils/duggaScoring';

const expected90: DuggaExpectedUnitCirclePick = {
  angle: 90,
  unit: 'deg',
};

describe('parseUnitCirclePick', () => {
  it('returns undefined for empty / invalid input', () => {
    expect(parseUnitCirclePick('')).toBeUndefined();
    expect(parseUnitCirclePick('not json')).toBeUndefined();
  });
  it('parses an object', () => {
    expect(parseUnitCirclePick('{"angle":90}')).toEqual({ angle: 90 });
  });
});

describe('gradeUnitCirclePick — either mode (default)', () => {
  it('zero score on missing submission', () => {
    const r = gradeUnitCirclePick(expected90, undefined);
    expect(r.score).toBe(0);
    expect(r.details.angleMatch).toBe(false);
  });

  it('full credit on exact angle (deg)', () => {
    const r = gradeUnitCirclePick(expected90, { angle: 90 });
    expect(r.score).toBe(1);
    expect(r.details.angleMatch).toBe(true);
  });

  it('full credit on coterminal angle (deg)', () => {
    const r = gradeUnitCirclePick(expected90, { angle: 450 });
    expect(r.score).toBe(1);
    expect(r.details.angleMatch).toBe(true);
  });

  it('full credit on negative coterminal angle', () => {
    const r = gradeUnitCirclePick(expected90, { angle: -270 });
    expect(r.score).toBe(1);
  });

  it('full credit on point-only submission (cos 90°, sin 90°) ≈ (0, 1)', () => {
    const r = gradeUnitCirclePick(expected90, { x: 0, y: 1 });
    expect(r.score).toBe(1);
    expect(r.details.pointMatch).toBe(true);
  });

  it('zero credit when neither matches', () => {
    const r = gradeUnitCirclePick(expected90, { angle: 17 });
    expect(r.score).toBe(0);
  });
});

describe('gradeUnitCirclePick — radian unit', () => {
  const expectedPi: DuggaExpectedUnitCirclePick = { angle: Math.PI, unit: 'rad' };

  it('full credit on π (rad)', () => {
    const r = gradeUnitCirclePick(expectedPi, { angle: Math.PI });
    expect(r.score).toBe(1);
  });
  it('full credit on 3π (coterminal)', () => {
    const r = gradeUnitCirclePick(expectedPi, { angle: 3 * Math.PI });
    expect(r.score).toBe(1);
  });
  it('full credit on point (-1, 0)', () => {
    const r = gradeUnitCirclePick(expectedPi, { x: -1, y: 0 });
    expect(r.score).toBe(1);
  });
});

describe('gradeUnitCirclePick — strict modes', () => {
  it("match='angle' rejects correct point if angle missing", () => {
    const exp: DuggaExpectedUnitCirclePick = { ...expected90, match: 'angle' };
    const r = gradeUnitCirclePick(exp, { x: 0, y: 1 });
    expect(r.score).toBe(0);
  });

  it("match='point' rejects correct angle if point missing", () => {
    const exp: DuggaExpectedUnitCirclePick = { ...expected90, match: 'point' };
    const r = gradeUnitCirclePick(exp, { angle: 90 });
    expect(r.score).toBe(0);
  });

  it("match='point' accepts correct point", () => {
    const exp: DuggaExpectedUnitCirclePick = { ...expected90, match: 'point' };
    const r = gradeUnitCirclePick(exp, { x: 0, y: 1 });
    expect(r.score).toBe(1);
  });
});

describe('gradeUnitCirclePick — tolerance', () => {
  it('honours custom tolerance for deg', () => {
    const r = gradeUnitCirclePick(expected90, { angle: 92 }, 3);
    expect(r.score).toBe(1);
  });
  it('rejects out-of-tolerance', () => {
    const r = gradeUnitCirclePick(expected90, { angle: 95 }, 3);
    expect(r.score).toBe(0);
  });
});

describe('gradeUnitCirclePick — explicit point overrides cos/sin', () => {
  it('uses provided point when given', () => {
    const exp: DuggaExpectedUnitCirclePick = {
      angle: 90,
      unit: 'deg',
      point: { x: 0.5, y: 0.5 },
      match: 'point',
    };
    const r = gradeUnitCirclePick(exp, { x: 0.5, y: 0.5 });
    expect(r.score).toBe(1);
  });
});

describe('autoScore wiring for unit_circle_pick', () => {
  it('returns null when expectedUnitCircle is missing', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'unit_circle_pick', text: 'Изабери', dok: 2, points: 5,
    };
    expect(autoScore(q, '')).toBeNull();
  });

  it('returns full points on exact angle', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'unit_circle_pick', text: 'Изабери', dok: 2, points: 5,
      expectedUnitCircle: expected90,
    };
    const r = autoScore(q, JSON.stringify({ angle: 90 }))!;
    expect(r.earned).toBe(5);
    expect(r.correct).toBe(true);
  });

  it('returns 0 points on wrong submission', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'unit_circle_pick', text: 'Изабери', dok: 2, points: 5,
      expectedUnitCircle: expected90,
    };
    const r = autoScore(q, JSON.stringify({ angle: 17 }))!;
    expect(r.earned).toBe(0);
    expect(r.correct).toBe(false);
  });

  it('honours custom unitCircleTolerance', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'unit_circle_pick', text: 'Изабери', dok: 2, points: 4,
      expectedUnitCircle: expected90,
      unitCircleTolerance: 5,
    };
    const r = autoScore(q, JSON.stringify({ angle: 94 }))!;
    expect(r.correct).toBe(true);
    expect(r.earned).toBe(4);
  });
});
