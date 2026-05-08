/**
 * Schema-only validation for the matura grading golden dataset (T5.1).
 * Runs in CI as part of `npm run test`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface RubricRow { criterion: string; points: number }
interface Case {
  id: string;
  topic: string;
  questionText: string;
  maxScore: number;
  rubric: RubricRow[];
  studentSolution: string;
  expectedScore: number;
  expectedBand: 'perfect' | 'high' | 'partial' | 'low' | 'zero';
}
interface Band { label: string; minPct: number; maxPct: number }
interface Golden {
  version: string;
  rubricBands: Band[];
  cases: Case[];
}

const golden: Golden = JSON.parse(
  readFileSync(resolve(__dirname, 'matura-grading-golden.json'), 'utf8'),
);

describe('matura-grading-golden.json', () => {
  it('contains at least 30 cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(30);
  });

  it('every case has unique id', () => {
    const ids = new Set(golden.cases.map((c) => c.id));
    expect(ids.size).toBe(golden.cases.length);
  });

  it('rubric points always sum to maxScore', () => {
    for (const c of golden.cases) {
      const sum = c.rubric.reduce((s, r) => s + r.points, 0);
      expect(sum, `case ${c.id}`).toBe(c.maxScore);
    }
  });

  it('expectedScore is between 0 and maxScore', () => {
    for (const c of golden.cases) {
      expect(c.expectedScore).toBeGreaterThanOrEqual(0);
      expect(c.expectedScore).toBeLessThanOrEqual(c.maxScore);
    }
  });

  it('expectedBand matches expectedScore percentage', () => {
    for (const c of golden.cases) {
      const pct = c.maxScore > 0 ? c.expectedScore / c.maxScore : 0;
      const band = golden.rubricBands.find((b) => pct >= b.minPct && pct <= b.maxPct);
      expect(band?.label, `case ${c.id} pct=${pct}`).toBe(c.expectedBand);
    }
  });

  it('topics cover all matura domains', () => {
    const topics = new Set(golden.cases.map((c) => c.topic));
    for (const required of ['algebra', 'geometrija', 'analiza', 'kombinatorika', 'trigonometrija']) {
      expect(topics.has(required)).toBe(true);
    }
  });

  it('all required text fields are non-empty', () => {
    for (const c of golden.cases) {
      expect(c.questionText.length).toBeGreaterThan(0);
      expect(c.studentSolution.length).toBeGreaterThan(0);
      expect(c.rubric.length).toBeGreaterThan(0);
    }
  });
});
