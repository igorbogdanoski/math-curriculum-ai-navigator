/**
 * S61-C4 — Tests for the proof_steps auto-grader.
 */
import { describe, it, expect } from 'vitest';
import {
  gradeProofSteps,
  parseProofSteps,
} from '../utils/duggaProofStepsGrading';
import type { DuggaExpectedProof, DuggaQuestion } from '../services/firestoreService.dugga';
import { autoScore } from '../utils/duggaScoring';

const expected: DuggaExpectedProof = {
  steps: [
    { id: 's1', text: 'Дадено: AB ∥ CD' },
    { id: 's2', text: 'Внатрешни наизменични агли се еднакви' },
    { id: 's3', text: 'Триаголниците се слични по AA' },
    { id: 's4', text: 'Заклучок: пропорции на страни' },
  ],
  distractors: [
    { id: 'd1', text: 'Питагорина теорема' },
    { id: 'd2', text: 'Збир на агли = 360°' },
  ],
};

describe('parseProofSteps', () => {
  it('returns undefined for empty / invalid', () => {
    expect(parseProofSteps('')).toBeUndefined();
    expect(parseProofSteps('not json')).toBeUndefined();
  });
  it('parses an array of strings', () => {
    expect(parseProofSteps('["a","b"]')).toEqual(['a', 'b']);
  });
  it('parses an object with steps[]', () => {
    expect(parseProofSteps('{"steps":["a","b"]}')).toEqual(['a', 'b']);
  });
  it('filters out non-strings', () => {
    expect(parseProofSteps('["a",1,null,"b"]')).toEqual(['a', 'b']);
  });
});

describe('gradeProofSteps', () => {
  it('zero score when no submission', () => {
    const r = gradeProofSteps(expected, undefined);
    expect(r.score).toBe(0);
    expect(r.details.missing).toBe(4);
  });

  it('full score on exact correct order', () => {
    const r = gradeProofSteps(expected, ['s1', 's2', 's3', 's4']);
    expect(r.score).toBe(1);
    expect(r.details.correctlyPlaced).toBe(4);
    expect(r.feedback).toMatch(/Браво/);
  });

  it('partial credit when steps are present but reordered', () => {
    // s1 correct (pos 0), s3 wrong pos (was 2 → now 1), s2 wrong pos, s4 correct (pos 3)
    const r = gradeProofSteps(expected, ['s1', 's3', 's2', 's4']);
    // correctlyPlaced=2 (s1, s4) presentButWrongPos=2 (s3,s2) → (2*1 + 2*0.5)/4 = 0.75
    expect(r.score).toBeCloseTo(0.75);
    expect(r.details.correctlyPlaced).toBe(2);
    expect(r.details.presentButWrongPos).toBe(2);
  });

  it('missing steps reduce score', () => {
    const r = gradeProofSteps(expected, ['s1', 's2']);
    // 2 correct positions / 4 expected = 0.5
    expect(r.score).toBe(0.5);
    expect(r.details.missing).toBe(2);
  });

  it('distractors penalised', () => {
    const r = gradeProofSteps(expected, ['s1', 's2', 's3', 's4', 'd1']);
    // 4 correct - 1*0.5 penalty = 3.5/4 = 0.875
    expect(r.score).toBeCloseTo(0.875);
    expect(r.details.distractorsSelected).toBe(1);
  });

  it('honours custom distractor penalty', () => {
    const exp: DuggaExpectedProof = { ...expected, distractorPenalty: 1 };
    const r = gradeProofSteps(exp, ['s1', 's2', 's3', 's4', 'd1']);
    // 4 - 1 = 3 / 4 = 0.75
    expect(r.score).toBe(0.75);
  });

  it('clamps score at 0 (cannot go negative)', () => {
    const r = gradeProofSteps(expected, ['d1', 'd2', 'd1', 'd2']);
    expect(r.score).toBe(0);
  });

  it('dedupes repeated submissions', () => {
    const r = gradeProofSteps(expected, ['s1', 's1', 's2', 's3', 's4']);
    expect(r.score).toBe(1);
    expect(r.details.correctlyPlaced).toBe(4);
  });

  it('feedback lists wrong-position count', () => {
    const r = gradeProofSteps(expected, ['s2', 's1', 's3', 's4']);
    // s2 wrong, s1 wrong, s3 right, s4 right
    expect(r.details.correctlyPlaced).toBe(2);
    expect(r.details.presentButWrongPos).toBe(2);
    expect(r.feedback).toMatch(/погрешен редослед/);
  });
});

describe('autoScore wiring for proof_steps', () => {
  it('returns null when expectedProof missing', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'proof_steps', text: 'Докажи', dok: 3, points: 8,
    };
    expect(autoScore(q, '')).toBeNull();
  });

  it('returns full points on perfect order', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'proof_steps', text: 'Докажи', dok: 3, points: 8,
      expectedProof: expected,
    };
    const r = autoScore(q, JSON.stringify(['s1', 's2', 's3', 's4']))!;
    expect(r.earned).toBe(8);
    expect(r.correct).toBe(true);
  });

  it('returns rounded partial points', () => {
    const q: DuggaQuestion = {
      id: 'q', type: 'proof_steps', text: 'Докажи', dok: 3, points: 8,
      expectedProof: expected,
    };
    // 2 of 4 correctly placed = 0.5 → 4 points
    const r = autoScore(q, JSON.stringify(['s1', 's2']))!;
    expect(r.earned).toBe(4);
    expect(r.correct).toBe(false);
  });
});
