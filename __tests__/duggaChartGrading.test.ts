/**
 * S61-C1 — Tests for the student_chart auto-grader.
 */
import { describe, it, expect } from 'vitest';
import {
  gradeStudentChart,
  parseStudentChart,
  type StudentChartSubmission,
} from '../utils/duggaChartGrading';
import type { DuggaExpectedChart, DuggaQuestion } from '../services/firestoreService.dugga';
import { autoScore } from '../utils/duggaScoring';

const expected: DuggaExpectedChart = {
  kind: 'bar',
  xLabel: 'Месец',
  yLabel: 'Продажба',
  data: [
    { x: 'Јан', y: 10 },
    { x: 'Фев', y: 20 },
    { x: 'Мар', y: 30 },
    { x: 'Апр', y: 40 },
  ],
};

describe('parseStudentChart', () => {
  it('returns undefined for empty / invalid input', () => {
    expect(parseStudentChart('')).toBeUndefined();
    expect(parseStudentChart('not json')).toBeUndefined();
  });
  it('parses a JSON object', () => {
    const out = parseStudentChart('{"kind":"bar","data":[]}');
    expect(out?.kind).toBe('bar');
  });
});

describe('gradeStudentChart', () => {
  it('returns 0 with feedback for missing submission', () => {
    const r = gradeStudentChart(expected, undefined, 5);
    expect(r.score).toBe(0);
    expect(r.feedback).toMatch(/Не е поднесен/);
  });

  it('full score for an exact match', () => {
    const sub: StudentChartSubmission = {
      kind: 'bar',
      xLabel: 'Месец',
      yLabel: 'Продажба',
      data: [...expected.data],
    };
    const r = gradeStudentChart(expected, sub, 5);
    expect(r.score).toBeCloseTo(1, 5);
    expect(r.details.pointHits).toBe(4);
    expect(r.details.kindMatch).toBe(true);
    expect(r.details.labelMatch).toBe(true);
  });

  it('partial credit when only some points hit (kind+labels right)', () => {
    const sub: StudentChartSubmission = {
      kind: 'bar',
      xLabel: 'Месец',
      yLabel: 'Продажба',
      data: [
        { x: 'Јан', y: 10 },
        { x: 'Фев', y: 20 },
        { x: 'Мар', y: 999 }, // wrong
        { x: 'Апр', y: 999 }, // wrong
      ],
    };
    const r = gradeStudentChart(expected, sub, 5);
    // 0.2 (kind) + 0.2 (labels) + 0.6 * 2/4 = 0.7
    expect(r.score).toBeCloseTo(0.7, 5);
  });

  it('zero pointMatch when kind & labels wrong & data wrong', () => {
    const sub: StudentChartSubmission = {
      kind: 'line',
      xLabel: 'X',
      yLabel: 'Y',
      data: [{ x: 'Z', y: -1 }],
    };
    const r = gradeStudentChart(expected, sub, 5);
    expect(r.score).toBeCloseTo(0, 5);
    expect(r.details.kindMatch).toBe(false);
  });

  it('respects tolerance for numeric ys', () => {
    const sub: StudentChartSubmission = {
      kind: 'bar',
      xLabel: 'Месец',
      yLabel: 'Продажба',
      data: [
        { x: 'Јан', y: 10.5 },  // within 5% tolerance of (yRange=30) => absTol=1.5
        { x: 'Фев', y: 21 },
        { x: 'Мар', y: 31.4 },
        { x: 'Апр', y: 39 },
      ],
    };
    const r = gradeStudentChart(expected, sub, 5);
    expect(r.details.pointHits).toBe(4);
  });

  it('does not let a single submitted point satisfy multiple expected numeric-x points (consumption tracking)', () => {
    const numericExpected: DuggaExpectedChart = {
      kind: 'line',
      data: [
        { x: 100, y: 5 },
        { x: 103, y: 5 },
        { x: 106, y: 5 },
        { x: 109, y: 5 },
      ],
    };
    const sub: StudentChartSubmission = {
      kind: 'line',
      data: [{ x: 104.5, y: 5 }], // one point, within 5% relative-x tolerance of all four expected x values
    };
    const r = gradeStudentChart(numericExpected, sub, 5);
    // Must NOT be treated as 4/4 — only one submitted point exists to match against.
    expect(r.details.pointHits).toBe(1);
  });

  it('case-insensitive label matching', () => {
    const sub: StudentChartSubmission = {
      kind: 'bar',
      xLabel: '  МЕСЕЦ  ',
      yLabel: 'продажба',
      data: [...expected.data],
    };
    const r = gradeStudentChart(expected, sub, 5);
    expect(r.details.labelMatch).toBe(true);
  });
});

describe('autoScore wiring for student_chart', () => {
  it('returns null when expectedChart is missing', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'student_chart', text: 'Нацртај', dok: 2, points: 10,
    };
    expect(autoScore(q, '')).toBeNull();
  });

  it('returns full points on exact match', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'student_chart', text: 'Нацртај', dok: 2, points: 10,
      expectedChart: expected,
    };
    const submission = JSON.stringify({
      kind: 'bar', xLabel: 'Месец', yLabel: 'Продажба', data: expected.data,
    });
    const r = autoScore(q, submission)!;
    expect(r.earned).toBe(10);
    expect(r.correct).toBe(true);
  });

  it('rounds partial points correctly', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'student_chart', text: 'Нацртај', dok: 2, points: 10,
      expectedChart: expected,
    };
    const submission = JSON.stringify({
      kind: 'bar', xLabel: 'Месец', yLabel: 'Продажба',
      data: [
        { x: 'Јан', y: 10 },
        { x: 'Фев', y: 20 },
        { x: 'Мар', y: 0 },
        { x: 'Апр', y: 0 },
      ],
    });
    const r = autoScore(q, submission)!;
    // 0.2+0.2+0.6*0.5 = 0.7  → 7
    expect(r.earned).toBe(7);
    expect(r.correct).toBe(false);
  });
});
