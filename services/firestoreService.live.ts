import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';
import { type LiveSession } from './firestoreService.types';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';

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
      console.error('Error fetching cached quiz list:', error);
      return [];
    }
  };

export const createLiveSession = async (hostUid: string, quizId: string, quizTitle: string, conceptId?: string): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    for (let i = 0; i < 4; i++) joinCode += chars[Math.floor(Math.random() * chars.length)];
    const ref = await addDoc(collection(db, 'live_sessions'), {
      hostUid, quizId, quizTitle, conceptId: conceptId ?? null,
      status: 'active', joinCode, studentResponses: {}, createdAt: serverTimestamp(),
    });
    return ref.id;
  };

export const getLiveSessionByCode = async (joinCode: string): Promise<LiveSession | null> => {
    try {
      const q = query(collection(db, 'live_sessions'), where('joinCode', '==', joinCode.toUpperCase()), where('status', '==', 'active'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as LiveSession;
    } catch (error) {
      console.error('Error fetching live session by code:', error);
      return null;
    }
  };

export const updateLiveSessionStatus = async (sessionId: string, status: 'active' | 'ended'): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), { status });
  };

export const joinLiveSession = async (sessionId: string, studentName: string): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${studentName}`]: { status: 'joined' },
    });
  };

export const submitLiveResponse = async (sessionId: string, studentName: string, percentage: number): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${studentName}`]: { status: 'completed', percentage, completedAt: serverTimestamp() },
    }).catch(err => console.warn('[Live] submitLiveResponse failed:', err));
  };

export const markLiveInProgress = async (sessionId: string, studentName: string): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${studentName}`]: { status: 'in_progress' },
    }).catch(() => { /* non-fatal */ });
  };

export const subscribeLiveSession = (sessionId: string, callback: (session: LiveSession | null) => void): (() => void) => {
    const ref = doc(db, 'live_sessions', sessionId);
    return onSnapshot(ref, snap => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveSession) : null);
    });
  };

export const createLiveQuizSession = async (teacherId: string, title: string, questions: any[]): Promise<string> => {
    // Generate a random 6-digit pin
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionRef = doc(db, 'live_quizzes', pin);
    
    await setDoc(sessionRef, {
        pin,
        teacherId,
        status: 'waiting',
        title,
        questions,
        currentQuestionIndex: -1,
        createdAt: serverTimestamp()
    });
    
    return pin;
  };

export const updateLiveQuizState = async (pin: string, data: Partial<{ status: 'waiting' | 'active' | 'finished', currentQuestionIndex: number }>): Promise<void> => {
    const sessionRef = doc(db, 'live_quizzes', pin);
    await updateDoc(sessionRef, data);
  };

export const joinLiveQuiz = async (pin: string, studentName: string): Promise<string> => {
    const participantRef = doc(collection(db, 'live_quizzes', pin, 'participants'));
    await setDoc(participantRef, {
        id: participantRef.id,
        name: studentName,
        score: 0,
        answers: {},
        joinedAt: serverTimestamp()
    });
    return participantRef.id;
  };

export const submitLiveQuizAnswer = async (pin: string, participantId: string, questionIndex: number, answer: string, isCorrect: boolean): Promise<void> => {
    const participantRef = doc(db, 'live_quizzes', pin, 'participants', participantId);
    
    // Instead of simple update, if it's correct we increment score. 
    // We update answers map.
    await updateDoc(participantRef, {
        [`answers.${questionIndex}`]: answer,
        ...(isCorrect ? { score: increment(1) } : {})
    });
  };

export const subscribeToLiveQuiz = (pin: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'live_quizzes', pin), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
  };

export const subscribeToLiveQuizParticipants = (pin: string, callback: (participants: any[]) => void) => {
    return onSnapshot(collection(db, 'live_quizzes', pin, 'participants'), (snap) => {
        callback(snap.docs.map(d => d.data()));
    });
  };

