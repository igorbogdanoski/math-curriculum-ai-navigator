import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from '../firebaseConfig';
import type { MaterialFeedback, FeedbackReasonBreakdown, FeedbackReasonCode } from '../types';
import { FEEDBACK_REASON_TAXONOMY } from '../types';

const FEEDBACK_REASON_CODES = Object.keys(FEEDBACK_REASON_TAXONOMY) as FeedbackReasonCode[];

const toReviewDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate());
  }
  return new Date();
};

export const createEmptyFeedbackReasonCounts = (): Record<FeedbackReasonCode, number> =>
  FEEDBACK_REASON_CODES.reduce((acc, code) => {
    acc[code] = 0;
    return acc;
  }, {} as Record<FeedbackReasonCode, number>);

export const buildFeedbackReasonBreakdown = (
  feedbackItems: Array<Pick<MaterialFeedback, 'status' | 'reasonCodes'>>,
  periodDays: number = 30,
): FeedbackReasonBreakdown => {
  const reasonCounts = createEmptyFeedbackReasonCounts();
  let approved = 0;
  let rejected = 0;
  let revision_requested = 0;

  feedbackItems.forEach((item) => {
    if (item.status === 'approved') approved += 1;
    if (item.status === 'rejected') rejected += 1;
    if (item.status === 'revision_requested') revision_requested += 1;

    item.reasonCodes?.forEach((code) => {
      if (code in reasonCounts) {
        reasonCounts[code] += 1;
      }
    });
  });

  const totalFeedback = feedbackItems.length;
  const reasonPercentages = FEEDBACK_REASON_CODES.reduce((acc, code) => {
    acc[code] = totalFeedback > 0 ? Math.round((reasonCounts[code] / totalFeedback) * 100) : 0;
    return acc;
  }, {} as Record<FeedbackReasonCode, number>);

  const topReasons = FEEDBACK_REASON_CODES
    .filter((code) => reasonCounts[code] > 0)
    .sort((left, right) => reasonCounts[right] - reasonCounts[left])
    .slice(0, 5)
    .map((code) => ({
      code,
      count: reasonCounts[code],
      percentage: reasonPercentages[code],
    }));

  return {
    totalFeedback,
    approved,
    rejected,
    revision_requested,
    reasonCounts,
    reasonPercentages,
    topReasons,
    periodDays,
    generatedAt: new Date(),
  };
};

/**
 * Record material feedback from a teacher/reviewer
 * @param uid - The UID of the reviewer
 * @param materialId - The ID of the material being reviewed
 * @param feedback - The feedback data (status, reasons, comments)
 */
export const recordMaterialFeedback = async (
  uid: string,
  materialId: string,
  feedback: {
    status: 'approved' | 'rejected' | 'revision_requested';
    reasonCodes: FeedbackReasonCode[];
    comments: string;
  }
): Promise<string> => {
  try {
    const feedbackRef = collection(db, 'users', uid, 'material_feedback');
    
    const feedbackDoc: Omit<MaterialFeedback, 'id'> = {
      materialId,
      reviewedBy: uid,
      reviewedAt: serverTimestamp() as Timestamp,
      status: feedback.status,
      reasonCodes: feedback.reasonCodes,
      comments: feedback.comments,
      suggestedEdits: [],
    };

    const docRef = await addDoc(feedbackRef, feedbackDoc);
    return docRef.id;
  } catch (error) {
    console.error('Error recording material feedback:', error);
    throw error;
  }
};

/**
 * Fetch all feedback records for a specific material
 * @param uid - The UID of the viewer (typically a teacher/admin)
 * @param materialId - The ID of the material
 * @returns Array of feedback records
 */
export const fetchMaterialFeedback = async (
  uid: string,
  materialId: string
): Promise<MaterialFeedback[]> => {
  try {
    const feedbackRef = collection(db, 'users', uid, 'material_feedback');
    const q = query(
      feedbackRef,
      where('materialId', '==', materialId),
      orderBy('reviewedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      reviewedAt: toReviewDate(doc.data().reviewedAt),
    })) as MaterialFeedback[];
  } catch (error) {
    console.error('Error fetching material feedback:', error);
    return [];
  }
};

/**
 * Compute aggregated feedback breakdown for all materials reviewed by a specific reviewer
 * @param uid - The UID of the reviewer
 * @param periodDays - Number of days to look back (default 30)
 * @returns Aggregated breakdown with counts, percentages, and top reasons
 */
export const computeFeedbackBreakdown = async (
  uid: string,
  periodDays: number = 30
): Promise<FeedbackReasonBreakdown> => {
  try {
    const feedbackRef = collection(db, 'users', uid, 'material_feedback');
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const q = query(
      feedbackRef,
      where('reviewedAt', '>=', Timestamp.fromDate(startDate)),
      where('reviewedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('reviewedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const allFeedback = querySnapshot.docs.map((doc) => ({
      ...(doc.data() as MaterialFeedback),
      reviewedAt: toReviewDate(doc.data().reviewedAt),
    }));

    return buildFeedbackReasonBreakdown(allFeedback, periodDays);
  } catch (error) {
    console.error('Error computing feedback breakdown:', error);
    return buildFeedbackReasonBreakdown([], periodDays);
  }
};

/**
 * Fetch all feedback records by a specific reviewer within a date range
 * @param uid - The UID of the reviewer
 * @param periodDays - Number of days to look back (default 30)
 * @returns Array of feedback records
 */
export const fetchReviewerFeedbackHistory = async (
  uid: string,
  periodDays: number = 30
): Promise<MaterialFeedback[]> => {
  try {
    const feedbackRef = collection(db, 'users', uid, 'material_feedback');
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const q = query(
      feedbackRef,
      where('reviewedAt', '>=', startDate),
      where('reviewedAt', '<=', endDate),
      orderBy('reviewedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      reviewedAt: toReviewDate(doc.data().reviewedAt),
    })) as MaterialFeedback[];
  } catch (error) {
    console.error('Error fetching reviewer feedback history:', error);
    return [];
  }
};

export const materialFeedbackService = {
  recordMaterialFeedback,
  fetchMaterialFeedback,
  computeFeedbackBreakdown,
  fetchReviewerFeedbackHistory,
};
