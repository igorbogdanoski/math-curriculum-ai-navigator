/**
 * Academy Badges Service
 *
 * Public summary of which Academy specializations a teacher has completed —
 * denormalized off `users/{uid}/academy/progress` (which is self-only, since
 * it also holds free-text reflections). Only specialization IDs live here,
 * nothing else, so it's safe to be broadly readable.
 *
 * Firestore path: academy_badges/{uid}
 * Security rules: read = any authenticated user; write = own document only
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface AcademyBadgeDoc {
  completedSpecializationIds: string[];
  updatedAt: unknown; // Firestore Timestamp
}

export const academyBadgesService = {

  /**
   * Overwrites the teacher's badge summary with the full, authoritative list
   * of completed specialization ids computed client-side.
   */
  setOwnBadges: async (uid: string, completedSpecializationIds: string[]): Promise<void> => {
    const ref = doc(db, 'academy_badges', uid);
    await setDoc(ref, { completedSpecializationIds, updatedAt: serverTimestamp() });
  },

  /**
   * Fetch any teacher's completed specialization ids. Never throws —
   * a missing doc (no badges yet) or any read error both resolve to [].
   */
  getBadges: async (uid: string): Promise<string[]> => {
    try {
      const snap = await getDoc(doc(db, 'academy_badges', uid));
      if (!snap.exists()) return [];
      const data = snap.data() as Partial<AcademyBadgeDoc>;
      return data.completedSpecializationIds ?? [];
    } catch {
      return [];
    }
  },
};
