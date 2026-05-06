/**
 * firestoreService.maturaSpacedRep.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-question SM-2 spaced repetition for Matura (T3.1).
 *
 * Why a separate collection from `spaced_rep`?
 *   `spaced_rep` keys on `conceptId`, but Matura questions are the natural
 *   unit of review (each `examId + questionNumber` is independent). Keeping
 *   them apart preserves the Concept-level analytics surface untouched.
 *
 * Collection: `matura_spaced_rep`
 * Doc id:     `{uid}_{examId}_{questionNumber}`
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { logger } from '../utils/logger';
import {
  type SpacedRepRecord,
  calcNextSM2,
  isDueForReview,
  percentageToQuality,
} from '../utils/spacedRepetition';

const COLLECTION = 'matura_spaced_rep';

export interface MaturaSpacedRecord
  extends Pick<
    SpacedRepRecord,
    'easeFactor' | 'interval' | 'repetitions' | 'nextReviewDate' | 'lastReviewedAt'
  > {
  uid: string;
  examId: string;
  questionNumber: number;
  /** Last quiz percentage (0–100) used to update SM-2. */
  lastPct: number;
  /** Number of times the student has answered this matura question. */
  attempts: number;
  /** True once the student has answered correctly at least once. */
  everCorrect: boolean;
}

const docIdFor = (uid: string, examId: string, questionNumber: number): string =>
  `${uid}_${examId}_${questionNumber}`;

const DEFAULT_EASE = 2.5;

/** Pure helper — exposed for testing. Returns the next SM-2 record. */
export function computeNextRecord(
  prev: MaturaSpacedRecord | null,
  args: { uid: string; examId: string; questionNumber: number; pct: number; now?: Date },
): MaturaSpacedRecord {
  const now = args.now ?? new Date();
  const base: MaturaSpacedRecord = prev ?? {
    uid: args.uid,
    examId: args.examId,
    questionNumber: args.questionNumber,
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now.toISOString(),
    lastReviewedAt: now.toISOString(),
    lastPct: 0,
    attempts: 0,
    everCorrect: false,
  };

  const quality = percentageToQuality(args.pct);
  const { easeFactor, interval, repetitions } = calcNextSM2(base, quality);
  const nextReview = new Date(now.getTime());
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...base,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextReview.toISOString(),
    lastReviewedAt: now.toISOString(),
    lastPct: args.pct,
    attempts: base.attempts + 1,
    everCorrect: base.everCorrect || args.pct >= 75,
  };
}

/**
 * Records an attempt against a matura question and updates the SM-2 schedule.
 * Fire-and-forget: any Firestore error is logged but never thrown.
 */
export async function recordMaturaSpacedReview(
  uid: string,
  examId: string,
  questionNumber: number,
  percentage: number,
): Promise<void> {
  if (!uid || !examId || !Number.isFinite(questionNumber)) return;
  const ref = doc(db, COLLECTION, docIdFor(uid, examId, questionNumber));

  try {
    const snap = await getDoc(ref);
    const prev = snap.exists() ? (snap.data() as MaturaSpacedRecord) : null;
    const next = computeNextRecord(prev, {
      uid, examId, questionNumber, pct: percentage,
    });
    await setDoc(ref, next, { merge: true });
  } catch (e) {
    logger.warn('[maturaSpacedRep] recordMaturaSpacedReview failed', e);
  }
}

/** Fetch every matura SM-2 record belonging to a single user. */
export async function fetchMaturaSpacedRecords(uid: string): Promise<MaturaSpacedRecord[]> {
  if (!uid) return [];
  try {
    const q = query(collection(db, COLLECTION), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MaturaSpacedRecord);
  } catch (e) {
    logger.warn('[maturaSpacedRep] fetchMaturaSpacedRecords failed', e);
    return [];
  }
}

/** Returns the subset of records due for review (nextReviewDate <= now). */
export function dueRecords(
  records: MaturaSpacedRecord[],
  now: Date = new Date(),
): MaturaSpacedRecord[] {
  return records
    .filter((r) => isDueForReview({
      ...r,
      // SpacedRepRecord requires studentId/conceptId — synthesize.
      studentId: r.uid,
      conceptId: `${r.examId}_${r.questionNumber}`,
    }))
    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime())
    .filter((r) => new Date(r.nextReviewDate).getTime() <= now.getTime());
}

export const maturaSpacedRepService = {
  recordMaturaSpacedReview,
  fetchMaturaSpacedRecords,
  computeNextRecord,
  dueRecords,
};
