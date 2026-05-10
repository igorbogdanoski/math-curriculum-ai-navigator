/**
 * S61-C2 / S62-E2 — Pure grading helper for `function_match` questions.
 *
 * The student is shown a target curve (built from a hidden `target` set of
 * a/b/c/d transform parameters applied to a base function) and must adjust
 * their own sliders to reproduce it. Submission is the JSON serialised params;
 * we score per-parameter within an absolute tolerance.
 *
 * S62-E2: extraParams (base, n) for logBase/expBase/polyN are scored as
 * additional parameters so total hits can be 4 (abcd only) or 5 (abcd+base/n).
 */
import type { DuggaExpectedTransform } from '../services/firestoreService.dugga';

export interface FunctionMatchSubmission {
  a?: number | string;
  b?: number | string;
  c?: number | string;
  d?: number | string;
  base?: number | string;
  n?: number | string;
}

export interface FunctionMatchGradeResult {
  score: number;       // 0..1
  feedback: string;
  details: {
    matched: { a: boolean; b: boolean; c: boolean; d: boolean; base?: boolean; n?: boolean };
    /** Number of parameters within tolerance (max 4 or 5 depending on extraParams). */
    hits: number;
    total: number;
  };
}

export function parseFunctionMatch(answer: string): FunctionMatchSubmission | undefined {
  if (!answer || !answer.trim()) return undefined;
  try {
    const parsed = JSON.parse(answer);
    if (parsed && typeof parsed === 'object') return parsed as FunctionMatchSubmission;
  } catch { /* fallthrough */ }
  return undefined;
}

function toNum(v: number | string | undefined): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Grade the student's submitted (a, b, c, d [, base, n]) against the target.
 * Each parameter contributes equally to the final score when within `tolerance`.
 * Default tolerance: 0.1.
 */
export function gradeFunctionMatch(
  expected: DuggaExpectedTransform,
  submitted: FunctionMatchSubmission | undefined,
  tolerance: number = 0.1,
): FunctionMatchGradeResult {
  // Tiny epsilon absorbs floating-point comparison drift.
  const tol = Math.max(0, tolerance) + 1e-9;

  const hasBase = expected.extraParams?.base !== undefined;
  const hasN    = expected.extraParams?.n    !== undefined;
  const total   = 4 + (hasBase ? 1 : 0) + (hasN ? 1 : 0);

  if (!submitted) {
    return {
      score: 0,
      feedback: 'Не е поднесена параметризација.',
      details: { matched: { a: false, b: false, c: false, d: false }, hits: 0, total },
    };
  }

  const a    = toNum(submitted.a);
  const b    = toNum(submitted.b);
  const c    = toNum(submitted.c);
  const d    = toNum(submitted.d);
  const base = toNum(submitted.base);
  const n    = toNum(submitted.n);

  const matched: FunctionMatchGradeResult['details']['matched'] = {
    a: a !== undefined && Math.abs(a - expected.target.a) <= tol,
    b: b !== undefined && Math.abs(b - expected.target.b) <= tol,
    c: c !== undefined && Math.abs(c - expected.target.c) <= tol,
    d: d !== undefined && Math.abs(d - expected.target.d) <= tol,
  };

  if (hasBase) {
    matched.base = base !== undefined && Math.abs(base - expected.extraParams!.base!) <= tol;
  }
  if (hasN) {
    matched.n = n !== undefined && Math.abs(n - expected.extraParams!.n!) <= tol;
  }

  const hits = Object.values(matched).filter(Boolean).length;
  const score = hits / total;

  const wrong: string[] = [];
  if (!matched.a) wrong.push(`a=${expected.target.a}`);
  if (!matched.b) wrong.push(`b=${expected.target.b}`);
  if (!matched.c) wrong.push(`c=${expected.target.c}`);
  if (!matched.d) wrong.push(`d=${expected.target.d}`);
  if (hasBase && !matched.base) wrong.push(`основа=${expected.extraParams!.base}`);
  if (hasN    && !matched.n)    wrong.push(`n=${expected.extraParams!.n}`);

  const feedback = wrong.length === 0
    ? 'Сите параметри се точни. Браво!'
    : `Очекувани вредности: ${wrong.join(', ')}.`;

  return { score, feedback, details: { matched, hits, total } };
}
