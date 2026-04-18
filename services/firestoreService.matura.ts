import { logger } from '../utils/logger';
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
import type { MaturaCurriculumRefs, StudentMaturaProfile, MaturaTrack } from '../types';
import {
  cacheMaturaExamQuestions,
  getCachedMaturaExamQuestions,
} from './indexedDBService';

interface LocalMaturaRawQuestion {
  questionNumber: number;
  part: 1 | 2 | 3;
  points: number;
  questionType?: 'mc' | 'short' | 'open';
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
  solutionImageUrl?: string | null;
  successRatePercent?: number | null;
  conceptIds?: string[];
  curriculumRefs?: MaturaCurriculumRefs;
}

interface LocalMaturaRawExam {
  id: string;
  year: number;
  session: string;
  language: string;
  title: string;
  track?: string;
  gradeLevel?: number;
}

interface LocalMaturaRawDoc {
  exam: LocalMaturaRawExam;
  questions: LocalMaturaRawQuestion[];
}

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
  /**
   * mc    — избор на еден точен одговор (1 бод)
   * short — краток одговор (1–2 бода) — Концепција ДИЦ 2025, Државна стручна матура
   * open  — цела постапка / проширен одговор (2–4+ бода)
   */
  questionType?: 'mc' | 'short' | 'open';
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
  solutionImageUrl?: string | null;
  successRatePercent?: number | null;
  curriculumRefs?: MaturaCurriculumRefs;
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
  questionType?: 'mc' | 'short' | 'open';
}

export interface MaturaStoredGrade {
  score: number;
  maxPoints: number;
  feedback?: string;
}

export interface MaturaStoredResult {
  examId: string;
  examTitle: string;
  grades: Record<number, MaturaStoredGrade>;
  totalScore: number;
  maxScore: number;
  durationSeconds: number;
  completedAt: string;
  completedAtTs: number;
  source?: 'local' | 'firestore';
}

// ─── Module-level cache ───────────────────────────────────────────────────────

let _examCache: MaturaExamMeta[] | null = null;
const _questionCache = new Map<string, MaturaQuestion[]>();
let _localCache: { exams: MaturaExamMeta[]; byExam: Map<string, MaturaQuestion[]> } | null = null;

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
    // 'short' (краток одговор) and 'open' (цела постапка) are both non-MC
    const isNonMc = q.questionType === 'open' || q.questionType === 'short' || (!q.choices || !Object.keys(q.choices).length);
    if (f.questionType === 'mc'   &&  isNonMc)  return false;
    if (f.questionType === 'open' && !isNonMc)  return false;
    return true;
  });
}

function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('/')) return url;
  if (url.startsWith('data/matura/images/')) {
    return `/${url.slice('data/'.length)}`;
  }
  return url;
}

function sortExams(exams: MaturaExamMeta[]): MaturaExamMeta[] {
  return exams.sort((a, b) =>
    b.year - a.year ||
    a.session.localeCompare(b.session) ||
    a.language.localeCompare(b.language),
  );
}

function getLocalMaturaData(): { exams: MaturaExamMeta[]; byExam: Map<string, MaturaQuestion[]> } {
  if (_localCache) return _localCache;

  const modules = import.meta.glob('../data/matura/raw/*.json', { eager: true });
  const exams: MaturaExamMeta[] = [];
  const byExam = new Map<string, MaturaQuestion[]>();

  // First pass: separate key files from regular exam files
  const keyFiles = new Map<string, LocalMaturaRawDoc>(); // e.g. "dim-gymnasium-2022-june" → doc
  const examDocs: LocalMaturaRawDoc[] = [];

  Object.values(modules).forEach((mod) => {
    const parsed = (mod as { default?: LocalMaturaRawDoc }).default ?? (mod as LocalMaturaRawDoc);
    if (!parsed?.exam?.id || !Array.isArray(parsed?.questions)) return;

    if (parsed.exam.id.endsWith('-key')) {
      // Strip "-key" suffix to get the base exam id (e.g. "dim-gymnasium-2022-june")
      const baseKey = parsed.exam.id.slice(0, -4);
      keyFiles.set(baseKey, parsed);
    } else {
      examDocs.push(parsed);
    }
  });

  // Helper: given an exam id like "dim-gymnasium-2022-june-mk", get the base key
  function baseKeyFor(examId: string): string {
    // Remove language suffix: -mk, -al, -tr (last segment after final -)
    // Only strip known language codes — prevents corrupting IDs that legitimately end with two letters
    return examId.replace(/-(mk|al|tr)$/, '');
  }

  // Build solution lookup from key files: baseKey → Map<questionNumber, {aiSolution, solutionImageUrl}>
  const keySolutions = new Map<string, Map<number, { aiSolution?: string | null; solutionImageUrl?: string | null }>>();
  keyFiles.forEach((doc, baseKey) => {
    const solMap = new Map<number, { aiSolution?: string | null; solutionImageUrl?: string | null }>();
    doc.questions.forEach(q => {
      if (q.aiSolution || q.solutionImageUrl) {
        solMap.set(q.questionNumber, { aiSolution: q.aiSolution, solutionImageUrl: q.solutionImageUrl });
      }
    });
    keySolutions.set(baseKey, solMap);
  });

  // Second pass: build exams and merge key solutions
  examDocs.forEach((parsed) => {
    const totalPoints = parsed.questions.reduce((sum, q) => sum + (q.points || 0), 0);
    exams.push({
      id: parsed.exam.id,
      year: parsed.exam.year,
      session: parsed.exam.session,
      language: parsed.exam.language,
      title: parsed.exam.title,
      track: parsed.exam.track,
      gradeLevel: parsed.exam.gradeLevel,
      questionCount: parsed.questions.length,
      totalPoints,
      importedAt: 'local-fallback',
    });

    const baseKey = baseKeyFor(parsed.exam.id);
    const solMap = keySolutions.get(baseKey);

    const questions: MaturaQuestion[] = parsed.questions
      .map((q) => {
        const keySol = solMap?.get(q.questionNumber);
        return {
          examId: parsed.exam.id,
          year: parsed.exam.year,
          session: parsed.exam.session,
          language: parsed.exam.language,
          questionNumber: q.questionNumber,
          part: q.part,
          points: q.points,
          questionType: q.questionType,
          questionText: q.questionText,
          choices: q.choices,
          correctAnswer: q.correctAnswer,
          topic: q.topic,
          topicArea: q.topicArea,
          dokLevel: q.dokLevel,
          hasImage: q.hasImage,
          imageUrls: (q.imageUrls ?? []).map(normalizeImageUrl),
          imageDescription: q.imageDescription,
          conceptIds: q.conceptIds,
          hints: q.hints,
          // Own aiSolution takes priority; fall back to key file solution
          aiSolution: q.aiSolution ?? keySol?.aiSolution ?? null,
          solutionImageUrl: q.solutionImageUrl ?? keySol?.solutionImageUrl ?? null,
          successRatePercent: q.successRatePercent,
          curriculumRefs: q.curriculumRefs,
        };
      })
      .sort((a, b) => a.questionNumber - b.questionNumber);

    byExam.set(parsed.exam.id, questions);
  });

  _localCache = { exams: sortExams(exams), byExam };
  return _localCache;
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
      const firestoreExams = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as MaturaExamMeta))
      if (firestoreExams.length > 0) {
        _examCache = sortExams(firestoreExams);
        return _examCache;
      }

      const local = getLocalMaturaData();
      _examCache = local.exams;
      return _examCache;
    } catch (e) {
      const local = getLocalMaturaData();
      if (local.exams.length > 0) {
        _examCache = local.exams;
        return _examCache;
      }
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
      const questions = snap.docs
        .map(d => d.data() as MaturaQuestion)
        .sort((a, b) => a.questionNumber - b.questionNumber);

      if (!questions.length) {
        const local = getLocalMaturaData().byExam.get(examId) ?? [];
        _questionCache.set(examId, local);
        return local;
      }

      _questionCache.set(examId, questions);
      // Write-through to IndexedDB for offline practice (non-blocking).
      void cacheMaturaExamQuestions(examId, questions);
      return questions;
    } catch (e) {
      // П22: try IndexedDB offline cache first (30-day TTL).
      try {
        const offline = await getCachedMaturaExamQuestions(examId);
        if (offline && offline.length > 0) {
          const cached = offline as MaturaQuestion[];
          _questionCache.set(examId, cached);
          return cached;
        }
      } catch {
        // ignore and continue to local bundled fallback
      }
      const local = getLocalMaturaData().byExam.get(examId);
      if (local) {
        _questionCache.set(examId, local);
        return local;
      }
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

// ─── User Matura Results (Phase 2) ──────────────────────────────────────────

function userResultDocId(examId: string, completedAt: string): string {
  const ts = Number.isFinite(new Date(completedAt).getTime())
    ? new Date(completedAt).getTime()
    : Date.now();
  return `${examId}_${ts}`;
}

export async function saveUserMaturaResult(
  uid: string,
  result: Omit<MaturaStoredResult, 'completedAtTs' | 'source'>,
): Promise<void> {
  try {
    const completedAtTs = Number.isFinite(new Date(result.completedAt).getTime())
      ? new Date(result.completedAt).getTime()
      : Date.now();

    const docId = userResultDocId(result.examId, result.completedAt);
    await setDoc(doc(db, 'users', uid, 'maturaResults', docId), {
      ...result,
      completedAtTs,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    // Non-critical: local result remains source-of-truth fallback for immediate UX.
    logger.warn('saveUserMaturaResult failed', e);
  }
}

export async function getUserMaturaResults(uid: string): Promise<MaturaStoredResult[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'maturaResults'),
      orderBy('completedAtTs', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as MaturaStoredResult;
      return { ...data, source: 'firestore' as const };
    });
  } catch (e) {
    logger.warn('getUserMaturaResults failed', e);
    return [];
  }
}

// ─── Recovery Missions (M5.5) ─────────────────────────────────────────────────

export type MissionStatus = 'pending' | 'completed' | 'skipped';

export interface MaturaMissionDay {
  day: number;             // 1–7
  topicArea: string;
  dokLevel: number;
  label: string;          // display label e.g. "Алгебра DoK 2"
  status: MissionStatus;
  completedAt?: string;
  pctAfter?: number;
}

export interface MaturaMissionPlan {
  id: string;              // Firestore doc id: uid_createdAtTs
  uid: string;
  sourceConceptId: string;
  sourceConceptTitle: string;
  createdAt: string;
  endsAt: string;          // createdAt + 7 days
  days: MaturaMissionDay[];
  streakCount: number;     // consecutive completed days
  badgeEarned: boolean;    // true when all 7 days completed
}

function missionDocId(uid: string, createdAt: string): string {
  const ts = Number.isFinite(new Date(createdAt).getTime())
    ? new Date(createdAt).getTime()
    : Date.now();
  return `${uid}_${ts}`;
}

/** Create (or overwrite) a new 7-day mission plan for the user. */
export async function saveMaturaMissionPlan(uid: string, plan: MaturaMissionPlan): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid, 'maturaMissions', plan.id),
      { ...plan, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    logger.warn('saveMaturaMissionPlan failed', e);
  }
}

/** Fetch the most-recent active (non-expired, not fully badged) mission plan. */
export async function getActiveMaturaMission(uid: string): Promise<MaturaMissionPlan | null> {
  try {
    const q = query(
      collection(db, 'users', uid, 'maturaMissions'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const all = snap.docs.map((d) => d.data() as MaturaMissionPlan);
    // Return the newest plan that is not expired (within 7 days)
    const now = Date.now();
    const active = all.find((p) => new Date(p.endsAt).getTime() > now);
    return active ?? all[0]; // fall back to newest if all expired
  } catch (e) {
    logger.warn('getActiveMaturaMission failed', e);
    return null;
  }
}

/**
 * Build a fresh 7-day mission plan from a single source concept.
 * Topic areas cycle across the week to maintain variety.
 */
export function buildMissionPlan(
  uid: string,
  sourceConceptId: string,
  sourceConceptTitle: string,
  primaryTopicArea: string,
): MaturaMissionPlan {
  const createdAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = missionDocId(uid, createdAt);

  const topicVariants = [primaryTopicArea, 'algebra', 'analiza', 'geometrija', 'trigonometrija'].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  const DOK_SEQUENCE = [1, 2, 2, 3, 2, 3, 3];
  const TOPIC_LABELS: Record<string, string> = {
    algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
    trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
    broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
  };

  const days: MaturaMissionDay[] = DOK_SEQUENCE.map((dokLevel, i) => {
    const topicArea = topicVariants[i % topicVariants.length];
    return {
      day: i + 1,
      topicArea,
      dokLevel,
      label: `${TOPIC_LABELS[topicArea] ?? topicArea} · DoK ${dokLevel}`,
      status: 'pending',
    };
  });

  // Day 1 always focuses on the source concept's primary topic
  days[0].topicArea = primaryTopicArea;
  days[0].label = `${TOPIC_LABELS[primaryTopicArea] ?? primaryTopicArea} · DoK ${days[0].dokLevel}`;

  return { id, uid, sourceConceptId, sourceConceptTitle, createdAt, endsAt, days, streakCount: 0, badgeEarned: false };
}

// ─── PDF Import helpers ───────────────────────────────────────────────────────

export interface MaturaImportQuestion {
  questionNumber: number;
  part: 1 | 2 | 3;
  points: number;
  questionType: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string> | null;
  correctAnswer?: string;
  topic?: string;
  topicArea?: string;
  dokLevel?: number;
}

export interface MaturaImportDraft {
  examId: string;
  title: string;
  year: number;
  session: string;
  language: string;
  track: string;
  gradeLevel: number;
  durationMinutes: number;
  questions: MaturaImportQuestion[];
}

/**
 * Persists an AI-extracted matura draft to Firestore.
 * Writes matura_exams/{examId} + matura_questions/{examId}_qNN docs.
 * Invalidates the in-memory exam cache so the library reflects the new exam.
 */
export async function importMaturaFromDraft(draft: MaturaImportDraft): Promise<void> {
  const now = new Date().toISOString();
  const totalPoints = draft.questions.reduce((s, q) => s + (q.points || 0), 0);

  // Exam metadata
  await setDoc(doc(db, 'matura_exams', draft.examId), {
    id: draft.examId,
    year: draft.year,
    session: draft.session,
    language: draft.language,
    title: draft.title,
    track: draft.track,
    gradeLevel: draft.gradeLevel,
    durationMinutes: draft.durationMinutes,
    questionCount: draft.questions.length,
    totalPoints,
    importedAt: now,
    importedVia: 'pdf_ocr',
  }, { merge: true });

  // Questions
  for (const q of draft.questions) {
    const docId = `${draft.examId}_q${String(q.questionNumber).padStart(2, '0')}`;
    await setDoc(doc(db, 'matura_questions', docId), {
      examId: draft.examId,
      year: draft.year,
      session: draft.session,
      language: draft.language,
      track: draft.track,
      gradeLevel: draft.gradeLevel,
      questionNumber: q.questionNumber,
      part: q.part,
      points: q.points,
      questionType: q.questionType,
      questionText: q.questionText,
      choices: q.choices ?? null,
      correctAnswer: q.correctAnswer ?? null,
      topic: q.topic ?? null,
      topicArea: q.topicArea ?? null,
      dokLevel: q.dokLevel ?? null,
      imageUrls: [],
      hasImage: false,
      importedVia: 'pdf_ocr',
      createdAt: now,
    }, { merge: true });
  }

  // Invalidate cache so MaturaLibraryView re-fetches
  _examCache = null;
}

// ─── Student Matura Profile ────────────────────────────────────────────────────

const STUDENT_PROFILES_COL = 'student_matura_profiles';

const DEFAULT_PROFILE = (uid: string, name: string, email: string | undefined, photoURL: string | undefined, track: MaturaTrack): StudentMaturaProfile => ({
  uid,
  name,
  email,
  photoURL,
  track,
  examDate: '2026-06-06',
  createdAt: new Date().toISOString(),
  weakTopics: [],
  practiceStats: { correct: 0, total: 0, byTopic: {} },
  simulationCount: 0,
  bestSimulationScore: 0,
  streak: { count: 0, lastDate: '' },
  isPremium: false,
});

export async function getStudentMaturaProfile(uid: string): Promise<StudentMaturaProfile | null> {
  try {
    const snap = await getDoc(doc(db, STUDENT_PROFILES_COL, uid));
    return snap.exists() ? (snap.data() as StudentMaturaProfile) : null;
  } catch {
    return null;
  }
}

export async function createStudentMaturaProfile(
  uid: string,
  name: string,
  email: string | undefined,
  photoURL: string | undefined,
  track: MaturaTrack,
): Promise<StudentMaturaProfile> {
  const profile = DEFAULT_PROFILE(uid, name, email, photoURL, track);
  await setDoc(doc(db, STUDENT_PROFILES_COL, uid), profile, { merge: true });
  return profile;
}

export async function updateStudentMaturaProfile(
  uid: string,
  updates: Partial<StudentMaturaProfile>,
): Promise<void> {
  await setDoc(doc(db, STUDENT_PROFILES_COL, uid), updates, { merge: true });
}
