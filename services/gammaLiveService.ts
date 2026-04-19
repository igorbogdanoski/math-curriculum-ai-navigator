/**
 * Gamma Live — real-time interactive presentation service.
 * Firestore structure:
 *   live_gamma/{pin}           — session doc (host writes, students read)
 *   live_gamma/{pin}/responses/{studentId} — student answers
 */
import {
  doc, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { logger } from '../utils/logger';
import type { PresentationSlide } from '../types';

export interface GammaLiveSession {
  pin: string;
  hostUid: string;
  topic: string;
  gradeLevel: number;
  slideIdx: number;
  slides: PresentationSlide[];
  isActive: boolean;
  startedAt: unknown;
  responseCount: number;
  handsUids: string[];
}

export interface GammaLiveResponse {
  studentId: string;
  studentName: string;
  answer: string;
  slideIdx: number;
  submittedAt: unknown;
}

// ── PIN generation ────────────────────────────────────────────────────────────
function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Host API ──────────────────────────────────────────────────────────────────
export async function startGammaLive(
  hostUid: string,
  topic: string,
  gradeLevel: number,
  slides: PresentationSlide[],
): Promise<string> {
  const pin = generatePin();
  await setDoc(doc(db, 'live_gamma', pin), {
    pin,
    hostUid,
    topic,
    gradeLevel,
    slideIdx: 0,
    slides,
    isActive: true,
    startedAt: serverTimestamp(),
    responseCount: 0,
    handsUids: [],
  });
  return pin;
}

export async function broadcastGammaSlide(pin: string, slideIdx: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { slideIdx, responseCount: 0, handsUids: [] });
  } catch (err) {
    logger.warn('[GammaLive] broadcastSlide failed:', err);
  }
}

export async function endGammaLive(pin: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { isActive: false });
  } catch (err) {
    logger.warn('[GammaLive] endSession failed:', err);
  }
}

export function subscribeGammaSession(
  pin: string,
  callback: (session: GammaLiveSession | null) => void,
): () => void {
  return onSnapshot(doc(db, 'live_gamma', pin), snap => {
    callback(snap.exists() ? (snap.data() as GammaLiveSession) : null);
  }, err => {
    logger.warn('[GammaLive] subscribeSession error:', err);
    callback(null);
  });
}

export function subscribeGammaResponses(
  pin: string,
  callback: (responses: GammaLiveResponse[]) => void,
): () => void {
  return onSnapshot(collection(db, 'live_gamma', pin, 'responses'), snap => {
    const list: GammaLiveResponse[] = snap.docs.map(d => ({
      studentId: d.id,
      ...(d.data() as Omit<GammaLiveResponse, 'studentId'>),
    }));
    callback(list);
  }, err => {
    logger.warn('[GammaLive] subscribeResponses error:', err);
  });
}

// ── Student API ───────────────────────────────────────────────────────────────
export async function submitGammaResponse(
  pin: string,
  studentId: string,
  studentName: string,
  slideIdx: number,
  answer: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'live_gamma', pin, 'responses', studentId), {
      studentName,
      answer,
      slideIdx,
      submittedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'live_gamma', pin), { responseCount: 0 }); // host counts via subcollection
  } catch (err) {
    logger.warn('[GammaLive] submitResponse failed:', err);
  }
}

export async function raiseGammaHand(pin: string, studentId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { handsUids: arrayUnion(studentId) });
  } catch (err) {
    logger.warn('[GammaLive] raiseHand failed:', err);
  }
}

export async function lowerGammaHand(pin: string, studentId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { handsUids: arrayRemove(studentId) });
  } catch (err) {
    logger.warn('[GammaLive] lowerHand failed:', err);
  }
}
