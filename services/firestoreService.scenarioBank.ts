/**
 * Scenario Bank — Firestore Service (S88-C)
 *
 * Japanese Lesson Study Hub + OER remixing model.
 * Collection: `scenario_bank`
 * Document: ScenarioBankEntry
 *
 * Attribution chain: originalId → forkDepth tracks remix lineage.
 * verifiedByBRO marks official content from д-р Кондинска / МОН advisors.
 */

import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, increment, startAfter,
  serverTimestamp, type Timestamp, type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { LessonPlan, BloomsLevel } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TeachingModel = '5E' | 'PBL' | 'ZPD' | 'Cooperative' | 'Traditional';
export type EntryType = 'lesson_plan' | 'kahoot' | 'extracted_material' | 'generated_material';

export interface ScenarioBankEntry {
  /** Discriminates between lesson plans, kahoot quizzes, and extracted materials */
  entryType?: EntryType;
  id: string;
  // Core content (denormalised for fast browse without loading fullPlan)
  title: string;
  grade: number;
  subject: string;
  topicTitle: string;
  objectives: string[];
  scenarioIntro: string;
  scenarioMain: string[];
  scenarioConcluding: string;
  materials: string[];
  assessmentStandards: string[];
  /** Full plan stored for remix — may be absent for BRO seed entries */
  fullPlan?: LessonPlan;
  /** Raw generated material payload (worksheet/quiz/test JSON) — used when entryType is 'generated_material' */
  generatedContent?: Record<string, unknown>;
  /** Original generator material type (e.g. 'quiz', 'assessment', 'rubric', 'ideas', 'package') */
  generatedMaterialType?: string;
  // Discovery metadata
  bloomLevels: BloomsLevel[];
  dokLevel: 1 | 2 | 3 | 4 | null;
  teachingModel: TeachingModel | null;
  duration: number;
  // Attribution
  authorUid: string;
  authorName: string;
  schoolName: string;
  originalId: string | null;
  forkDepth: number;
  // Community
  publishedAt: Timestamp | null;
  forkCount: number;
  usageCount: number;
  ratingsByUid: Record<string, number>;
  savedByUids: string[];
  // Quality
  verifiedByBRO: boolean;
  isFeatured: boolean;
  deleted: boolean;
  /** false = private (Pro only). true = visible in public bank. Default: true */
  isPublic: boolean;
  /** Optional reflection / lesson-study notes added by author */
  authorNotes: string;
}

export interface ScenarioBankFilter {
  grade?: number | null;
  topicKeyword?: string;
  dokLevel?: number | null;
  bloomLevel?: number | null;
  teachingModel?: TeachingModel | null;
  verifiedOnly?: boolean;
  sortBy?: 'rating' | 'date' | 'forks' | 'usage';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getAvgRating(entry: ScenarioBankEntry): number | null {
  const vals = entry.ratingsByUid ? Object.values(entry.ratingsByUid) : [];
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, r) => s + r, 0) / vals.length) * 10) / 10;
}

export function getUserRating(entry: ScenarioBankEntry, uid: string): number | null {
  return entry.ratingsByUid?.[uid] ?? null;
}

/** Extract bloom levels from a LessonPlan */
export function extractBloomLevels(plan: LessonPlan): BloomsLevel[] {
  const levels = new Set<BloomsLevel>();
  plan.objectives.forEach(o => { if (o.bloomsLevel) levels.add(o.bloomsLevel); });
  plan.scenario?.main?.forEach(m => { if (m.bloomsLevel) levels.add(m.bloomsLevel); });
  return [...levels];
}

// ── Read ──────────────────────────────────────────────────────────────────────

export const fetchScenarios = async (
  filters: ScenarioBankFilter = {},
  pageLimit = 24,
): Promise<ScenarioBankEntry[]> => {
  // Note: isPublic is filtered client-side to avoid needing a composite index
  // for every combination of equality fields + orderBy field.
  const constraints: Parameters<typeof query>[1][] = [
    where('deleted', '==', false),
  ];

  if (filters.grade != null) constraints.push(where('grade', '==', filters.grade));
  if (filters.dokLevel != null) constraints.push(where('dokLevel', '==', filters.dokLevel));
  if (filters.verifiedOnly) constraints.push(where('verifiedByBRO', '==', true));
  if (filters.teachingModel) constraints.push(where('teachingModel', '==', filters.teachingModel));

  const sortField =
    filters.sortBy === 'forks' ? 'forkCount' :
    filters.sortBy === 'usage' ? 'usageCount' :
    filters.sortBy === 'rating' ? 'publishedAt' :
    'publishedAt';

  constraints.push(orderBy(sortField, 'desc'));
  // Fetch extra to account for client-side isPublic filter
  constraints.push(limit(pageLimit + 20));

  const snap = await getDocs(query(collection(db, 'scenario_bank'), ...constraints));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry))
    .filter(s => s.isPublic)
    .slice(0, pageLimit);
};

export const fetchScenarioById = async (id: string): Promise<ScenarioBankEntry | null> => {
  const snap = await getDoc(doc(db, 'scenario_bank', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ScenarioBankEntry;
};

/** Admin-only: fetch ALL entries (public + private) with cursor-based pagination */
export const fetchAllAdmin = async (
  pageSize = 30,
  cursor?: DocumentSnapshot,
): Promise<{ entries: ScenarioBankEntry[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> => {
  const constraints: Parameters<typeof query>[1][] = [
    where('deleted', '==', false),
    orderBy('publishedAt', 'desc'),
    limit(pageSize + 1),
  ];
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, 'scenario_bank'), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const sliced = snap.docs.slice(0, pageSize);
  return {
    entries: sliced.map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry)),
    lastDoc: hasMore ? sliced[sliced.length - 1] : null,
    hasMore,
  };
};

export const fetchMyScenarios = async (uid: string): Promise<ScenarioBankEntry[]> => {
  const snap = await getDocs(
    query(collection(db, 'scenario_bank'),
      where('authorUid', '==', uid),
      where('deleted', '==', false),
      orderBy('publishedAt', 'desc'),
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry));
};

// ── Write ─────────────────────────────────────────────────────────────────────

export interface PublishScenarioPayload {
  plan: LessonPlan;
  authorUid: string;
  authorName: string;
  schoolName?: string;
  teachingModel?: TeachingModel;
  dokLevel?: 1 | 2 | 3 | 4 | null;
  originalId?: string;
  forkDepth?: number;
  verifiedByBRO?: boolean;
  isPublic?: boolean;
  authorNotes?: string;
}

export const publishScenario = async (p: PublishScenarioPayload): Promise<string> => {
  const bloomLevels = extractBloomLevels(p.plan);
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    title: p.plan.title,
    grade: p.plan.grade,
    subject: p.plan.subject || 'Математика',
    topicTitle: p.plan.theme || '',
    objectives: p.plan.objectives.map(o => o.text),
    scenarioIntro: p.plan.scenario?.introductory?.text ?? '',
    scenarioMain: p.plan.scenario?.main?.map(m => m.text) ?? [],
    scenarioConcluding: p.plan.scenario?.concluding?.text ?? '',
    materials: p.plan.materials ?? [],
    assessmentStandards: p.plan.assessmentStandards ?? [],
    fullPlan: p.plan,
    bloomLevels,
    dokLevel: p.dokLevel ?? null,
    teachingModel: p.teachingModel ?? null,
    duration: p.plan.grade && p.plan.grade > 9 ? 45 : 40,
    authorUid: p.authorUid,
    authorName: p.authorName,
    schoolName: p.schoolName ?? '',
    originalId: p.originalId ?? null,
    forkDepth: p.forkDepth ?? 0,
    publishedAt: serverTimestamp(),
    forkCount: 0,
    usageCount: 0,
    ratingsByUid: {},
    savedByUids: [],
    verifiedByBRO: p.verifiedByBRO ?? false,
    isFeatured: false,
    deleted: false,
    isPublic: p.isPublic ?? true,
    authorNotes: p.authorNotes ?? '',
  });
  return ref.id;
};

export interface SaveKahootPayload {
  title: string;
  grade: number;
  topicTitle: string;
  questionCount: number;
  authorUid: string;
  authorName: string;
  schoolName?: string;
  /** national_library doc ID for launch link */
  libraryDocId: string;
  /** Visibility — defaults to true (public, matches the unified save dialog default) */
  isPublic?: boolean;
}

/** Save a Kahoot quiz as a scenario bank entry */
export const saveKahootToBank = async (p: SaveKahootPayload): Promise<string> => {
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    entryType: 'kahoot' as EntryType,
    title: p.title,
    grade: p.grade,
    subject: 'Математика',
    topicTitle: p.topicTitle,
    objectives: [],
    scenarioIntro: '',
    scenarioMain: [],
    scenarioConcluding: '',
    materials: [],
    assessmentStandards: [],
    bloomLevels: [],
    dokLevel: null,
    teachingModel: null,
    duration: 20,
    authorUid: p.authorUid,
    authorName: p.authorName,
    schoolName: p.schoolName ?? '',
    originalId: null,
    forkDepth: 0,
    publishedAt: serverTimestamp(),
    forkCount: 0,
    usageCount: 0,
    ratingsByUid: {},
    savedByUids: [],
    verifiedByBRO: false,
    isFeatured: false,
    deleted: false,
    isPublic: p.isPublic ?? true,
    authorNotes: `Kahoot квиз — ${p.questionCount} прашања. libraryId: ${p.libraryDocId}`,
  });
  return ref.id;
};

export interface SaveExtractedMaterialPayload {
  title: string;
  grade?: number | string;
  topicId?: string;
  authorUid: string;
  authorName: string;
  schoolName?: string;
  libraryDocId: string;
  /** Visibility — defaults to true (public, matches the unified save dialog default) */
  isPublic?: boolean;
}

/** Save an extracted/OCR material as a scenario bank entry */
export const saveExtractedToBank = async (p: SaveExtractedMaterialPayload): Promise<string> => {
  const grade = Number(p.grade) || 0;
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    entryType: 'extracted_material' as EntryType,
    title: p.title,
    grade,
    subject: 'Математика',
    topicTitle: p.topicId ?? '',
    objectives: [],
    scenarioIntro: '',
    scenarioMain: [],
    scenarioConcluding: '',
    materials: [],
    assessmentStandards: [],
    bloomLevels: [],
    dokLevel: null,
    teachingModel: null,
    duration: 0,
    authorUid: p.authorUid,
    authorName: p.authorName,
    schoolName: p.schoolName ?? '',
    originalId: null,
    forkDepth: 0,
    publishedAt: serverTimestamp(),
    forkCount: 0,
    usageCount: 0,
    ratingsByUid: {},
    savedByUids: [],
    verifiedByBRO: false,
    isFeatured: false,
    deleted: false,
    isPublic: p.isPublic ?? true,
    authorNotes: `Извлечен материјал. libraryId: ${p.libraryDocId}`,
  });
  return ref.id;
};

export interface PublishGeneratedMaterialPayload {
  title: string;
  grade?: number;
  topicTitle?: string;
  materialType: string;
  content: Record<string, unknown>;
  authorUid: string;
  authorName: string;
  schoolName?: string;
  isPublic?: boolean;
  authorNotes?: string;
}

/** Save AI-generated worksheet/quiz/test/etc. as a scenario bank entry — unified national-bank path */
export const publishMaterialFromGenerator = async (p: PublishGeneratedMaterialPayload): Promise<string> => {
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    entryType: 'generated_material' as EntryType,
    title: p.title,
    grade: p.grade ?? 0,
    subject: 'Математика',
    topicTitle: p.topicTitle ?? '',
    objectives: [],
    scenarioIntro: '',
    scenarioMain: [],
    scenarioConcluding: '',
    materials: [],
    assessmentStandards: [],
    generatedContent: p.content,
    generatedMaterialType: p.materialType,
    bloomLevels: [],
    dokLevel: null,
    teachingModel: null,
    duration: 0,
    authorUid: p.authorUid,
    authorName: p.authorName,
    schoolName: p.schoolName ?? '',
    originalId: null,
    forkDepth: 0,
    publishedAt: serverTimestamp(),
    forkCount: 0,
    usageCount: 0,
    ratingsByUid: {},
    savedByUids: [],
    verifiedByBRO: false,
    isFeatured: false,
    deleted: false,
    isPublic: p.isPublic ?? true,
    authorNotes: p.authorNotes ?? '',
  });
  return ref.id;
};

/** Fork (remix) a scenario — creates a new entry, increments parent forkCount */
export const forkScenario = async (
  original: ScenarioBankEntry,
  authorUid: string,
  authorName: string,
  schoolName?: string,
): Promise<string> => {
  const newId = await publishScenario({
    plan: original.fullPlan ?? ({
      ...original,
      id: '',
      conceptIds: [],
      scenario: {
        introductory: { text: original.scenarioIntro },
        main: original.scenarioMain.map(t => ({ text: t })),
        concluding: { text: original.scenarioConcluding },
      },
    } as unknown as LessonPlan),
    authorUid,
    authorName,
    schoolName,
    teachingModel: original.teachingModel ?? undefined,
    originalId: original.originalId ?? original.id,
    forkDepth: (original.forkDepth ?? 0) + 1,
  });
  // Increment forkCount on original (or root if this is already a fork)
  const rootId = original.originalId ?? original.id;
  await updateDoc(doc(db, 'scenario_bank', rootId), { forkCount: increment(1) });
  return newId;
};

/** Toggle public visibility of a scenario (teacher's own entries only) */
export const setScenarioPublic = async (entryId: string, isPublic: boolean): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), { isPublic });
};

export const rateScenario = async (
  entryId: string,
  uid: string,
  stars: number,
): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), {
    [`ratingsByUid.${uid}`]: stars,
  });
};

export const toggleSaveScenario = async (
  entryId: string,
  uid: string,
  saved: boolean,
): Promise<void> => {
  const snap = await getDoc(doc(db, 'scenario_bank', entryId));
  if (!snap.exists()) return;
  const current: string[] = snap.data().savedByUids ?? [];
  const next = saved
    ? [...new Set([...current, uid])]
    : current.filter(u => u !== uid);
  await updateDoc(doc(db, 'scenario_bank', entryId), { savedByUids: next });
};

export const recordUsage = async (entryId: string): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), { usageCount: increment(1) });
};

export const deleteScenario = async (entryId: string): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), { deleted: true });
};

export const featureScenario = async (entryId: string, featured: boolean): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), { isFeatured: featured });
};
