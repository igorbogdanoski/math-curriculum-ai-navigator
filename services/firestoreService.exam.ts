import { logger } from '../utils/logger';
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, onSnapshot,
  serverTimestamp, query, where, limit, orderBy, type Timestamp,
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
    deviceId: string,
  ): Promise<ExamVariantKey> {
    // Use a transaction so concurrent joins don't collide on the same variant slot.
    // The counter doc lives at exam_sessions/{id}/__meta__/joinCounter.
    const responsesRef = collection(db, SESSIONS, sessionId, RESPONSES);
    const counterRef = doc(db, SESSIONS, sessionId, '__meta__', 'joinCounter');

    const variantKey = await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const count: number = counterSnap.exists() ? (counterSnap.data()['n'] as number) : 0;
      const vk = assignVariant(count);
      tx.set(counterRef, { n: count + 1 }, { merge: true });
      return vk;
    });

    await addDoc(responsesRef, {
      id: deviceId,
      sessionId,
      studentName,
      variantKey,
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

    return variantKey;
  },

  async saveExamAnswer(
    sessionId: string,
    responseDocId: string,
    questionIndex: number,
    answer: string,
  ): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      [`answers.q${questionIndex}`]: answer,
      status: 'solving',
    }).catch(err => logger.warn('[exam] saveExamAnswer:', err));
  },

  async submitExamFinal(
    sessionId: string,
    responseDocId: string,
    timeRemaining: number,
  ): Promise<void> {
    await updateDoc(doc(db, SESSIONS, sessionId, RESPONSES, responseDocId), {
      status: 'submitted',
      submittedAt: serverTimestamp(),
      timeRemainingOnSubmit: timeRemaining,
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
};
