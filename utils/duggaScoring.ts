import type { DuggaQuestion } from '../services/firestoreService.dugga';
import { gradeStudentChart, parseStudentChart } from './duggaChartGrading';
import { gradeFunctionMatch, parseFunctionMatch } from './duggaFunctionMatchGrading';
import { gradeUnitCirclePick, parseUnitCirclePick } from './duggaUnitCirclePickGrading';

export interface QResult {
  earned: number;
  maxPoints: number;
  correct: boolean | null; // null = AI / manual review needed
  feedback: string;
  aiGrade?: string;
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
      const selected = answer ? answer.split(',').filter(Boolean) : [];
      const correctIds = (q.options ?? []).filter(o => o.isCorrect).map(o => o.id);
      if (!correctIds.length) return null;
      const allCorrect = correctIds.length === selected.length && correctIds.every(id => selected.includes(id));
      const hits = selected.filter(id => correctIds.includes(id)).length;
      const wrong = selected.filter(id => !correctIds.includes(id)).length;
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
      const correct = answer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
      return { ...base, earned: correct ? q.points : 0, correct, feedback: correct ? '' : `Точен: ${q.correctAnswer}` };
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
    case 'section_header':
      return { ...base, maxPoints: 0, earned: 0, correct: true, feedback: '' };
    default:
      return null;
  }
}

export function needsAIGrade(q: DuggaQuestion): boolean {
  return q.type === 'essay' || (q.type === 'short_answer' && !q.correctAnswer);
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
