/**
 * Gamma Live — real-time interactive presentation service.
 * Firestore structure:
 *   live_gamma/{pin}           — session doc (host writes, students read)
 *   live_gamma/{pin}/responses/{studentId} — student answers
 */
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
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
  /** Index into pollOptions marking the correct answer — only present on this public doc AFTER
   *  revealGammaPollResults() copies it over from the host-private subcollection below; null
   *  beforehand (also true for opinion polls with no right answer, even after reveal). */
  pollCorrectIndex?: number | null;
  /** Whether poll results are currently visible to students (host-controlled reveal moment). */
  pollRevealed?: boolean;
  /** Broadcast exit ticket — set by the host once, students then play it via
   *  InteractiveQuizPlayer and their result is saved to the gradebook (quiz_results). */
  exitTicket?: AIGeneratedAssessment | null;
  /** Absent or 'locked' (default) = today's exact behavior — every student mirrors slideIdx.
   *  'free' lets students navigate independently (GammaStudentView tracks its own local index). */
  pacingMode?: 'locked' | 'free';
  /** Completed annotation strokes for the current slide, rendered as an SVG overlay on
   *  every student's screen. Reset whenever the host moves to a different slide. */
  annotationStrokes?: GammaAnnotationStroke[];
}

/** A single completed draw/highlight stroke, in coordinates normalized 0-1 relative to the
 *  presenter's own canvas — an inherent cross-device approximation, since a student's screen
 *  is rarely the exact same aspect ratio as the teacher's. Laser-pointer moves are ephemeral
 *  and never recorded here. */
export interface GammaAnnotationStroke {
  mode: 'draw' | 'highlight';
  points: { x: number; y: number }[];
  color: string;
  width: number;
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
      annotationStrokes: [],
    });
    await setDoc(doc(db, 'live_gamma', pin, 'host_private', 'state'), { pollCorrectIndex: null });
  } catch (err) {
    logger.warn('[GammaLive] broadcastSlide failed:', err);
  }
}

/** Appends one completed stroke to the current slide's annotation overlay — host-only,
 *  covered by isOwner(hostUid). Best-effort like every other live-sync write here; only
 *  called when a live session is actually running. */
export async function addGammaAnnotationStroke(pin: string, stroke: GammaAnnotationStroke): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { annotationStrokes: arrayUnion(stroke) });
  } catch (err) {
    logger.warn('[GammaLive] addAnnotationStroke failed:', err);
  }
}

/** Clears the broadcast annotation overlay — called when the host clears their own canvas,
 *  so students don't keep seeing marks the teacher has already erased. */
export async function clearGammaAnnotationStrokes(pin: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { annotationStrokes: [] });
  } catch (err) {
    logger.warn('[GammaLive] clearAnnotationStrokes failed:', err);
  }
}

/** Sets (or clears, with null) the live poll options for the current slide. A freshly-started
 *  poll always starts unrevealed — the host explicitly reveals results via
 *  revealGammaPollResults(). Host-only — covered by firestore.rules' isOwner(hostUid)
 *  full-write branch on the session doc. The correct answer itself is written only to the
 *  host_private/state subdoc (see firestore.rules), never to the public session doc, so
 *  students can't read it out of the live snapshot before the host reveals it. */
export async function setGammaPollOptions(pin: string, options: string[] | null, correctIndex?: number | null): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), {
      pollOptions: options,
      pollCorrectIndex: null,
      pollRevealed: false,
    });
    await setDoc(doc(db, 'live_gamma', pin, 'host_private', 'state'), { pollCorrectIndex: correctIndex ?? null });
  } catch (err) {
    logger.warn('[GammaLive] setPollOptions failed:', err);
  }
}

/** Reveals live poll results to students — the Kahoot-style "moment" the host triggers once
 *  ready, rather than results always being visible immediately after voting. Copies the
 *  correct-answer index from the host-private subdoc onto the public session doc, which is
 *  the only point at which students' live snapshot of live_gamma/{pin} gains that field. */
export async function revealGammaPollResults(pin: string): Promise<void> {
  try {
    const privateSnap = await getDoc(doc(db, 'live_gamma', pin, 'host_private', 'state'));
    const pollCorrectIndex = privateSnap.exists() ? (privateSnap.data().pollCorrectIndex ?? null) : null;
    await updateDoc(doc(db, 'live_gamma', pin), { pollRevealed: true, pollCorrectIndex });
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

/** Toggles free-pacing mode — host-only, covered by isOwner(hostUid). */
export async function setGammaPacingMode(pin: string, mode: 'locked' | 'free'): Promise<void> {
  try {
    await updateDoc(doc(db, 'live_gamma', pin), { pacingMode: mode });
  } catch (err) {
    logger.warn('[GammaLive] setPacingMode failed:', err);
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

/** Host-only: streams the live-private correct-answer index (see host_private/state in
 *  firestore.rules) so the teacher's own dashboard can highlight the correct option while a
 *  poll is running, without that value ever touching the public session doc students read. */
export function subscribeGammaHostPrivateState(
  pin: string,
  callback: (pollCorrectIndex: number | null) => void,
): () => void {
  return onSnapshot(doc(db, 'live_gamma', pin, 'host_private', 'state'), snap => {
    callback(snap.exists() ? (snap.data().pollCorrectIndex ?? null) : null);
  }, err => {
    logger.warn('[GammaLive] subscribeHostPrivateState error:', err);
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
