/**
 * S65 P3-B — Referrals service
 *
 * Collection: `referrals`
 * Document ID: `{newUserUid}` — guarantees one claim per signup.
 *
 * Schema:
 *   {
 *     refCode:        string  // referring teacher UID
 *     newUserUid:     string  // recipient of starter credits
 *     createdAt:      Timestamp
 *     bonusGranted:   boolean // true once the back-end / Cloud Function has
 *                             // credited the referring teacher with +10 AI credits
 *   }
 *
 * Crediting the referring teacher is performed by a Cloud Function trigger
 * (out of scope here for security — clients cannot mutate
 * `users/{uid}.aiCreditsBalance` directly per Firestore rules). This module
 * only writes the claim record.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COLLECTION = 'referrals';

export interface ReferralClaim {
  refCode: string;
  newUserUid: string;
  bonusGranted: boolean;
  createdAt?: any;
}

/**
 * Records a referral claim for a brand-new user. No-op if:
 *  - refCode equals the new user's own UID (self-referral),
 *  - a claim document already exists for this user.
 *
 * Throws are swallowed and logged — referral failure must never block signup.
 */
export async function claimReferralIfPresent(
  newUserUid: string,
  refCode: string,
): Promise<boolean> {
  if (!newUserUid || !refCode) return false;
  if (refCode === newUserUid) return false;

  try {
    const ref = doc(db, COLLECTION, newUserUid);
    const existing = await getDoc(ref);
    if (existing.exists()) return false;

    const payload: ReferralClaim = {
      refCode,
      newUserUid,
      bonusGranted: false,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return true;
  } catch (e) {
    try { console.warn('[referrals] claim failed:', e); } catch { /* noop */ }
    return false;
  }
}

/**
 * Reads an existing claim (used by Settings to show "Your referrer" status).
 */
export async function fetchReferralClaim(
  newUserUid: string,
): Promise<ReferralClaim | null> {
  if (!newUserUid) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, newUserUid));
    return snap.exists() ? (snap.data() as ReferralClaim) : null;
  } catch {
    return null;
  }
}

export const referralsService = {
  claimReferralIfPresent,
  fetchReferralClaim,
};
