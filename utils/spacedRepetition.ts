/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on the SuperMemo SM-2 algorithm (Wozniak, 1987).
 * Used for scheduling concept review sessions to combat the forgetting curve.
 *
 * Педагошка основа: Ebbinghaus Forgetting Curve (d=0.71 Hattie meta-analysis).
 *
 * Data model stored in Firestore: `spaced_rep/{studentId}_{conceptId}`
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpacedRepRecord {
  studentId: string;       // anonymous device ID or auth UID
  conceptId: string;
  /** SM-2 ease factor (starts at 2.5, min 1.3) */
  easeFactor: number;
  /** Days until next review */
  interval: number;
  /** Number of successful consecutive reviews */
  repetitions: number;
  /** ISO string — when to show this concept again */
  nextReviewDate: string;
  /** ISO string — last time this was reviewed */
  lastReviewedAt: string;
}

/** Quality of recall: 0–5 (SM-2 standard scale) */
export type RecallQuality = 0 | 1 | 2 | 3 | 4 | 5;

// ── Quality mapping from quiz percentage ─────────────────────────────────────

/**
 * Maps a quiz percentage score to SM-2 recall quality (0–5).
 *
 * SM-2 convention:
 *   5 = perfect response
 *   4 = correct with hesitation
 *   3 = correct with serious difficulty
 *   2 = incorrect, but upon seeing the answer it seemed easy
 *   1 = incorrect, but the correct answer was remembered
 *   0 = complete blackout
 */
export function percentageToQuality(percentage: number): RecallQuality {
  if (percentage >= 90) return 5;
  if (percentage >= 75) return 4;
  if (percentage >= 60) return 3;
  if (percentage >= 45) return 2;
  if (percentage >= 25) return 1;
  return 0;
}

// ── Core SM-2 calculation ─────────────────────────────────────────────────────

interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
}

/**
 * Computes the next SM-2 interval, ease factor, and repetition count.
 *
 * @param current  Current record values (or defaults for first review)
 * @param quality  Recall quality 0–5
 */
export function calcNextSM2(
  current: Pick<SpacedRepRecord, 'easeFactor' | 'interval' | 'repetitions'>,
  quality: RecallQuality,
): SM2Result {
  let { easeFactor, interval, repetitions } = current;

  if (quality >= 3) {
    // Successful recall
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Failed recall — reset to beginning
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor (SM-2 formula)
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // Minimum ease factor is 1.3 (prevents interval from stagnating)
  if (easeFactor < 1.3) easeFactor = 1.3;

  return { easeFactor, interval, repetitions };
}

// ── Public API ────────────────────────────────────────────────────────────────

const DEFAULT_EASE = 2.5;

/**
 * Creates an initial SM-2 record for a concept not yet seen.
 */
export function createInitialRecord(
  studentId: string,
  conceptId: string,
): SpacedRepRecord {
  const now = new Date().toISOString();
  return {
    studentId,
    conceptId,
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now, // Due immediately (not yet seen)
    lastReviewedAt: now,
  };
}

/**
 * Updates an existing SM-2 record after a quiz attempt.
 *
 * @param record      Existing Firestore record (or initial record)
 * @param percentage  Quiz score 0–100
 * @returns           Updated record ready to save back to Firestore
 */
export function updateRecordAfterReview(
  record: SpacedRepRecord,
  percentage: number,
): SpacedRepRecord {
  const quality = percentageToQuality(percentage);
  const { easeFactor, interval, repetitions } = calcNextSM2(record, quality);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...record,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextReview.toISOString(),
    lastReviewedAt: new Date().toISOString(),
  };
}

/**
 * Returns true if a concept is due for review today or earlier.
 */
export function isDueForReview(record: SpacedRepRecord): boolean {
  return new Date(record.nextReviewDate) <= new Date();
}

/**
 * Returns a human-readable label for how soon the next review is.
 * e.g. "Денес", "Утре", "За 5 дена", "За 3 недели"
 */
export function getNextReviewLabel(record: SpacedRepRecord): string {
  const now = new Date();
  const next = new Date(record.nextReviewDate);
  const diffDays = Math.round((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Денес';
  if (diffDays === 1) return 'Утре';
  if (diffDays < 7) return `За ${diffDays} дена`;
  if (diffDays < 14) return 'За 1 недела';
  const weeks = Math.round(diffDays / 7);
  return `За ${weeks} недели`;
}

/**
 * Sorts concepts by urgency: overdue first, then soonest due.
 * Use this to build the "due today" review queue.
 */
export function sortByReviewUrgency(records: SpacedRepRecord[]): SpacedRepRecord[] {
  return [...records].sort(
    (a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime(),
  );
}
