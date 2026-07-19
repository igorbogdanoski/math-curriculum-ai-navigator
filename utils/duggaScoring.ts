import type { DuggaQuestion } from '../services/firestoreService.dugga';
import { gradeStudentChart, parseStudentChart } from './duggaChartGrading';
import { gradeFunctionMatch, parseFunctionMatch } from './duggaFunctionMatchGrading';
import { gradeUnitCirclePick, parseUnitCirclePick } from './duggaUnitCirclePickGrading';
import { gradeProofSteps, parseProofSteps } from './duggaProofStepsGrading';
import { verifyExpressionEquivalence } from './cas/casEngine';

export interface QResult {
  earned: number;
  maxPoints: number;
  correct: boolean | null; // null = AI / manual review needed
  feedback: string;
  aiGrade?: string;
  /** true if this result was flipped from an initial literal-match failure to correct via CAS verification. */
  viaCas?: boolean;
}

// Returns a scored result for auto-gradeable question types.
// Returns null when the question requires AI or manual grading.
export function autoScore(q: DuggaQuestion, answer: string): QResult | null {
  const base = { maxPoints: q.points };
  switch (q.type) {
    case 'multiple_choice': {
      const opt = q.options?.find(o => o.id === answer);
      const correct = opt?.isCorrect === true || (!!opt && opt.text === q.correctAnswer);
      return { ...base, earned: correct ? q.points : 0, correct, feedback: correct ? '' : `Точен: ${q.correctAnswer}` };
    }
    case 'checklist': {
      // Dedupe via a Set — the raw answer string can contain a repeated id (e.g. "a,a"),
      // which must not count as selecting two distinct correct options.
      const selectedSet = new Set(answer ? answer.split(',').filter(Boolean) : []);
      const correctIds = (q.options ?? []).filter(o => o.isCorrect).map(o => o.id);
      if (!correctIds.length) return null;
      const allCorrect = correctIds.length === selectedSet.size && correctIds.every(id => selectedSet.has(id));
      const hits = correctIds.filter(id => selectedSet.has(id)).length;
      const wrong = [...selectedSet].filter(id => !correctIds.includes(id)).length;
      const ratio = hits / correctIds.length;
      const earned = allCorrect ? q.points : Math.floor(q.points * ratio * (wrong > 0 ? 0.6 : 1));
      const correctTexts = (q.options ?? []).filter(o => o.isCorrect).map(o => o.text).join(', ');
      return { ...base, earned, correct: allCorrect, feedback: allCorrect ? '' : `Точни: ${correctTexts}` };
    }
    case 'true_false':
    case 'statement_eval': {
      if (!q.correctAnswer) return null;
      const correct = answer.toLowerCase() === q.correctAnswer.toLowerCase();
      return { ...base, earned: correct ? q.points : 0, correct, feedback: correct ? '' : `Точен: ${q.correctAnswer}` };
    }
    case 'fill_blanks':
    case 'short_answer': {
      if (!q.correctAnswer) return null;
      const literalMatch = answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
      if (literalMatch) {
        return { ...base, earned: q.points, correct: true, feedback: '' };
      }
      // Literal mismatch doesn't necessarily mean wrong — e.g. "2x+2" vs the stored "2+2x" are
      // the same answer written differently. Only an 'equivalent' CAS verdict flips this to
      // correct; anything else (not_equivalent, inconclusive, unparseable) keeps today's result.
      const casResult = verifyExpressionEquivalence(answer, q.correctAnswer);
      const correct = casResult.verdict === 'equivalent';
      return {
        ...base, earned: correct ? q.points : 0, correct,
        feedback: correct ? '' : `Точен: ${q.correctAnswer}`,
        viaCas: correct || undefined,
      };
    }
    case 'ordering': {
      if (!q.orderItems?.length) return null;
      const studentOrder = answer ? answer.split('|') : [];
      const correct = q.orderItems.length === studentOrder.length && q.orderItems.every((item, i) => studentOrder[i] === item);
      const hits = q.orderItems.filter((item, i) => studentOrder[i] === item).length;
      const ratio = hits / q.orderItems.length;
      return { ...base, earned: correct ? q.points : Math.floor(q.points * ratio * 0.7), correct, feedback: correct ? '' : `Точен редослед: ${q.orderItems.join(' → ')}` };
    }
    case 'multi_match': {
      if (!q.matchPairs?.length) return null;
      let parsed: Record<string, string> = {};
      try { parsed = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      const hits = q.matchPairs.filter(p => parsed[p.left] === p.right).length;
      const correct = hits === q.matchPairs.length;
      const earned = correct ? q.points : Math.floor(q.points * (hits / q.matchPairs.length));
      return { ...base, earned, correct, feedback: correct ? '' : `Точни поврзувања: ${hits}/${q.matchPairs.length}` };
    }
    case 'function_match': {
      if (!q.expectedTransform) return null;
      const submitted = parseFunctionMatch(answer);
      const result = gradeFunctionMatch(q.expectedTransform, submitted, q.transformTolerance ?? 0.1);
      const earned = Math.round(result.score * q.points);
      const correct = result.details.hits === 4;
      return { ...base, earned, correct, feedback: result.feedback };
    }
    case 'proof_steps': {
      if (!q.expectedProof || !q.expectedProof.steps?.length) return null;
      const submitted = parseProofSteps(answer);
      const result = gradeProofSteps(q.expectedProof, submitted);
      const earned = Math.round(result.score * q.points);
      const correct = result.score >= 0.999;
      return { ...base, earned, correct, feedback: result.feedback };
    }
    case 'unit_circle_pick': {
      if (!q.expectedUnitCircle) return null;
      const submitted = parseUnitCirclePick(answer);
      const result = gradeUnitCirclePick(q.expectedUnitCircle, submitted, q.unitCircleTolerance ?? 0.05);
      const earned = Math.round(result.score * q.points);
      const correct = result.score >= 0.999;
      return { ...base, earned, correct, feedback: result.feedback };
    }
    case 'student_chart': {
      if (!q.expectedChart) return null;
      const submitted = parseStudentChart(answer);
      const result = gradeStudentChart(q.expectedChart, submitted, q.chartTolerance ?? 5);
      const earned = Math.round(result.score * q.points);
      const correct = result.score >= 0.999;
      return { ...base, earned, correct, feedback: result.feedback };
    }
    case 'list_items': {
      if (!q.correctAnswer) return null;
      let submitted: string[] = [];
      try { submitted = answer ? JSON.parse(answer) : []; } catch { /* */ }
      const expected = q.correctAnswer.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const given = submitted.map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!expected.length) return null;
      const hits = expected.filter(e => given.includes(e)).length;
      const extra = given.filter(g => !expected.includes(g)).length;
      const correct = hits === expected.length && extra === 0;
      const ratio = hits / expected.length;
      const earned = correct ? q.points : Math.floor(q.points * ratio * (extra > 0 ? 0.7 : 1));
      return { ...base, earned, correct, feedback: correct ? '' : `Точни ставки: ${q.correctAnswer}` };
    }
    case 'section_header':
      return { ...base, maxPoints: 0, earned: 0, correct: true, feedback: '' };
    default:
      return null;
  }
}

export function needsAIGrade(q: DuggaQuestion): boolean {
  return q.type === 'essay'
    || q.type === 'geometry_construct'
    || q.type === 'feynman_explain'
    || q.type === 'proof_critique'
    || q.type === 'table_completion'
    || q.type === 'inline_select'
    || q.type === 'multi_part'
    || q.type === 'interactive_table'
    || q.type === 'diagram_annotate'
    || (q.type === 'short_answer' && !q.correctAnswer);
}

/**
 * True when `autoScore()` returns null because the question is *structurally*
 * ungradeable — the author never filled in the answer key (correctIds,
 * orderItems, matchPairs, expectedTransform, etc.) — as opposed to
 * `needsAIGrade()`'s types, which are always sent to an AI grader regardless
 * of authoring completeness. AI grading can't help here either: there's no
 * answer key to grade against, so this genuinely needs a human teacher to
 * award points by hand.
 */
export function needsManualReview(q: DuggaQuestion): boolean {
  switch (q.type) {
    case 'checklist': return !(q.options ?? []).some(o => o.isCorrect);
    case 'fill_blanks': return !q.correctAnswer;
    case 'ordering': return !q.orderItems?.length;
    case 'multi_match': return !q.matchPairs?.length;
    case 'function_match': return !q.expectedTransform;
    case 'proof_steps': return !q.expectedProof?.steps?.length;
    case 'unit_circle_pick': return !q.expectedUnitCircle;
    case 'student_chart': return !q.expectedChart;
    case 'list_items': return !q.correctAnswer;
    default: return false;
  }
}

/**
 * Folds structural context (table data, options, row/column labels) into the
 * question text sent to AI grading, for types with no stored answer key
 * (`table_completion`, `interactive_table`, `inline_select`, `diagram_annotate`)
 * — without this, the AI grades blind against just `q.text`.
 */
export function buildAIGradingQuestionContext(q: DuggaQuestion): string {
  const parts = [q.text];
  if (q.type === 'table_completion' && q.tableHeaders?.length) {
    parts.push(`Заглавја на табелата: ${q.tableHeaders.join(' | ')}.`);
    if (q.tableRows?.length) {
      const rows = q.tableRows.map(row => `[${row.map(c => c || '(празно поле за пополнување)').join(', ')}]`).join('; ');
      parts.push(`Дадени редови на табелата (пресметај ги точните вредности за празните полиња од правилото искажано во прашањето): ${rows}.`);
    }
  }
  if (q.type === 'interactive_table' && q.tableHeaders?.length && q.tableRows?.length) {
    const rowLabels = q.tableRows.map(r => r[0] ?? '').join(', ');
    parts.push(`Колони: ${q.tableHeaders.join(' | ')}. Редови: ${rowLabels}. Учeникот одбележал точно/неточно комбинации со checkbox-и — оцени ги врз основа на изјавата во прашањето.`);
  }
  if (q.type === 'inline_select' && q.options?.length) {
    parts.push(`Достапни опции за избор: ${q.options.map(o => o.text).join(', ')}.`);
  }
  if (q.type === 'diagram_annotate' && q.imageUrl) {
    parts.push('Прашањето вклучува дијаграм/слика (не е достапна за AI); оцени го одговорот врз основа на тоа колку добро писмениот опис на ученикот одговара на она што прашањето го бара, со разумна толеранција бидејќи сликата не може да се провери директно.');
  }
  return parts.join('\n');
}

// Parses AI grade response text to extract earned points (e.g. "3/5" → 3)
export function parseAIEarnedPoints(gradeText: string, maxPoints: number): number {
  const match = gradeText.match(/(\d+)\s*\/\s*\d+/);
  return match ? Math.min(parseInt(match[1]), maxPoints) : 0;
}

// Convert percentage to Macedonian 5-point grade
export function percentageToMkGrade(pct: number): string {
  if (pct >= 90) return 'Одличен (5)';
  if (pct >= 75) return 'Многу добар (4)';
  if (pct >= 60) return 'Добар (3)';
  if (pct >= 50) return 'Задоволителен (2)';
  return 'Недоволен (1)';
}
