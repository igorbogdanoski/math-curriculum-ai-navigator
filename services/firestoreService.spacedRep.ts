/**
 * Firestore service for SM-2 Spaced Repetition data.
 *
 * Collection: `spaced_rep`
 * Document ID: `{studentId}_{conceptId}`
 *
 * Called from:
 *  - StudentPlayView (after quiz completion) → updateSpacedRepRecord
 *  - StudentProgressView (on mount) → fetchSpacedRepRecords
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  type SpacedRepRecord,
  createInitialRecord,
  updateRecordAfterReview,
} from '../utils/spacedRepetition';

const COLLECTION = 'spaced_rep';

/** Composite document ID: prevents collisions across students. */
const docId = (studentId: string, conceptId: string) =>
  `${studentId}_${conceptId}`;

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Updates (or creates) the SM-2 record after a quiz attempt.
 *
 * @param studentId   Anonymous device ID or auth UID
 * @param conceptId   The concept that was quizzed
 * @param percentage  Quiz score 0–100
 */
export async function updateSpacedRepRecord(
  studentId: string,
  conceptId: string,
  percentage: number,
): Promise<void> {
  if (!studentId || !conceptId) return;

  const ref = doc(db, COLLECTION, docId(studentId, conceptId));

  // Load existing record or create fresh one
  let record: SpacedRepRecord;
  try {
    const snap = await getDoc(ref);
    record = snap.exists()
      ? (snap.data() as SpacedRepRecord)
      : createInitialRecord(studentId, conceptId);
  } catch {
    record = createInitialRecord(studentId, conceptId);
  }

  const updated = updateRecordAfterReview(record, percentage);

  // Fire-and-forget (same pattern as gamification saves in firestoreService.quiz.ts)
  setDoc(ref, updated, { merge: true }).catch((e) =>
    console.warn('[spacedRep] Failed to save record:', e),
  );
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetches all SM-2 records for a student.
 * Used by StudentProgressView to determine which concepts are due for review.
 *
 * @param studentId  Anonymous device ID or auth UID
 */
export async function fetchSpacedRepRecords(
  studentId: string,
): Promise<SpacedRepRecord[]> {
  if (!studentId) return [];

  try {
    const q = query(
      collection(db, COLLECTION),
      where('studentId', '==', studentId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SpacedRepRecord);
  } catch (e) {
    console.warn('[spacedRep] Failed to fetch records:', e);
    return [];
  }
}

/**
 * Fetches a single SM-2 record. Returns null if not yet seen.
 */
export async function fetchSpacedRepRecord(
  studentId: string,
  conceptId: string,
): Promise<SpacedRepRecord | null> {
  if (!studentId || !conceptId) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, docId(studentId, conceptId)));
    return snap.exists() ? (snap.data() as SpacedRepRecord) : null;
  } catch {
    return null;
  }
}

export const spacedRepService = {
  updateSpacedRepRecord,
  fetchSpacedRepRecords,
  fetchSpacedRepRecord,
};
