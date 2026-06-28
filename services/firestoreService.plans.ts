import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
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

export interface TeacherThematicHistoryItem {
  gradeId: string;
  topicId: string;
  thematicUnit: string;
  /** pedagogical models mentioned across lessons */
  teachingModels: string[];
  /** summary of lesson key activities (first 3) */
  lessonSummaries: string[];
}

/** Fetch the teacher's last 3 saved thematic plans for AI context injection. */
export async function fetchTeacherThematicHistory(uid: string): Promise<TeacherThematicHistoryItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'thematic_plan_edits'),
        where('uid', '==', uid),
        orderBy('savedAt', 'desc'),
        limit(3),
      ),
    );
    return snap.docs.map(d => {
      const data = d.data();
      const plan = data.plan as AIGeneratedThematicPlan;
      const lessons = plan?.lessons ?? [];
      const allText = lessons.flatMap(l => [l.keyActivities, l.scenario?.intro ?? '', ...(l.scenario?.main ?? [])]).join(' ').toLowerCase();
      const teachingModels: string[] = [];
      if (allText.includes('5e') || allText.includes('5-e') || allText.includes('engage')) teachingModels.push('5E');
      if (allText.includes('pbl') || allText.includes('проект')) teachingModels.push('PBL');
      if (allText.includes('zpd') || allText.includes('зона') || allText.includes('скелинг')) teachingModels.push('ZPD');
      if (allText.includes('кооперативн') || allText.includes('групна работа') || allText.includes('cooperative')) teachingModels.push('Кооперативно');
      return {
        gradeId: data.gradeId ?? '',
        topicId: data.topicId ?? '',
        thematicUnit: plan?.thematicUnit ?? data.topicId ?? '',
        teachingModels: [...new Set(teachingModels)],
        lessonSummaries: lessons.slice(0, 3).map(l => l.keyActivities ?? '').filter(Boolean),
      };
    });
  } catch {
    return [];
  }
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
