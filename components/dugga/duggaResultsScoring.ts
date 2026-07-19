import { verifyExpressionEquivalence } from '../../utils/cas/casEngine';
import { normalizeTrueFalse } from '../../utils/duggaScoring';
import type { DuggaQuestion } from '../../services/firestoreService.dugga';

export function isObjectiveType(type: string) {
  return ['multiple_choice', 'true_false', 'inline_select', 'fill_blanks', 'checklist'].includes(type);
}

export function isAnswerCorrect(q: DuggaQuestion, answer: string | string[] | undefined): boolean | null {
  if (answer === undefined || answer === null) return false;
  if (!isObjectiveType(q.type)) return null;
  if (q.type === 'true_false') {
    const correct = q.correctAnswer;
    return normalizeTrueFalse(String(answer)) === normalizeTrueFalse(String(correct ?? ''));
  }
  if (q.type === 'multiple_choice' || q.type === 'inline_select') {
    const correct = q.correctAnswer ?? q.options?.find(o => o.isCorrect)?.id;
    return String(answer).trim() === String(correct ?? '').trim();
  }
  if (q.type === 'fill_blanks') {
    // 2026-07-19 (audit_2026_07_18_full_app_review, Wave 5.1/5.2): a missing answer
    // key means this question was never gradeable — not "every student got it
    // wrong". Returning `false` here made the per-question accuracy bar show a
    // misleading 0%-correct result; `null` correctly falls through to "AI оценување"
    // (see needsManualReview() in utils/duggaScoring.ts for the live-grading side).
    if (!q.correctAnswer) return null;
    const literalMatch = String(answer).trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    if (literalMatch) return true;
    // Mirrors utils/duggaScoring.ts's autoScore CAS fallback — without this, this
    // independent results-view recompute could disagree with the live-graded score
    // for the same submission (e.g. "2x+2" vs a stored "2+2x").
    return verifyExpressionEquivalence(String(answer), q.correctAnswer).verdict === 'equivalent';
  }
  if (q.type === 'checklist') {
    const correctIds = (q.options ?? []).filter(o => o.isCorrect).map(o => o.id).sort();
    if (!correctIds.length) return null; // no answer key authored — see fill_blanks comment above
    const given = (Array.isArray(answer) ? answer : [answer]).slice().sort();
    return JSON.stringify(correctIds) === JSON.stringify(given);
  }
  return null;
}

export function gradeLabel(pct: number) {
  if (pct >= 90) return '5';
  if (pct >= 75) return '4';
  if (pct >= 60) return '3';
  if (pct >= 50) return '2';
  return '1';
}

export function gradeBg(pct: number) {
  if (pct >= 90) return 'bg-green-100 text-green-700';
  if (pct >= 75) return 'bg-blue-100 text-blue-700';
  if (pct >= 60) return 'bg-indigo-100 text-indigo-700';
  if (pct >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}
