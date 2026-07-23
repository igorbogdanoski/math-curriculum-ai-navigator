import { logger } from '../utils/logger';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, onSnapshot,
  serverTimestamp, query, where, limit, orderBy,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ExamSession, ExamResponse, ExamVariantKey, ExamQuestion } from './firestoreService.types';

const SESSIONS = 'exam_sessions';
const RESPONSES = 'responses';

const VARIANT_KEYS: ExamVariantKey[] = ['A', 'B', 'V', 'G'];

function generateJoinCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function assignVariant(responseCount: number): ExamVariantKey {
  return VARIANT_KEYS[responseCount % 4];
}

export const examService = {
  async createExamSession(
    teacherUid: string,
    data: {
      title: string;
      subject: string;
      gradeLevel: number;
      variants: Record<ExamVariantKey, ExamQuestion[]>;
      duration: number;
      totalPoints: number;
    },
  ): Promise<string> {
    const ref = await addDoc(collection(db, SESSIONS), {
      ...data,
      joinCode: generateJoinCode(),
      status: 'draft',
      createdBy: teacherUid,
      createdAt: serverTimestamp(),
      startedAt: null,
      endsAt: null,
    });
    return ref.id;
  },

  async getExamSession(sessionId: string): Promise<ExamSession | null> {
    try {
      const snap = await getDoc(doc(db, SESSIONS, sessionId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ExamSession;
    } catch (err) {
      logger.error('[exam] getExamSession failed:', err);
      return null;
    }
  },

  async getExamSessionByCode(joinCode: string): Promise<ExamSession | null> {
    try {
      const q = query(
        collection(db, SESSIONS),
        where('joinCode', '==', joinCode),
        where('status', 'in', ['waiting', 'active']),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as ExamSession;
    } catch (err) {
      logger.error('[exam] getExamSessionByCode failed:', err);
      return null;
    }
  },

  subscribeExamSession(sessionId: string, cb: (s: ExamSession | null) => void): () => void {
    return onSnapshot(doc(db, SESSIONS, sessionId), snap => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as ExamSession) : null);
    });
  },

  async updateExamStatus(sessionId: string, status: ExamSession['status']): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === 'active') update.startedAt = serverTimestamp();
    if (status === 'ended') update.endsAt = serverTimestamp();
    await updateDoc(doc(db, SESSIONS, sessionId), update);
  },

  async startExamSession(sessionId: string, durationSeconds: number): Promise<void> {
    const endsAt = new Date(Date.now() + durationSeconds * 1000);
    await updateDoc(doc(db, SESSIONS, sessionId), {
      status: 'active',
      startedAt: serverTimestamp(),
      endsAt,
    });
  },

  // ─── Student side ─────────────────────────────────────────────────────────

  async joinExamSession(
    sessionId: string,
    studentName: string,
    studentUid: string,
  ): Promise<ExamVariantKey> {
    // The response doc ID is the student's own Firebase Auth uid (anonymous or Google) —
    // deterministic, not addDoc's random ID — so firestore.rules can scope reads/writes
    // to `responseId == request.auth.uid` and every later write (saveExamAnswer,
    // submitExamFinal, ...) can address the doc directly by uid. Previously this used
    // addDoc (random ID) plus a stored `id` field the client re-derived the "doc id" from
    // client-side; that field never matched the real doc, so every post-join write here
    // silently targeted a document that was never created.
    // Also runs inside the same transaction as the join-order counter, so a page-refresh
    // rejoin reuses the existing response (and its already-assigned variant) instead of
    // resetting progress or orphaning a duplicate under what used to be a fresh random ID.
    // NOTE: collection IDs matching /^__.*__$/ are reserved by Firestore (INVALID_ARGUMENT
    // on any read/write) — '__meta__' silently made every join attempt throw, regardless
    // of security rules. 'examMeta' is a normal collection name.
    const counterRef = doc(db, SESSIONS, sessionId, 'examMeta', 'joinCounter');
    const responseRef = doc(db, SESSIONS, sessionId, RESPONSES, studentUid);

    return runTransaction(db, async (tx) => {
      const existing = await tx.get(responseRef);
      if (existing.exists()) {
        return (existing.data() as ExamResponse).variantKey;
      }
      const counterSnap = await tx.get(counterRef);
      const count: number = counterSnap.exists() ? (counterSnap.data()['n'] as number) : 0;
      const vk = assignVariant(count);
      tx.set(counterRef, { n: count + 1 }, { merge: true });
      tx.set(responseRef, {
        studentUid,
        sessionId,
        studentName,
        variantKey: vk,
        answers: {},
        photoUrls: {},
        status: 'joined',
        submittedAt: null,
        timeRemainingOnSubmit: null,
        score: null,
        maxScore: null,
        aiFeedback: null,
        gradedAt: null,
      });
      return vk;
    });
  },

  async saveExamAnswer(
    sessionId: string,
    responseDocId: string,
    questionIndex: number,
    answer: string,
  ): Promise<void> {
    // Deliberately propagates failures (unlike a swallow-and-log) so the caller
    // (ExamPlayerView.handleAnswer) can track which answers haven't reached the
    // server and warn the student, instead of silently believing every answer synced.
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      [`answers.q${questionIndex}`]: answer,
      status: 'solving',
    });
  },

  async saveExamPhoto(
    sessionId: string,
    responseDocId: string,
    questionIndex: number,
    photoDataUrl: string,
  ): Promise<void> {
    // Persist a handwritten-solution photo for a question. Previously photos were
    // captured client-side but never written (photoUrls stayed {}), so they were lost
    // on submit/refresh. Mirrors saveExamAnswer's per-question field pattern.
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      [`photoUrls.q${questionIndex}`]: photoDataUrl,
    });
  },

  async submitExamFinal(
    sessionId: string,
    responseDocId: string,
    timeRemaining: number,
    photoUrls?: Record<string, string>,
  ): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      timeRemainingOnSubmit: timeRemaining,
      // Final sync of any solution photos (belt-and-suspenders alongside saveExamPhoto).
      ...(photoUrls && Object.keys(photoUrls).length > 0 ? { photoUrls } : {}),
    });
  },

  // ─── Teacher / presenter side ─────────────────────────────────────────────

  subscribeExamResponses(
    sessionId: string,
    cb: (responses: ExamResponse[]) => void,
  ): () => void {
    return onSnapshot(collection(db, SESSIONS, sessionId, RESPONSES), snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResponse)));
    });
  },

  async getExamResponses(sessionId: string): Promise<ExamResponse[]> {
    const snap = await getDocs(collection(db, SESSIONS, sessionId, RESPONSES));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResponse));
  },

  async saveGradingResult(
    sessionId: string,
    responseDocId: string,
    result: {
      score: number;
      maxScore: number;
      aiFeedback: ExamResponse['aiFeedback'];
    },
  ): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      score: result.score,
      maxScore: result.maxScore,
      aiFeedback: result.aiFeedback,
      gradedAt: serverTimestamp(),
    });
  },

  // ─── Teacher list ─────────────────────────────────────────────────────────

  async listExamSessions(teacherUid: string): Promise<ExamSession[]> {
    try {
      const q = query(
        collection(db, SESSIONS),
        where('createdBy', '==', teacherUid),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamSession));
    } catch (err) {
      logger.error('[exam] listExamSessions:', err);
      return [];
    }
  },

  /**
   * All graded responses (score/maxScore present) across a teacher's exam sessions,
   * paired with the session they belong to — feeds ImportFromResultsModal (gradebook
   * unification) the same way fetchQuizResults feeds the quiz-results import path.
   * There's no top-level `exam_responses` collection to query directly (responses live
   * in a `responses` subcollection per session — see RESPONSES above), so this fetches
   * the teacher's sessions first, then each session's responses; bounded by
   * listExamSessions' own limit(50).
   */
  async fetchTeacherGradedExamResponses(teacherUid: string): Promise<{ session: ExamSession; responses: ExamResponse[] }[]> {
    const sessions = await this.listExamSessions(teacherUid);
    const results = await Promise.all(sessions.map(async session => {
      const responses = (await this.getExamResponses(session.id))
        .filter(r => r.status === 'submitted' && r.score != null && r.maxScore != null);
      return { session, responses };
    }));
    return results.filter(r => r.responses.length > 0);
  },
};
