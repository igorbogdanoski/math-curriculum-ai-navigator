/**
 * Server-side integrity check for `dugga_submissions` — re-derives the score for
 * every DETERMINISTIC question type from the test's actual answer key and the
 * student's stored raw answers, so a client can't simply POST a fabricated
 * score/percentage. This mirrors utils/duggaScoring.ts's `autoScore` for the
 * question types that need no extra dependency to re-verify server-side:
 * multiple_choice, checklist, true_false, statement_eval, ordering, multi_match,
 * list_items, section_header.
 *
 * NOT covered here (documented gap, not silently dropped): fill_blanks/short_answer
 * (needs the CAS engine — @cortex-js/compute-engine — not yet added to this
 * project's dependencies), function_match, proof_steps, unit_circle_pick,
 * student_chart (each needs its own dedicated grading module ported over), and
 * anything AI/manual-graded. For those, this function trusts the client-reported
 * per-question point value as-is — full parity is a follow-up, not attempted here
 * to avoid rushing a duplicate implementation of complex graders without adequate
 * testing time.
 *
 * This project builds independently from the main app (separate tsconfig/deps),
 * so this is a deliberate, documented COPY of the relevant slice of
 * utils/duggaScoring.ts, not a shared import — keep the two in sync by hand if the
 * deterministic-type grading rules ever change.
 */

export interface VerifOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface VerifMatchPair {
  left: string;
  right: string;
}

export interface VerifQuestion {
  id: string;
  type: string;
  points: number;
  options?: VerifOption[];
  correctAnswer?: string;
  matchPairs?: VerifMatchPair[];
  orderItems?: string[];
}

export interface VerifResult {
  /** Sum of recomputed points across every question this function CAN verify. */
  verifiedEarned: number;
  /** Sum of max points across every question this function CAN verify (denominator for the above). */
  verifiedMax: number;
  /** Question ids this function could not verify (needs CAS/complex-grader/AI — trusted as-is). */
  unverifiedQuestionIds: string[];
}

/**
 * 2026-07-19 (Wave 15.1 follow-up): true_false's correctAnswer was historically
 * authored as English 'true'/'false' by the teacher-editor while the student's
 * submitted answer is MK 'Точно'/'Неточно' — a literal compare never matched.
 * Kept in sync by hand with the identical helper in utils/duggaScoring.ts per
 * this file's documented "deliberate COPY, not a shared import" convention.
 */
function normalizeTrueFalse(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === 'true') return 'точно';
  if (v === 'false') return 'неточно';
  return v;
}

/** Re-derives earned points for one deterministic-type question. Returns null if this
 *  question type isn't one of the ones this module can verify without a heavier port. */
function verifyOneQuestion(q: VerifQuestion, answer: string | string[] | undefined): number | null {
  const rawAnswer = Array.isArray(answer) ? answer.join(',') : (answer ?? '');

  switch (q.type) {
    case 'multiple_choice': {
      const opt = q.options?.find(o => o.id === rawAnswer);
      const correct = opt?.isCorrect === true || (!!opt && opt.text === q.correctAnswer);
      return correct ? q.points : 0;
    }
    case 'checklist': {
      const selectedSet = new Set(rawAnswer ? rawAnswer.split(',').filter(Boolean) : []);
      const correctIds = (q.options ?? []).filter(o => o.isCorrect).map(o => o.id);
      if (!correctIds.length) return null;
      const allCorrect = correctIds.length === selectedSet.size && correctIds.every(id => selectedSet.has(id));
      const hits = correctIds.filter(id => selectedSet.has(id)).length;
      const wrong = [...selectedSet].filter(id => !correctIds.includes(id)).length;
      const ratio = hits / correctIds.length;
      return allCorrect ? q.points : Math.floor(q.points * ratio * (wrong > 0 ? 0.6 : 1));
    }
    case 'true_false': {
      if (!q.correctAnswer) return null;
      return normalizeTrueFalse(rawAnswer) === normalizeTrueFalse(q.correctAnswer) ? q.points : 0;
    }
    case 'statement_eval': {
      if (!q.correctAnswer) return null;
      return rawAnswer.toLowerCase() === q.correctAnswer.toLowerCase() ? q.points : 0;
    }
    case 'ordering': {
      if (!q.orderItems?.length) return null;
      const studentOrder = rawAnswer ? rawAnswer.split('|') : [];
      const correct = q.orderItems.length === studentOrder.length && q.orderItems.every((item, i) => studentOrder[i] === item);
      const hits = q.orderItems.filter((item, i) => studentOrder[i] === item).length;
      const ratio = hits / q.orderItems.length;
      return correct ? q.points : Math.floor(q.points * ratio * 0.7);
    }
    case 'multi_match': {
      if (!q.matchPairs?.length) return null;
      let parsed: Record<string, string> = {};
      try { parsed = rawAnswer ? JSON.parse(rawAnswer) : {}; } catch { /* malformed → 0 hits below */ }
      const hits = q.matchPairs.filter(p => parsed[p.left] === p.right).length;
      const correct = hits === q.matchPairs.length;
      return correct ? q.points : Math.floor(q.points * (hits / q.matchPairs.length));
    }
    case 'list_items': {
      if (!q.correctAnswer) return null;
      let submitted: string[] = [];
      try { submitted = rawAnswer ? JSON.parse(rawAnswer) : []; } catch { /* malformed → 0 hits below */ }
      const expected = q.correctAnswer.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const given = submitted.map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!expected.length) return null;
      const hits = expected.filter(e => given.includes(e)).length;
      const extra = given.filter(g => !expected.includes(g)).length;
      const correct = hits === expected.length && extra === 0;
      const ratio = hits / expected.length;
      return correct ? q.points : Math.floor(q.points * ratio * (extra > 0 ? 0.7 : 1));
    }
    case 'section_header':
      return 0;
    default:
      return null;
  }
}

export function verifyDeterministicQuestions(
  questions: VerifQuestion[],
  answers: Record<string, string | string[]>,
): VerifResult {
  let verifiedEarned = 0;
  let verifiedMax = 0;
  const unverifiedQuestionIds: string[] = [];

  for (const q of questions) {
    const earned = verifyOneQuestion(q, answers[q.id]);
    if (earned === null) {
      unverifiedQuestionIds.push(q.id);
      continue;
    }
    verifiedEarned += earned;
    verifiedMax += q.points;
  }

  return { verifiedEarned, verifiedMax, unverifiedQuestionIds };
}
