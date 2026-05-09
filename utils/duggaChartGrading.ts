/**
 * S61-C1 — Pure grading helper for `student_chart` questions.
 *
 * Compares the student's submitted chart (parsed from `answer` JSON) against
 * the expected dataset stored on the question. Returns a 0-1 score that can
 * be multiplied by `points` to obtain partial credit.
 */
import type { DuggaExpectedChart } from '../services/firestoreService.dugga';

export interface StudentChartSubmission {
  kind?: 'bar' | 'line' | 'scatter' | 'pie';
  xLabel?: string;
  yLabel?: string;
  data?: Array<{ x: string | number; y: number | string }>;
}

export interface ChartGradeResult {
  /** Fractional score in [0, 1]. */
  score: number;
  /** Human-readable feedback in Macedonian. */
  feedback: string;
  /** Per-axis subscores for diagnostics. */
  details: {
    kindMatch: boolean;
    labelMatch: boolean;
    pointHits: number;
    pointTotal: number;
  };
}

/** Parse a JSON string answer; return undefined on failure. */
export function parseStudentChart(answer: string): StudentChartSubmission | undefined {
  if (!answer || !answer.trim()) return undefined;
  try {
    const parsed = JSON.parse(answer);
    if (parsed && typeof parsed === 'object') return parsed as StudentChartSubmission;
  } catch { /* fallthrough */ }
  return undefined;
}

function normalizeLabel(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
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
 * Grade a student-submitted chart against an expected dataset.
 *
 * Tolerance is a percentage (e.g. `5` means ±5% of the y-range, with a
 * minimum absolute tolerance of 1e-6 for tiny ranges).
 *
 * Score breakdown (out of 1.0):
 *   • 0.20 — chart kind matches
 *   • 0.20 — axis labels both match (case-insensitive trim)
 *   • 0.60 — proportion of expected (x, y) pairs hit within tolerance
 */
export function gradeStudentChart(
  expected: DuggaExpectedChart,
  submitted: StudentChartSubmission | undefined,
  tolerancePct: number = 5,
): ChartGradeResult {
  const tol = Math.max(0, tolerancePct) / 100;
  const expectedData = expected.data ?? [];
  const submittedData = submitted?.data ?? [];

  if (!submitted || expectedData.length === 0) {
    return {
      score: 0,
      feedback: 'Не е поднесен дијаграм или нема податоци за споредба.',
      details: { kindMatch: false, labelMatch: false, pointHits: 0, pointTotal: expectedData.length },
    };
  }

  const kindMatch = (submitted.kind ?? '') === expected.kind;

  const xMatch = !expected.xLabel || normalizeLabel(submitted.xLabel) === normalizeLabel(expected.xLabel);
  const yMatch = !expected.yLabel || normalizeLabel(submitted.yLabel) === normalizeLabel(expected.yLabel);
  const labelMatch = xMatch && yMatch;

  // Compute y-range for tolerance scaling.
  const ys = expectedData.map(p => p.y).filter(n => Number.isFinite(n));
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yMax = ys.length ? Math.max(...ys) : 0;
  const yRange = Math.max(1e-6, yMax - yMin);
  const absTol = Math.max(1e-6, tol * yRange);

  let pointHits = 0;
  for (const ep of expectedData) {
    // Find a submitted point with matching x (string or numeric ~).
    const epXNum = toNum(ep.x);
    const match = submittedData.find(sp => {
      if (typeof ep.x === 'string') {
        return normalizeLabel(String(sp.x)) === normalizeLabel(ep.x);
      }
      const spXNum = toNum(sp.x);
      if (epXNum === undefined || spXNum === undefined) return false;
      return Math.abs(spXNum - epXNum) <= Math.max(1e-6, tol * Math.abs(epXNum || 1));
    });
    if (!match) continue;
    const spY = toNum(match.y);
    if (spY === undefined) continue;
    if (Math.abs(spY - ep.y) <= absTol) pointHits++;
  }

  const pointScore = pointHits / Math.max(1, expectedData.length);
  const score = (kindMatch ? 0.2 : 0) + (labelMatch ? 0.2 : 0) + 0.6 * pointScore;

  const fb: string[] = [];
  if (!kindMatch) fb.push(`Очекуван тип на дијаграм: ${expected.kind}.`);
  if (!labelMatch) fb.push('Ознаките на оските не одговараат целосно.');
  if (pointHits < expectedData.length) fb.push(`Точно поставени точки: ${pointHits}/${expectedData.length}.`);
  if (fb.length === 0) fb.push('Дијаграмот е целосно точен. Браво!');

  return {
    score: Math.max(0, Math.min(1, score)),
    feedback: fb.join(' '),
    details: { kindMatch, labelMatch, pointHits, pointTotal: expectedData.length },
  };
}
