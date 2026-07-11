import { verifyExpressionEquivalence } from '../../utils/cas/casEngine';
import type { DuggaQuestion } from '../../services/firestoreService.dugga';

export function isObjectiveType(type: string) {
  return ['multiple_choice', 'true_false', 'inline_select', 'fill_blanks', 'checklist'].includes(type);
}

export function isAnswerCorrect(q: DuggaQuestion, answer: string | string[] | undefined): boolean | null {
  if (answer === undefined || answer === null) return false;
  if (!isObjectiveType(q.type)) return null;
  if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'inline_select') {
    const correct = q.correctAnswer ?? q.options?.find(o => o.isCorrect)?.id;
    return String(answer).trim() === String(correct ?? '').trim();
  }
  if (q.type === 'fill_blanks') {
    const literalMatch = String(answer).trim().toLowerCase() === String(q.correctAnswer ?? '').trim().toLowerCase();
    if (literalMatch) return true;
    // Mirrors utils/duggaScoring.ts's autoScore CAS fallback — without this, this
    // independent results-view recompute could disagree with the live-graded score
    // for the same submission (e.g. "2x+2" vs a stored "2+2x").
    if (q.correctAnswer) {
      return verifyExpressionEquivalence(String(answer), q.correctAnswer).verdict === 'equivalent';
    }
    return false;
  }
  if (q.type === 'checklist') {
    const correctIds = (q.options ?? []).filter(o => o.isCorrect).map(o => o.id).sort();
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
