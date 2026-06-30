/**
 * services/uploadDraftService.ts — S106-Г / S108A-A2
 *
 * Cloud draft sync for uploaded scenarios.
 * Supports single-draft and batch-queue modes.
 * Collection: scenario_upload_drafts/{uid}
 */

import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { LessonPlan } from '../types';

const COLLECTION = 'scenario_upload_drafts';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface QueueItem {
  parsed: Partial<LessonPlan>;
  fileName: string;
}

interface DraftDoc {
  queue: QueueItem[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/**
 * Saves a single AI-parsed scenario draft to Firestore.
 * Overwrites any existing draft for the same user.
 */
export async function saveUploadDraft(
  uid: string,
  parsed: Partial<LessonPlan>,
  fileName: string,
): Promise<void> {
  return saveUploadDraftBatch(uid, [{ parsed, fileName }]);
}

/**
 * Saves multiple parsed scenarios as a queue.
 * First item will be loaded immediately on next editor open;
 * remaining stay in queue until consumed.
 */
export async function saveUploadDraftBatch(
  uid: string,
  items: QueueItem[],
): Promise<void> {
  if (items.length === 0) return;
  const now = Date.now();
  const payload: DraftDoc = {
    queue: items,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + TTL_MS),
  };
  await setDoc(doc(db, COLLECTION, uid), payload);
}

/**
 * Loads and removes the first draft from the queue.
 * Returns null if no valid (non-expired) draft exists.
 * `remaining` tells the caller how many more are waiting.
 */
export async function loadAndClearUploadDraft(
  uid: string,
): Promise<{ parsed: Partial<LessonPlan>; fileName: string; remaining: number } | null> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as DraftDoc;

  // Reject expired drafts
  if (data.expiresAt.toMillis() < Date.now()) {
    await deleteDoc(ref);
    return null;
  }

  // Queue format (primary)
  const queue = Array.isArray(data.queue) ? data.queue : [];
  if (queue.length === 0) {
    await deleteDoc(ref);
    return null;
  }

  const [first, ...rest] = queue;

  if (rest.length === 0) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { ...data, queue: rest });
  }

  return { parsed: first.parsed, fileName: first.fileName, remaining: rest.length };
}
