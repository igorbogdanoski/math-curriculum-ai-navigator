/**
 * Persisted library of a teacher's own generated Gamma presentations.
 * Firestore structure: gamma_presentations/{id} — owner-scoped, written once per
 * GammaModeModal mount (see GammaModeModal.tsx) so every presentation opened in Gamma Mode,
 * regardless of where it was generated, ends up in the /gamma library automatically.
 */
import {
  addDoc, collection, getDocs, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { logger } from '../utils/logger';
import type { AIGeneratedPresentation, PresentationSlide } from '../types';

export interface GammaPresentationRecord {
  id: string;
  teacherUid: string;
  title: string;
  topic: string;
  gradeLevel: number;
  slides: PresentationSlide[];
  createdAt: unknown;
}

/** Saves a copy of a generated presentation to the teacher's Gamma library. Best-effort —
 *  a save failure must never block the teacher from actually presenting. */
export async function saveGammaPresentation(
  teacherUid: string,
  data: AIGeneratedPresentation,
): Promise<void> {
  try {
    await addDoc(collection(db, 'gamma_presentations'), {
      teacherUid,
      title: data.title,
      topic: data.topic,
      gradeLevel: data.gradeLevel,
      slides: data.slides,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    logger.warn('[GammaPresentations] save failed:', err);
  }
}

export async function fetchGammaPresentations(teacherUid: string): Promise<GammaPresentationRecord[]> {
  try {
    const q = query(
      collection(db, 'gamma_presentations'),
      where('teacherUid', '==', teacherUid),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<GammaPresentationRecord, 'id'>) }));
  } catch (err) {
    logger.warn('[GammaPresentations] fetch failed:', err);
    return [];
  }
}
