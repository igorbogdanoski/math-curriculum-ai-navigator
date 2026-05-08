/**
 * Schema-only validation for the matura tutor golden dataset (T5.2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Case {
  id: string;
  topic: string;
  studentQuestion: string;
  expectedKeywords: string[];
  expectedSteps?: number;
  expectedExactAnswers?: string[];
  forbiddenPhrases?: string[];
  mustContainFollowUpPrompt?: boolean;
}
interface Golden {
  version: string;
  cases: Case[];
}

const golden: Golden = JSON.parse(
  readFileSync(resolve(__dirname, 'matura-tutor-golden.json'), 'utf8'),
);

describe('matura-tutor-golden.json', () => {
  it('contains at least 20 cases', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(20);
  });

  it('every case has unique id', () => {
    const ids = new Set(golden.cases.map((c) => c.id));
    expect(ids.size).toBe(golden.cases.length);
  });

  it('every case has at least one expected keyword', () => {
    for (const c of golden.cases) {
      expect(c.expectedKeywords.length, `case ${c.id}`).toBeGreaterThan(0);
    }
  });

  it('topics cover the matura domains', () => {
    const topics = new Set(golden.cases.map((c) => c.topic));
    for (const required of ['algebra', 'geometrija', 'analiza', 'trigonometrija', 'kombinatorika']) {
      expect(topics.has(required)).toBe(true);
    }
  });

  it('expectedSteps is positive when set', () => {
    for (const c of golden.cases) {
      if (c.expectedSteps != null) expect(c.expectedSteps).toBeGreaterThan(0);
    }
  });

  it('all student questions are in Macedonian (Cyrillic)', () => {
    const cyr = /[\u0400-\u04FF]/;
    for (const c of golden.cases) {
      expect(cyr.test(c.studentQuestion), `case ${c.id}`).toBe(true);
    }
  });
});
