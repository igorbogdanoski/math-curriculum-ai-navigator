import { logger } from '../utils/logger';
/**
 * Adaptive Difficulty Service — Ж1.2
 *
 * Tracks per-student difficulty targets using a rolling window of quiz results.
 * Implements ZPD (Zone of Proximal Development) calibration:
 *
 *   avg ≥ 85% → 'hard'   (boredom zone — push the student)
 *   avg 60–84% → 'medium' (ZPD — maintain, learning is happening)
 *   avg < 60% → 'easy'   (frustration zone — reduce to rebuild confidence)
 *
 * Firestore path: adaptive_difficulty/{teacherUid}/students/{safeStudentName}
 * Document: { targets: { [conceptId]: { level, recentPcts, updatedAt } } }
 *
 * Педагошка основа: Vygotsky ZPD, Csikszentmihalyi Flow Theory
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface ConceptDifficultyTarget {
  level: DifficultyLevel;
  recentPcts: number[];   // last N quiz percentages (rolling window)
  updatedAt: unknown;      // Firestore Timestamp
}

export interface StudentDifficultyDoc {
  targets: Record<string, ConceptDifficultyTarget>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_SIZE = 5;         // rolling average over last 5 attempts
const HARD_THRESHOLD = 85;     // ≥85% avg → student is ready for harder
const EASY_THRESHOLD = 60;     // <60% avg → frustration zone, go easier

// ── Algorithm ─────────────────────────────────────────────────────────────────

function calcLevel(recentPcts: number[]): DifficultyLevel {
  if (recentPcts.length === 0) return 'medium';
  const avg = recentPcts.reduce((s, p) => s + p, 0) / recentPcts.length;
  if (avg >= HARD_THRESHOLD) return 'hard';
  if (avg < EASY_THRESHOLD) return 'easy';
  return 'medium';
}

function safeKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 60);
}

// ── Service ──────────────────────────────────────────────────────────────────

export const adaptiveDifficultyService = {

  /**
   * Get the recommended difficulty level for a student on a specific concept.
   * Returns 'medium' as default when no history exists.
   */
  getStudentLevel: async (
    teacherUid: string,
    studentName: string,
    conceptId: string,
  ): Promise<DifficultyLevel> => {
    try {
      const ref = doc(db, 'adaptive_difficulty', teacherUid, 'students', safeKey(studentName));
      const snap = await getDoc(ref);
      if (!snap.exists()) return 'medium';
      const data = snap.data() as StudentDifficultyDoc;
      return data.targets?.[conceptId]?.level ?? 'medium';
    } catch {
      return 'medium';
    }
  },

  /**
   * Update difficulty target after a quiz attempt.
   * Uses a rolling window — adds the new percentage, drops the oldest if > WINDOW_SIZE.
   * Called fire-and-forget after saveQuizResult.
   */
  updateAfterQuiz: async (
    teacherUid: string,
    studentName: string,
    conceptId: string,
    percentage: number,
  ): Promise<void> => {
    if (!teacherUid || !studentName || !conceptId) return;
    try {
      const ref = doc(db, 'adaptive_difficulty', teacherUid, 'students', safeKey(studentName));
      const snap = await getDoc(ref);
      const existing = snap.exists() ? (snap.data() as StudentDifficultyDoc) : { targets: {} };

      const prev = existing.targets[conceptId];
      const recentPcts = [...(prev?.recentPcts ?? []), percentage].slice(-WINDOW_SIZE);
      const level = calcLevel(recentPcts);

      await setDoc(
        ref,
        {
          targets: {
            ...existing.targets,
            [conceptId]: { level, recentPcts, updatedAt: serverTimestamp() },
          },
        },
        { merge: true },
      );
    } catch (err) {
      // Non-critical — fail silently, core quiz save is already done
      logger.error('[AdaptiveDifficulty] updateAfterQuiz failed:', err);
    }
  },

  /**
   * Fetch all difficulty targets for all students of a teacher.
   * Used in analytics to show ZPD recommendations.
   * Returns map: studentKey → conceptId → target
   */
  fetchAllTargets: async (
    teacherUid: string,
  ): Promise<Record<string, StudentDifficultyDoc>> => {
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const col = collection(db, 'adaptive_difficulty', teacherUid, 'students');
      const snaps = await getDocs(col);
      const result: Record<string, StudentDifficultyDoc> = {};
      snaps.forEach(s => {
        result[s.id] = s.data() as StudentDifficultyDoc;
      });
      return result;
    } catch {
      return {};
    }
  },
};
