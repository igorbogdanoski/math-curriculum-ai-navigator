/**
 * firestoreService.matura.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All Firestore I/O for the Matura module (M2, M3, M4, M5).
 *
 * Collections:
 *   matura_exams/{examId}        — lightweight exam metadata
 *   matura_questions/{examId_qN} — one doc per question
 *
 * Caching strategy:
 *   Module-level singletons survive re-renders but reset on full page reload.
 *   Exam list:      cached after first fetch (rarely changes).
 *   Question lists: cached per examId — avoids redundant reads in M2↔M3 switch.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { OfflineError, FirestoreError } from '../utils/errors';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface MaturaExamMeta {
  id: string;
  year: number;
  session: string;          // 'june' | 'august' | 'march' …
  language: string;         // 'mk' | 'al' | 'tr'
  title: string;
  track?: string;
  gradeLevel?: number;
  questionCount: number;
  totalPoints: number;
  importedAt: string;
}

export interface MaturaQuestion {
  examId: string;
  year: number;
  session: string;
  language: string;
  questionNumber: number;
  part: 1 | 2 | 3;
  points: number;
  questionType?: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string> | null;
  correctAnswer: string;
  topic?: string;
  topicArea?: string;
  dokLevel?: number;
  hasImage?: boolean;
  imageUrls?: string[];
  imageDescription?: string | null;
  hints?: string[];
  aiSolution?: string | null;
  successRatePercent?: number | null;
}

/** Cached AI grade result stored in `matura_ai_grades/{cacheKey}`. */
export interface AIGradeCache {
  examId: string;
  questionNumber: number;
  inputHash: string;
  score: number;
  maxPoints: number;
  feedback: string;
  cachedAt?: unknown; // Firestore serverTimestamp
}

export interface MaturaQueryFilters {
  topicAreas?: string[];
  parts?: number[];
  dokLevels?: number[];
  questionType?: 'mc' | 'open';
}

// ─── Module-level cache ───────────────────────────────────────────────────────

let _examCache: MaturaExamMeta[] | null = null;
const _questionCache = new Map<string, MaturaQuestion[]>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapFirestoreError(e: any, op: string): never {
  if (e?.code === 'unavailable' || e?.message?.includes('offline')) {
    throw new OfflineError('Офлајн — проверете ја врската и обидете се повторно.');
  }
  // Already typed error — rethrow
  if (e?.userMessage) throw e;
  throw new FirestoreError(op as any, String(e?.message ?? e));
}

function applyFilters(qs: MaturaQuestion[], f: MaturaQueryFilters): MaturaQuestion[] {
  return qs.filter(q => {
    if (f.topicAreas?.length && !f.topicAreas.includes(q.topicArea ?? '')) return false;
    if (f.parts?.length     && !f.parts.includes(q.part))                  return false;
    if (f.dokLevels?.length && !f.dokLevels.includes(q.dokLevel ?? 1))     return false;
    if (f.questionType === 'mc'   &&  (q.questionType === 'open' || (!q.choices || !Object.keys(q.choices).length))) return false;
    if (f.questionType === 'open' && !(q.questionType === 'open' || (!q.choices || !Object.keys(q.choices).length))) return false;
    return true;
  });
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const maturaService = {

  /**
   * List all exams from Firestore (cached after first call).
   * Sorted: newest year first, then by session, then by language.
   */
  async listExams(): Promise<MaturaExamMeta[]> {
    if (_examCache) return _examCache;
    try {
      const snap = await getDocs(collection(db, 'matura_exams'));
      _examCache = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MaturaExamMeta))
        .sort((a, b) =>
          b.year - a.year ||
          a.session.localeCompare(b.session) ||
          a.language.localeCompare(b.language),
        );
      return _examCache;
    } catch (e) {
      wrapFirestoreError(e, 'read');
    }
  },

  /**
   * Fetch all questions for a single exam (cached per examId).
   * Returns questions ordered by questionNumber.
   */
  async getExamQuestions(examId: string): Promise<MaturaQuestion[]> {
    if (_questionCache.has(examId)) return _questionCache.get(examId)!;
    try {
      const q = query(
        collection(db, 'matura_questions'),
        where('examId', '==', examId),
        orderBy('questionNumber'),
      );
      const snap = await getDocs(q);
      const questions = snap.docs.map(d => d.data() as MaturaQuestion);
      _questionCache.set(examId, questions);
      return questions;
    } catch (e) {
      wrapFirestoreError(e, 'read');
    }
  },

  /**
   * Fetch questions for multiple exams in parallel (each individually cached).
   * Optionally apply filters client-side.
   */
  async getMultiExamQuestions(
    examIds: string[],
    filters?: MaturaQueryFilters,
  ): Promise<MaturaQuestion[]> {
    if (!examIds.length) return [];
    const results = await Promise.all(examIds.map(id => this.getExamQuestions(id)));
    const all = results.flat();
    return filters ? applyFilters(all, filters) : all;
  },

  /**
   * Return unique topic areas across the given exams.
   * Uses cache — only fetches exams not yet loaded.
   */
  async getTopicAreas(examIds: string[]): Promise<string[]> {
    const qs = await this.getMultiExamQuestions(examIds);
    return [...new Set(qs.map(q => q.topicArea).filter(Boolean))] as string[];
  },

  /** Invalidate caches (useful after a re-import or admin action). */
  clearCache() {
    _examCache = null;
    _questionCache.clear();
  },
};

// ─── AI Grade Cache ───────────────────────────────────────────────────────────

/**
 * Simple djb2 hash — produces a short alphanumeric key from an answer string.
 * Not cryptographic; used only as a cache discriminator.
 */
function hashAnswer(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(36); // base-36 → compact
}

/**
 * Build a Firestore-safe document ID for an AI grade cache entry.
 * Format: `{examId}_q{questionNumber}_{answerHash}`
 */
export function buildGradeCacheKey(
  examId: string,
  questionNumber: number,
  studentAnswer: string,
): string {
  return `${examId}_q${questionNumber}_${hashAnswer(studentAnswer.trim().toLowerCase())}`;
}

/**
 * Look up a previously cached AI grade. Returns null on cache miss.
 * Silently swallows errors — grading must never fail due to cache issues.
 */
export async function getCachedAIGrade(cacheKey: string): Promise<AIGradeCache | null> {
  try {
    const snap = await getDoc(doc(db, 'matura_ai_grades', cacheKey));
    if (!snap.exists()) return null;
    return snap.data() as AIGradeCache;
  } catch {
    return null;
  }
}

/**
 * Persist an AI grade result. Fire-and-forget; failures are silently ignored
 * so a Firestore write error never blocks the student from seeing their grade.
 */
export function saveAIGrade(cacheKey: string, grade: Omit<AIGradeCache, 'cachedAt'>): void {
  setDoc(doc(db, 'matura_ai_grades', cacheKey), {
    ...grade,
    cachedAt: serverTimestamp(),
  }).catch(() => {/* non-critical */});
}
