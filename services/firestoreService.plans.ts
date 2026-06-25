import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { AIGeneratedThematicPlan } from '../types';

/**
 * Saves teacher-edited thematic plan to Firestore so edits persist across sessions.
 * Collection: thematic_plan_edits / {uid}_{gradeId}_{topicId}
 */
export async function saveThematicPlanEdit(
  uid: string,
  gradeId: string,
  topicId: string,
  plan: AIGeneratedThematicPlan,
  meta: { authorName: string; schoolName: string; period: string },
): Promise<void> {
  const docId = `${uid}_${gradeId}_${topicId}`;
  await setDoc(doc(db, 'thematic_plan_edits', docId), {
    uid,
    gradeId,
    topicId,
    plan,
    authorName: meta.authorName,
    schoolName: meta.schoolName,
    period: meta.period,
    savedAt: serverTimestamp(),
  });
}

export interface ThematicPlanEditDoc {
  plan: AIGeneratedThematicPlan;
  authorName: string;
  schoolName: string;
  period: string;
}

export async function loadThematicPlanEdit(
  uid: string,
  gradeId: string,
  topicId: string,
): Promise<ThematicPlanEditDoc | null> {
  try {
    const docId = `${uid}_${gradeId}_${topicId}`;
    const snap = await getDoc(doc(db, 'thematic_plan_edits', docId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      plan: d.plan as AIGeneratedThematicPlan,
      authorName: d.authorName ?? '',
      schoolName: d.schoolName ?? '',
      period: d.period ?? '',
    };
  } catch {
    return null;
  }
}
