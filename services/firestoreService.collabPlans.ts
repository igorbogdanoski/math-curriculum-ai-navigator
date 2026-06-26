/**
 * Collab Plans — Firestore Service (S88-E)
 *
 * Enables teachers to share annual and thematic plans with colleagues.
 * Real-time collaboration via Firestore onSnapshot.
 *
 * Architecture:
 *   - Plans live in their original collection (academic_annual_plans / thematic_plan_edits)
 *   - Collab metadata stored in `collab_plans` collection
 *   - Viewers read the plan via onSnapshot; only one editor at a time (edit lock)
 *
 * Collection: collab_plans
 * Document ID: {planType}_{planId}
 */

import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, getDocs,
  serverTimestamp, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type CollabPlanType = 'annual' | 'thematic' | 'weekly';

export interface CollabPlan {
  id: string;
  planType: CollabPlanType;
  planId: string;
  ownerUid: string;
  ownerName: string;
  /** UIDs explicitly invited to collaborate */
  sharedWithUids: string[];
  /** true = anyone with the share link can view */
  publicLink: boolean;
  /** Short 6-char share token for the link */
  shareToken: string;
  /** Currently editing UID (null = nobody editing) */
  lockedByUid: string | null;
  lockedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

const COLLECTION = 'collab_plans';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min of inactivity releases lock

function makeId(planType: CollabPlanType, planId: string) {
  return `${planType}_${planId}`;
}

function generateToken(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Create or retrieve collab metadata for a plan */
export const ensureCollabPlan = async (
  planType: CollabPlanType,
  planId: string,
  ownerUid: string,
  ownerName: string,
): Promise<CollabPlan> => {
  const id = makeId(planType, planId);
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as CollabPlan;

  const newDoc: Omit<CollabPlan, 'id'> = {
    planType,
    planId,
    ownerUid,
    ownerName,
    sharedWithUids: [],
    publicLink: false,
    shareToken: generateToken(),
    lockedByUid: null,
    lockedAt: null,
    updatedAt: null,
  };
  await setDoc(ref, newDoc);
  return { id, ...newDoc };
};

/** Invite a colleague by UID */
export const inviteCollaborator = async (
  planType: CollabPlanType,
  planId: string,
  inviteeUid: string,
): Promise<void> => {
  const id = makeId(planType, planId);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return;
  const current: string[] = snap.data().sharedWithUids ?? [];
  if (current.includes(inviteeUid)) return;
  await updateDoc(doc(db, COLLECTION, id), {
    sharedWithUids: [...current, inviteeUid],
    updatedAt: serverTimestamp(),
  });
};

/** Toggle public link sharing */
export const setPublicLink = async (
  planType: CollabPlanType,
  planId: string,
  enabled: boolean,
): Promise<void> => {
  const id = makeId(planType, planId);
  await updateDoc(doc(db, COLLECTION, id), {
    publicLink: enabled,
    updatedAt: serverTimestamp(),
  });
};

/** Acquire edit lock — returns false if already locked by someone else */
export const acquireEditLock = async (
  planType: CollabPlanType,
  planId: string,
  uid: string,
): Promise<boolean> => {
  const id = makeId(planType, planId);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return false;
  const data = snap.data() as CollabPlan;

  // Check if lock is stale (> 5 min old)
  const isStale = data.lockedByUid && data.lockedAt
    ? Date.now() - (data.lockedAt as unknown as { toMillis(): number }).toMillis() > LOCK_TIMEOUT_MS
    : true;

  if (data.lockedByUid && data.lockedByUid !== uid && !isStale) return false;

  await updateDoc(doc(db, COLLECTION, id), {
    lockedByUid: uid,
    lockedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return true;
};

/** Release edit lock */
export const releaseEditLock = async (
  planType: CollabPlanType,
  planId: string,
  uid: string,
): Promise<void> => {
  const id = makeId(planType, planId);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return;
  if (snap.data().lockedByUid !== uid) return;
  await updateDoc(doc(db, COLLECTION, id), {
    lockedByUid: null,
    lockedAt: null,
    updatedAt: serverTimestamp(),
  });
};

/** Subscribe to collab metadata changes */
export const subscribeCollabPlan = (
  planType: CollabPlanType,
  planId: string,
  onUpdate: (plan: CollabPlan | null) => void,
): Unsubscribe => {
  const id = makeId(planType, planId);
  return onSnapshot(doc(db, COLLECTION, id), snap => {
    onUpdate(snap.exists() ? ({ id: snap.id, ...snap.data() } as CollabPlan) : null);
  });
};

/** Fetch all collab plans shared with a user */
export const fetchSharedWithMe = async (uid: string): Promise<CollabPlan[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('sharedWithUids', 'array-contains', uid))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabPlan));
};

/** Look up collab plan by share token (for public link join) */
export const findByShareToken = async (token: string): Promise<CollabPlan | null> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('shareToken', '==', token),
      where('publicLink', '==', true),
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as CollabPlan;
};
