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
import type { PresentationSlide, AIGeneratedAssessment } from '../types';

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
  /** Live poll options for the current slide, set ad-hoc by the host; null when no poll is active. */
  pollOptions?: string[] | null;
  /** Index into pollOptions marking the correct answer; null = opinion poll, no right answer. */
  pollCorrectIndex?: number | null;
  /** Whether poll results are currently visible to students (host-controlled reveal moment). */
  pollRevealed?: boolean;
  /** Broadcast exit ticket — set by the host once, students then play it via
   *  InteractiveQuizPlayer and their result is saved to the gradebook (quiz_results). */
  exitTicket?: AIGeneratedAssessment | null;
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
    await updateDoc(doc(db, 'live_gamma', pin), {
      slideIdx, responseCount: 0, handsUids: [],
      pollOptions: null, pollCorrectIndex: null, pollRevealed: false,
    });
  } catch (err) {
    logger.warn('[GammaLive] broadcastSlide failed:', err);
  }
}

/** Sets (or clears, with null) the live poll options for the current slide. A freshly-started
 *  poll always starts unrevealed — the host explicitly reveals results via
 *  revealGammaPollResults(). Host-only — covered by firestore.rules' isOwner(hostUid)
 *  full-write branch on the session doc. */
export async function setGammaPollOptions(pin: string, options: string[] | null, correctIndex?: number | null): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), {
      pollOptions: options,
      pollCorrectIndex: correctIndex ?? null,
      pollRevealed: false,
    });
  } catch (err) {
    logger.warn('[GammaLive] setPollOptions failed:', err);
  }
}

/** Reveals live poll results to students — the Kahoot-style "moment" the host triggers once
 *  ready, rather than results always being visible immediately after voting. */
export async function revealGammaPollResults(pin: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { pollRevealed: true });
  } catch (err) {
    logger.warn('[GammaLive] revealPollResults failed:', err);
  }
}

/** Tallies vote counts per option label from the responses submitted to a given slide. */
export function tallyPollResponses(responses: GammaLiveResponse[], slideIdx: number): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const r of responses) {
    if (r.slideIdx !== slideIdx) continue;
    tally[r.answer] = (tally[r.answer] ?? 0) + 1;
  }
  return tally;
}

/** Broadcasts the teacher's generated exit ticket to every student in the session —
 *  host-only, covered by firestore.rules' isOwner(hostUid) full-write branch on the
 *  session doc, no rules change needed. */
export async function sendGammaExitTicket(pin: string, exitTicket: AIGeneratedAssessment): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { exitTicket });
  } catch (err) {
    logger.warn('[GammaLive] sendExitTicket failed:', err);
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
