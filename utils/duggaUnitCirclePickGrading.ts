/**
 * S61-C3 — Pure grading helper for `unit_circle_pick` questions.
 *
 * The student is shown a unit circle and asked to identify the angle (in
 * degrees or radians) and/or the (x, y) coordinates that match a given
 * trigonometric prompt. Submission is JSON `{ angle?, x?, y? }`.
 *
 * Score breakdown (out of 1.0):
 *   • match='angle' — full credit when angle is within tolerance (modular).
 *   • match='point' — full credit when (x, y) are both within tolerance.
 *   • match='either' (default) — whichever side passes; partial credit if
 *     only one of the two is provided & correct.
 */
import type { DuggaExpectedUnitCirclePick } from '../services/firestoreService.dugga';

export interface UnitCirclePickSubmission {
  angle?: number | string;
  x?: number | string;
  y?: number | string;
}

export interface UnitCirclePickGradeResult {
  score: number;
  feedback: string;
  details: {
    angleMatch: boolean;
    pointMatch: boolean;
  };
}

export function parseUnitCirclePick(answer: string): UnitCirclePickSubmission | undefined {
  if (!answer || !answer.trim()) return undefined;
  try {
    const parsed = JSON.parse(answer);
    if (parsed && typeof parsed === 'object') return parsed as UnitCirclePickSubmission;
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

/** Reduce an angle into [-period/2, period/2] for modular comparison. */
function normalizeAngle(value: number, period: number): number {
  const wrapped = ((value % period) + period) % period;
  return wrapped > period / 2 ? wrapped - period : wrapped;
}

function expectedPoint(expected: DuggaExpectedUnitCirclePick): { x: number; y: number } {
  if (expected.point) return expected.point;
  const rad = expected.unit === 'deg' ? (expected.angle * Math.PI) / 180 : expected.angle;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

export function gradeUnitCirclePick(
  expected: DuggaExpectedUnitCirclePick,
  submitted: UnitCirclePickSubmission | undefined,
  tolerance: number = 0.05,
): UnitCirclePickGradeResult {
  const tol = Math.max(0, tolerance) + 1e-9;

  if (!submitted) {
    return {
      score: 0,
      feedback: 'Не е поднесена точка/агол.',
      details: { angleMatch: false, pointMatch: false },
    };
  }

  const subAngle = toNum(submitted.angle);
  const subX = toNum(submitted.x);
  const subY = toNum(submitted.y);

  // ── Angle check (modular) ─────────────────────────────────────────────────
  let angleMatch = false;
  if (subAngle !== undefined) {
    const period = expected.unit === 'deg' ? 360 : 2 * Math.PI;
    const diff = normalizeAngle(subAngle - expected.angle, period);
    angleMatch = Math.abs(diff) <= tol;
  }

  // ── Point check ───────────────────────────────────────────────────────────
  let pointMatch = false;
  if (subX !== undefined && subY !== undefined) {
    const target = expectedPoint(expected);
    pointMatch = Math.abs(subX - target.x) <= tol && Math.abs(subY - target.y) <= tol;
  }

  const mode = expected.match ?? 'either';
  let score = 0;
  if (mode === 'angle') {
    score = angleMatch ? 1 : 0;
  } else if (mode === 'point') {
    score = pointMatch ? 1 : 0;
  } else {
    // 'either': full credit if either side matches; both correct also full.
    if (angleMatch || pointMatch) score = 1;
  }

  const fb: string[] = [];
  if (mode !== 'point' && !angleMatch && subAngle !== undefined) {
    fb.push(`Очекуван агол: ${expected.angle}${expected.unit === 'deg' ? '°' : ' rad'}.`);
  }
  if (mode !== 'angle' && !pointMatch && (subX !== undefined || subY !== undefined)) {
    const t = expectedPoint(expected);
    fb.push(`Очекувана точка: (${t.x.toFixed(3)}, ${t.y.toFixed(3)}).`);
  }
  if (score === 1) fb.length = 0;
  if (score === 1) fb.push('Точно. Браво!');
  if (fb.length === 0) fb.push('Не е поднесена точка/агол.');

  return { score, feedback: fb.join(' '), details: { angleMatch, pointMatch } };
}
