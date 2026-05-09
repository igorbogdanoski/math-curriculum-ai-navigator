/**
 * S61-C2 — Pure grading helper for `function_match` questions.
 *
 * The student is shown a target curve (built from a hidden `target` set of
 * a/b/c/d transform parameters applied to a base function) and must adjust
 * their own sliders to reproduce it. Submission is the JSON serialised
 * params; we score per-parameter within an absolute tolerance.
 */
import type { DuggaExpectedTransform } from '../services/firestoreService.dugga';

export interface FunctionMatchSubmission {
  a?: number | string;
  b?: number | string;
  c?: number | string;
  d?: number | string;
}

export interface FunctionMatchGradeResult {
  score: number;       // 0..1
  feedback: string;
  details: {
    matched: { a: boolean; b: boolean; c: boolean; d: boolean };
    /** Number of parameters within tolerance. */
    hits: number;
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
 * Grade the student's submitted (a, b, c, d) against the target. Each of
 * the four parameters contributes 0.25 to the final score when within
 * `tolerance`. Default tolerance: 0.1 (matches a typical 0.1 slider step).
 */
export function gradeFunctionMatch(
  expected: DuggaExpectedTransform,
  submitted: FunctionMatchSubmission | undefined,
  tolerance: number = 0.1,
): FunctionMatchGradeResult {
  // Add a tiny epsilon to absorb floating-point comparison drift (e.g.
  // |-1.1 - (-1)| evaluates to 0.10000000000000009).
  const tol = Math.max(0, tolerance) + 1e-9;

  if (!submitted) {
    return {
      score: 0,
      feedback: 'Не е поднесена параметризација.',
      details: {
        matched: { a: false, b: false, c: false, d: false },
        hits: 0,
      },
    };
  }

  const a = toNum(submitted.a);
  const b = toNum(submitted.b);
  const c = toNum(submitted.c);
  const d = toNum(submitted.d);

  const matched = {
    a: a !== undefined && Math.abs(a - expected.target.a) <= tol,
    b: b !== undefined && Math.abs(b - expected.target.b) <= tol,
    c: c !== undefined && Math.abs(c - expected.target.c) <= tol,
    d: d !== undefined && Math.abs(d - expected.target.d) <= tol,
  };

  const hits = Number(matched.a) + Number(matched.b) + Number(matched.c) + Number(matched.d);
  const score = hits / 4;

  const wrong: string[] = [];
  if (!matched.a) wrong.push(`a=${expected.target.a}`);
  if (!matched.b) wrong.push(`b=${expected.target.b}`);
  if (!matched.c) wrong.push(`c=${expected.target.c}`);
  if (!matched.d) wrong.push(`d=${expected.target.d}`);

  const feedback = wrong.length === 0
    ? 'Сите параметри се точни. Браво!'
    : `Очекувани вредности: ${wrong.join(', ')}.`;

  return { score, feedback, details: { matched, hits } };
}
