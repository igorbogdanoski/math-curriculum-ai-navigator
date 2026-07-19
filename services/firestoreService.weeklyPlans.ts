/**
 * Weekly Plans — Firestore Service (S88-B)
 *
 * Persists teacher weekly plan snapshots.
 * Required by MK law for grades 1–5 (weekly planning is mandatory).
 *
 * Collection: weekly_plans
 * Document ID: {uid}_{annualPlanId}_{weekNumber}
 *
 * 2026-07-19 (audit_2026_07_18_full_app_review, Wave 6.3): the doc ID used to be
 * {uid}_{gradeId}_{weekNumber} — scoped only by grade, not by which annual plan
 * (i.e. which school year) the week belongs to. A teacher who taught the same
 * grade in two different years, or who copies a prior year's annual plan
 * forward, would silently overwrite last year's saved week N with this year's
 * week N the moment they hit Save, since both plans share the same gradeId.
 * Scoping by annualPlanId instead (every academic_annual_plans doc already has
 * a unique Firestore ID) makes each plan's weekly data independent regardless
 * of grade reuse across years. `gradeId`/`gradeLevel` are kept as plain data
 * fields (still useful for querying/display) — only the document key changed.
 */

import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, orderBy, onSnapshot,
  serverTimestamp, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getCurrentSchoolYear } from '../utils/schoolYear';

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

function makeId(uid: string, annualPlanId: string, weekNumber: number): string {
  return `${uid}_${annualPlanId}_w${weekNumber}`;
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
  const id = makeId(uid, annualPlanId, weekNumber);
  await setDoc(doc(db, COLLECTION, id), {
    uid,
    gradeId,
    gradeLevel,
    weekNumber,
    schoolYear: getCurrentSchoolYear(),
    annualPlanId,
    periodsPerDay,
    slots,
    savedAt: serverTimestamp(),
  });
};

export const loadWeeklyPlan = async (
  uid: string,
  annualPlanId: string,
  weekNumber: number,
): Promise<SavedWeeklyPlan | null> => {
  const id = makeId(uid, annualPlanId, weekNumber);
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
  annualPlanId: string,
  weekNumber: number,
  onData: (plan: SavedWeeklyPlan | null) => void,
): Unsubscribe => {
  const id = makeId(ownerUid, annualPlanId, weekNumber);
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
