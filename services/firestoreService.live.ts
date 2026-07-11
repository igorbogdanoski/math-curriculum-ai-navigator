import { logger } from '../utils/logger';
import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, where, addDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type LiveSession } from './firestoreService.types';

export const fetchCachedQuizList = async (): Promise<{ id: string; title: string; conceptId?: string }[]> => {
    try {
      const q = query(collection(db, 'cached_ai_materials'), orderBy('createdAt', 'desc'), limit(40));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().content?.title ?? d.data().conceptId ?? d.id,
          conceptId: d.data().conceptId as string | undefined,
          type: d.data().type as string,
        }))
        .filter(q => q.type === 'quiz' || q.type === 'assessment')
        .slice(0, 20);
    } catch (error) {
      logger.error('Error fetching cached quiz list:', error);
      return [];
    }
  };

export const createLiveSession = async (
  hostUid: string,
  quizId: string,
  quizTitle: string,
  conceptId?: string,
  /** S47 — async homework mode: optional deadline (mkd-slidea pattern) */
  homeworkDeadlineMs?: number,
  /** S50-A — Kahoot timer: seconds per question */
  timerPerQuestion?: number,
): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    for (let i = 0; i < 4; i++) joinCode += chars[Math.floor(Math.random() * chars.length)];
    const ref = await addDoc(collection(db, 'live_sessions'), {
      hostUid, quizId, quizTitle, conceptId: conceptId ?? null,
      status: 'active', joinCode, studentResponses: {}, createdAt: serverTimestamp(),
      homeworkMode: !!homeworkDeadlineMs,
      homeworkDeadline: homeworkDeadlineMs
        ? new Date(homeworkDeadlineMs)
        : null,
      timerPerQuestion: timerPerQuestion ?? null,
    });
    return ref.id;
  };

export const getLiveSessionById = async (sessionId: string): Promise<LiveSession | null> => {
    try {
      const snap = await getDoc(doc(db, 'live_sessions', sessionId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as LiveSession;
    } catch (error) {
      logger.error('Error fetching live session by id:', error);
      return null;
    }
  };

export const getLiveSessionByCode = async (joinCode: string): Promise<LiveSession | null> => {
    try {
      const q = query(collection(db, 'live_sessions'), where('joinCode', '==', joinCode.toUpperCase()), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      const session = { id: d.id, ...d.data() } as LiveSession;
      // S47: session is joinable if active OR if in homework mode with a future deadline
      const isLive = session.status === 'active';
      const isHomeworkOpen = session.homeworkMode &&
        session.homeworkDeadline &&
        (session.homeworkDeadline as unknown as { toMillis: () => number }).toMillis() > Date.now();
      if (!isLive && !isHomeworkOpen) return null;
      return session;
    } catch (error) {
      logger.error('Error fetching live session by code:', error);
      return null;
    }
  };

export const updateLiveSessionStatus = async (sessionId: string, status: 'active' | 'ended'): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), { status });
  };

/**
 * Joins a live session — keyed by the student's anonymous Firebase Auth uid, NOT their
 * display name (a prior version keyed studentResponses by raw name, so two students with
 * the same/similar name in one session would silently overwrite each other's record).
 * `displayName` is stored once here and reused by every subsequent write for this uid.
 */
export const joinLiveSession = async (sessionId: string, uid: string, displayName: string): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${uid}`]: { displayName, status: 'joined' },
    });
  };

export const submitLiveResponse = async (
  sessionId: string,
  uid: string,
  displayName: string,
  percentage: number,
  answers?: Record<string, boolean>,
): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${uid}`]: {
        displayName,
        status: 'completed',
        percentage,
        completedAt: serverTimestamp(),
        ...(answers ? { answers } : {}),
      },
    }).catch(err => logger.warn('[Live] submitLiveResponse failed:', err));
  };

export const markLiveInProgress = async (sessionId: string, uid: string, displayName: string): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${uid}`]: { displayName, status: 'in_progress' },
    }).catch(() => { /* non-fatal */ });
  };

export const subscribeLiveSession = (sessionId: string, callback: (session: LiveSession | null) => void): (() => void) => {
    const ref = doc(db, 'live_sessions', sessionId);
    return onSnapshot(ref, snap => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveSession) : null);
    });
  };

