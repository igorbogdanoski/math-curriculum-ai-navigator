/**
 * S61-C4 — Pure grading helper for `proof_steps` questions.
 *
 * The student reorders / selects step IDs from a pool that mixes the
 * correct expected proof steps with optional distractors. Submission is
 * a JSON array of step IDs in chosen order.
 *
 * Score breakdown per expected step:
 *   • +1.0 — present at the correct position,
 *   • +0.5 — present but wrong position (still gets partial credit).
 *   • Distractors selected subtract `distractorPenalty` (default 0.5)
 *     each, clamped at 0.
 * Final score = (sum) / expected.length, in [0, 1].
 */
import type { DuggaExpectedProof } from '../services/firestoreService.dugga';

export type ProofStepsSubmission = string[];

export interface ProofStepsGradeResult {
  score: number;
  feedback: string;
  details: {
    correctlyPlaced: number;
    presentButWrongPos: number;
    missing: number;
    distractorsSelected: number;
    expectedTotal: number;
  };
}

export function parseProofSteps(answer: string): ProofStepsSubmission | undefined {
  if (!answer || !answer.trim()) return undefined;
  try {
    const parsed = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown }).steps)) {
      return ((parsed as { steps: unknown[] }).steps).filter((v): v is string => typeof v === 'string');
    }
  } catch { /* fallthrough */ }
  return undefined;
}

export function gradeProofSteps(
  expected: DuggaExpectedProof,
  submitted: ProofStepsSubmission | undefined,
): ProofStepsGradeResult {
  const expectedIds = expected.steps.map(s => s.id);
  const distractorIds = new Set((expected.distractors ?? []).map(s => s.id));
  const penalty = expected.distractorPenalty ?? 0.5;

  if (!submitted || submitted.length === 0) {
    return {
      score: 0,
      feedback: 'Не е поднесена низа на чекори.',
      details: {
        correctlyPlaced: 0,
        presentButWrongPos: 0,
        missing: expectedIds.length,
        distractorsSelected: 0,
        expectedTotal: expectedIds.length,
      },
    };
  }

  // Dedupe submitted (preserve order) — repeated IDs don't earn double credit.
  const seen = new Set<string>();
  const submittedUnique: string[] = [];
  for (const id of submitted) {
    if (!seen.has(id)) {
      seen.add(id);
      submittedUnique.push(id);
    }
  }

  const expectedSet = new Set(expectedIds);
  let correctlyPlaced = 0;
  let presentButWrongPos = 0;
  let distractorsSelected = 0;

  // Filter out distractors first; tally them.
  const onlyExpectedSubmitted: string[] = [];
  for (const id of submittedUnique) {
    if (distractorIds.has(id)) {
      distractorsSelected++;
      continue;
    }
    if (expectedSet.has(id)) onlyExpectedSubmitted.push(id);
  }

  // Position match: compare the order the student picked correct steps
  // against the canonical order of those same IDs in `expectedIds`.
  for (let i = 0; i < onlyExpectedSubmitted.length; i++) {
    const id = onlyExpectedSubmitted[i];
    if (expectedIds[i] === id) {
      correctlyPlaced++;
    } else {
      presentButWrongPos++;
    }
  }

  const missing = expectedIds.length - (correctlyPlaced + presentButWrongPos);

  const raw =
    correctlyPlaced * 1.0 +
    presentButWrongPos * 0.5 -
    distractorsSelected * penalty;
  const denom = Math.max(1, expectedIds.length);
  const score = Math.max(0, Math.min(1, raw / denom));

  const fb: string[] = [];
  if (correctlyPlaced === expectedIds.length && distractorsSelected === 0) {
    fb.push('Доказот е целосно точен. Браво!');
  } else {
    if (correctlyPlaced) fb.push(`Точно поставени: ${correctlyPlaced}/${expectedIds.length}.`);
    if (presentButWrongPos) fb.push(`Точни но во погрешен редослед: ${presentButWrongPos}.`);
    if (missing > 0) fb.push(`Недостасуваат чекори: ${missing}.`);
    if (distractorsSelected > 0) fb.push(`Избрани погрешни чекори: ${distractorsSelected}.`);
  }

  return {
    score,
    feedback: fb.join(' '),
    details: {
      correctlyPlaced,
      presentButWrongPos,
      missing: Math.max(0, missing),
      distractorsSelected,
      expectedTotal: expectedIds.length,
    },
  };
}
