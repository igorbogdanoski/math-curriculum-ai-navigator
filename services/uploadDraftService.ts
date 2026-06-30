/**
 * services/uploadDraftService.ts — S106-Г
 *
 * Cloud draft sync for uploaded scenarios.
 * Replaces the sessionStorage bridge with a Firestore temp doc (TTL: 24h),
 * enabling cross-tab / cross-device continuation.
 *
 * Collection: scenario_upload_drafts/{uid}
 */

import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { LessonPlan } from '../types';

const COLLECTION = 'scenario_upload_drafts';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UploadDraftPayload {
  parsed: Partial<LessonPlan>;
  fileName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

/**
 * Saves an AI-parsed scenario draft to Firestore.
 * Overwrites any existing draft for the same user.
 */
export async function saveUploadDraft(
  uid: string,
  parsed: Partial<LessonPlan>,
  fileName: string,
): Promise<void> {
  const now = Date.now();
  const payload: UploadDraftPayload = {
    parsed,
    fileName,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + TTL_MS),
  };
  await setDoc(doc(db, COLLECTION, uid), payload);
}

/**
 * Loads and immediately deletes the upload draft for the given user.
 * Returns null if no valid (non-expired) draft exists.
 */
export async function loadAndClearUploadDraft(
  uid: string,
): Promise<{ parsed: Partial<LessonPlan>; fileName: string } | null> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as UploadDraftPayload;

  // Clean up immediately regardless of expiry
  await deleteDoc(ref);

  // Reject expired drafts
  if (data.expiresAt.toMillis() < Date.now()) return null;

  return { parsed: data.parsed, fileName: data.fileName };
}
