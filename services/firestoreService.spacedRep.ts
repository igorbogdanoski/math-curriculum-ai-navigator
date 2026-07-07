import { logger } from '../utils/logger';
/**
 * Firestore service for SM-2 Spaced Repetition data.
 *
 * Collection: `spaced_rep`
 * Document ID: `{studentId}_{conceptId}`
 *
 * Called from:
 *  - StudentPlayView (after quiz completion) → updateSpacedRepRecord
 *  - StudentProgressView (on mount) → fetchSpacedRepRecords
 *
 * Academy SM-2 teacher cards:
 * Collection: `academy_sm2`
 * Document ID: `{userId}`
 * Field: `cards: SM2Card[]`
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
import type { SM2Card } from '../utils/sm2';
import { membershipKey } from '../utils/studentIdentity';

const COLLECTION = 'spaced_rep';

/**
 * Composite document ID: prevents collisions across students. `studentId` is device-bound,
 * not person-bound — two students sharing one device would collide on the same doc without
 * folding `studentName` in (same membershipKey pattern used for class_memberships/concept_mastery).
 * The stored `studentId` FIELD (not the doc id) stays the raw device id either way, so
 * `fetchSpacedRepRecords`'s field-based query is unaffected by this change.
 */
const docId = (studentId: string, conceptId: string, studentName?: string) =>
  studentName ? `${membershipKey(studentId, studentName)}_${conceptId}` : `${studentId}_${conceptId}`;

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
  studentName?: string,
): Promise<void> {
  if (!studentId || !conceptId) return;

  const ref = doc(db, COLLECTION, docId(studentId, conceptId, studentName));
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const queueOffline = async () => {
    try {
      const { saveSpacedRepOffline } = await import('./indexedDBService');
      await saveSpacedRepOffline({ studentId, conceptId, percentage, studentName });
    } catch (e) {
      logger.error('[spacedRep] Failed to queue offline record:', e);
    }
  };

  // Load existing record or create fresh one — falling back to the legacy bare-studentId
  // doc (pre-fix data) for continuity on this student's first review after the fix.
  let record: SpacedRepRecord;
  try {
    let snap = await getDoc(ref);
    if (!snap.exists() && studentName) {
      const legacySnap = await getDoc(doc(db, COLLECTION, docId(studentId, conceptId)));
      if (legacySnap.exists()) snap = legacySnap;
    }
    record = snap.exists()
      ? (snap.data() as SpacedRepRecord)
      : createInitialRecord(studentId, conceptId);
  } catch {
    record = createInitialRecord(studentId, conceptId);
    if (!isOnline) await queueOffline();
  }

  const updated = updateRecordAfterReview(record, percentage);

  if (!isOnline) {
    await queueOffline();
    return;
  }
  // Best-effort write; queue for later replay if it fails despite believing we're online
  // (network dropped mid-request, or Firestore's own retry gave up).
  setDoc(ref, updated, { merge: true }).catch((e) => {
    logger.warn('[spacedRep] Failed to save record, queueing offline:', e);
    void queueOffline();
  });
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
    logger.warn('[spacedRep] Failed to fetch records:', e);
    return [];
  }
}

/**
 * Fetches a single SM-2 record. Returns null if not yet seen.
 */
export async function fetchSpacedRepRecord(
  studentId: string,
  conceptId: string,
  studentName?: string,
): Promise<SpacedRepRecord | null> {
  if (!studentId || !conceptId) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, docId(studentId, conceptId, studentName)));
    if (snap.exists()) return snap.data() as SpacedRepRecord;
    if (studentName) {
      const legacySnap = await getDoc(doc(db, COLLECTION, docId(studentId, conceptId)));
      if (legacySnap.exists()) return legacySnap.data() as SpacedRepRecord;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Replays queued offline SM-2 updates one at a time through updateSpacedRepRecord itself
 * (not batch-committed) — each review is a stateful read-modify-write against the SM-2
 * interval/repetitions state, so replay order and reading the then-current doc both matter.
 */
export async function syncOfflineSpacedRep(): Promise<number> {
  try {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) return 0;
    const { getPendingSpacedRep, clearPendingSpacedRep } = await import('./indexedDBService');
    const pending = await getPendingSpacedRep();
    if (pending.length === 0) return 0;

    let synced = 0;
    for (const item of pending) {
      try {
        await updateSpacedRepRecord(item.studentId, item.conceptId, item.percentage, item.studentName);
        await clearPendingSpacedRep(item.id);
        synced++;
      } catch (err) {
        logger.warn(`[spacedRep] Failed to sync offline record ${item.id}:`, err);
      }
    }
    return synced;
  } catch (err) {
    logger.warn('[spacedRep] Sync error:', err);
    return 0;
  }
}

export const spacedRepService = {
  updateSpacedRepRecord,
  fetchSpacedRepRecords,
  fetchSpacedRepRecord,
  syncOfflineSpacedRep,
};

// ── Academy SM-2 teacher cards ────────────────────────────────────────────────

const ACADEMY_SM2_COLLECTION = 'academy_sm2';

/**
 * Loads all SM-2 cards for a teacher from Firestore.
 * Returns [] on error or when no data exists.
 */
export async function loadAcademySM2Cards(userId: string): Promise<SM2Card[]> {
  if (!userId) return [];
  try {
    const snap = await getDoc(doc(db, ACADEMY_SM2_COLLECTION, userId));
    if (!snap.exists()) return [];
    const data = snap.data();
    const cards = data?.cards;
    if (!Array.isArray(cards)) return [];
    return cards.filter(
      (item): item is SM2Card =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.lessonId === 'string' &&
        typeof item.ef === 'number' &&
        typeof item.interval === 'number' &&
        typeof item.repetitions === 'number' &&
        typeof item.nextReview === 'string',
    );
  } catch (e) {
    logger.warn('[academySM2] Failed to load cards:', e);
    return [];
  }
}

/**
 * Persists all academy SM-2 cards for a teacher (fire-and-forget).
 */
export function saveAcademySM2Cards(userId: string, cards: SM2Card[]): void {
  if (!userId) return;
  setDoc(doc(db, ACADEMY_SM2_COLLECTION, userId), { cards }).catch((e) =>
    logger.warn('[academySM2] Failed to save cards:', e),
  );
}

/**
 * Merges two SM-2 card arrays. For each lessonId, keeps the card with the
 * more recent lastReview (or higher repetitions if lastReview is absent).
 */
export function mergeAcademySM2Cards(local: SM2Card[], remote: SM2Card[]): SM2Card[] {
  const map = new Map<string, SM2Card>();
  for (const card of local) map.set(card.lessonId, card);
  for (const card of remote) {
    const existing = map.get(card.lessonId);
    if (!existing) {
      map.set(card.lessonId, card);
      continue;
    }
    const existingDate = existing.lastReview ?? '1970-01-01';
    const cardDate = card.lastReview ?? '1970-01-01';
    if (cardDate > existingDate || (cardDate === existingDate && card.repetitions > existing.repetitions)) {
      map.set(card.lessonId, card);
    }
  }
  return Array.from(map.values());
}
