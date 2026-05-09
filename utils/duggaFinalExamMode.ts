/**
 * S61-E1 — Resolves the effective final-exam settings for a Дига test.
 *
 * `DuggaTest.finalExamMode === true` flips a number of behaviours on by
 * default (shuffle questions/options, disable hints, lock session). Each of
 * those can still be overridden per-test by setting the relevant boolean
 * explicitly. This helper centralises the resolution so the player and
 * builder views never duplicate the truth-table.
 */
import type { DuggaTest } from '../services/firestoreService.dugga';

export interface ResolvedExamMode {
  finalExam: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  disableHints: boolean;
  /** Tamper-evident seal must be computed for submissions. */
  sealSubmission: boolean;
  /** Visibility pause should be enforced (no tab-switching). */
  pauseOnHidden: boolean;
}

export function resolveExamMode(test: Pick<DuggaTest,
  'finalExamMode' | 'shuffleQuestions' | 'shuffleOptions' | 'disableHints'
>): ResolvedExamMode {
  const finalExam = test.finalExamMode === true;
  return {
    finalExam,
    shuffleQuestions: test.shuffleQuestions ?? finalExam,
    shuffleOptions: test.shuffleOptions ?? finalExam,
    disableHints: test.disableHints ?? finalExam,
    sealSubmission: finalExam,
    pauseOnHidden: finalExam,
  };
}

/**
 * Whether the exam is currently within its open/close window. Returns true
 * if no window is configured.
 */
export function isWithinExamWindow(
  test: Pick<DuggaTest, 'finalExamOpensAt' | 'finalExamClosesAt'>,
  now: Date = new Date(),
): boolean {
  const t = now.getTime();
  const open = parseTimestampLike(test.finalExamOpensAt);
  const close = parseTimestampLike(test.finalExamClosesAt);
  if (open !== undefined && t < open) return false;
  if (close !== undefined && t > close) return false;
  return true;
}

function parseTimestampLike(v: unknown): number | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : undefined;
  }
  // Firestore Timestamp duck-type
  if (typeof v === 'object' && v !== null && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    try { return (v as { toMillis: () => number }).toMillis(); } catch { return undefined; }
  }
  if (typeof v === 'object' && v !== null && typeof (v as { seconds?: number }).seconds === 'number') {
    return (v as { seconds: number }).seconds * 1000;
  }
  return undefined;
}
