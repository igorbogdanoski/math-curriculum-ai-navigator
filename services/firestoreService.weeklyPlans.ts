/**
 * Weekly Plans — Firestore Service (S88-B)
 *
 * Persists teacher weekly plan snapshots.
 * Required by MK law for grades 1–5 (weekly planning is mandatory).
 *
 * Collection: weekly_plans
 * Document ID: {uid}_{gradeId}_{weekNumber}
 */

import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy, onSnapshot,
  serverTimestamp, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface WeeklyPlanSlot {
  dayIdx: number;
  periodIdx: number;
  lessonNumber: number;
  topicTitle: string;
  topicIdx: number;
}

export interface SavedWeeklyPlan {
  id: string;
  uid: string;
  gradeId: string;
  gradeLevel: number;
  weekNumber: number;
  schoolYear: string;
  annualPlanId: string;
  periodsPerDay: [number, number, number, number, number];
  slots: WeeklyPlanSlot[];
  savedAt: Timestamp | null;
}

const COLLECTION = 'weekly_plans';

function makeId(uid: string, gradeId: string, weekNumber: number): string {
  return `${uid}_${gradeId}_w${weekNumber}`;
}

function currentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

export const saveWeeklyPlan = async (
  uid: string,
  gradeId: string,
  gradeLevel: number,
  weekNumber: number,
  annualPlanId: string,
  periodsPerDay: [number, number, number, number, number],
  slots: WeeklyPlanSlot[],
): Promise<void> => {
  const id = makeId(uid, gradeId, weekNumber);
  await setDoc(doc(db, COLLECTION, id), {
    uid,
    gradeId,
    gradeLevel,
    weekNumber,
    schoolYear: currentSchoolYear(),
    annualPlanId,
    periodsPerDay,
    slots,
    savedAt: serverTimestamp(),
  });
};

export const loadWeeklyPlan = async (
  uid: string,
  gradeId: string,
  weekNumber: number,
): Promise<SavedWeeklyPlan | null> => {
  const id = makeId(uid, gradeId, weekNumber);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SavedWeeklyPlan;
};

/** Fetch all weekly plans for a teacher, newest first */
export const fetchMyWeeklyPlans = async (uid: string): Promise<SavedWeeklyPlan[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('uid', '==', uid),
      orderBy('savedAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedWeeklyPlan));
};

/**
 * S93-C: Subscribe to another teacher's saved weekly plan for real-time read-only viewing.
 * Used when a colleague shares their weekly plan link.
 */
export const subscribeSharedWeeklyPlan = (
  ownerUid: string,
  gradeId: string,
  weekNumber: number,
  onData: (plan: SavedWeeklyPlan | null) => void,
): Unsubscribe => {
  const id = `${ownerUid}_${gradeId}_w${weekNumber}`;
  return onSnapshot(doc(db, COLLECTION, id), snap => {
    if (!snap.exists()) { onData(null); return; }
    onData({ id: snap.id, ...snap.data() } as SavedWeeklyPlan);
  }, () => onData(null));
};

/** Fetch all weekly plans for a grade (for school-level overview) */
export const fetchWeeklyPlansByGrade = async (
  uid: string,
  gradeId: string,
): Promise<SavedWeeklyPlan[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('uid', '==', uid),
      where('gradeId', '==', gradeId),
      orderBy('weekNumber', 'asc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedWeeklyPlan));
};
