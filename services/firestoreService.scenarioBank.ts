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
  query, where, orderBy, limit, increment,
  serverTimestamp, type Timestamp, type DocumentSnapshot, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { firestorePage } from './firestorePagination';
import type { LessonPlan, BloomsLevel, SecondaryTrack, AIGeneratedThematicPlan } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TeachingModel = '5E' | 'PBL' | 'ZPD' | 'Cooperative' | 'Traditional';
export type EntryType = 'lesson_plan' | 'kahoot' | 'extracted_material' | 'generated_material' | 'thematic_plan';

export interface ScenarioBankEntry {
  /** Discriminates between lesson plans, kahoot quizzes, and extracted materials */
  entryType?: EntryType;
  id: string;
  // Core content (denormalised for fast browse without loading fullPlan)
  title: string;
  grade: number;
  /** Required context for grade > 9 (гимназиско vs стручно) — undefined for primary grades */
  secondaryTrack?: SecondaryTrack | null;
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
  /** Denormalised name/uid of the root author in the fork chain — set once at first fork, threaded through unchanged on re-forks */
  originalAuthorName?: string;
  originalAuthorUid?: string;
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

/** Shared query-constraint builder for both fetchScenarios and fetchScenariosForSearch. */
function buildScenarioConstraints(filters: ScenarioBankFilter) {
  const constraints: Parameters<typeof query>[1][] = [
    where('deleted', '==', false),
    where('isPublic', '==', true),
  ];

  if (filters.grade != null) constraints.push(where('grade', '==', filters.grade));
  if (filters.verifiedOnly) constraints.push(where('verifiedByBRO', '==', true));

  const sortField =
    filters.sortBy === 'forks' ? 'forkCount' :
    filters.sortBy === 'usage' ? 'usageCount' :
    'publishedAt';

  constraints.push(orderBy(sortField, 'desc'));
  return constraints;
}

function matchesClientFilters(entry: ScenarioBankEntry, filters: ScenarioBankFilter): boolean {
  if (filters.dokLevel != null && entry.dokLevel !== filters.dokLevel) return false;
  if (filters.teachingModel && entry.teachingModel !== filters.teachingModel) return false;
  return true;
}

function applyClientFilters(entries: ScenarioBankEntry[], filters: ScenarioBankFilter): ScenarioBankEntry[] {
  return entries.filter(s => matchesClientFilters(s, filters));
}

export interface ScenarioPage {
  entries: ScenarioBankEntry[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Cursor-paginated browse fetch — one page at a time (default 48). Only ever searches
 * within whichever pages have been loaded so far; for full-collection search use
 * fetchScenariosForSearch instead (this function alone is what made scenarios beyond
 * the first page structurally invisible to the old, non-paginated search box).
 */
export const fetchScenarios = async (
  filters: ScenarioBankFilter = {},
  pageLimit = 24,
  cursor?: DocumentSnapshot,
): Promise<ScenarioPage> => {
  const hasClientFilters = filters.dokLevel != null || filters.teachingModel != null;
  // Each "page" is a page of RAW Firestore docs; client-side filters (dokLevel/
  // teachingModel, which Firestore can't query natively) are applied for display within
  // that raw page, over-fetched by 40 to reduce how often a page under-fills after
  // filtering. A filtered page may show fewer than pageLimit results — clicking "Load
  // more" again fetches the next raw page, same as before pagination existed.
  const rawPageSize = hasClientFilters ? pageLimit + 40 : pageLimit;
  const { items, hasMore, lastDoc } = await firestorePage<ScenarioBankEntry>({
    collectionName: 'scenario_bank',
    constraints: buildScenarioConstraints(filters),
    pageSize: rawPageSize,
    // `cursor` always originates from a previous page's own `lastDoc` (a real query
    // result doc), so this narrowing is safe despite the public signature's wider type.
    cursor: cursor as QueryDocumentSnapshot | undefined,
    filter: hasClientFilters ? (s) => matchesClientFilters(s, filters) : undefined,
    errorTag: 'scenario_bank (browse)',
  });

  // Preserve this function's existing contract: `lastDoc: null` signals "no more
  // pages" (unlike firestorePage's own `lastDoc`, which is the current page's last
  // doc regardless of `hasMore`).
  return { entries: items, lastDoc: hasMore ? lastDoc : null, hasMore };
};

export interface ScenarioSearchPage {
  entries: ScenarioBankEntry[];
  truncated: boolean;
}

/**
 * One-shot, generously-capped fetch used only while an active search query exists —
 * separate from fetchScenarios' cheap per-page browse fetch so that searching a query
 * actually reaches the whole collection instead of whatever page happens to be loaded.
 */
export const fetchScenariosForSearch = async (
  filters: ScenarioBankFilter = {},
  cap = 500,
): Promise<ScenarioSearchPage> => {
  const constraints = buildScenarioConstraints(filters);
  constraints.push(limit(cap));

  const snap = await getDocs(query(collection(db, 'scenario_bank'), ...constraints));
  let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as ScenarioBankEntry));
  const truncated = results.length >= cap;
  results = applyClientFilters(results, filters);

  return { entries: results, truncated };
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
  const { items, hasMore, lastDoc } = await firestorePage<ScenarioBankEntry>({
    collectionName: 'scenario_bank',
    constraints: [where('deleted', '==', false), orderBy('publishedAt', 'desc')],
    pageSize,
    cursor: cursor as QueryDocumentSnapshot | undefined,
    errorTag: 'scenario_bank (admin)',
  });
  // Same null-when-no-more contract as fetchScenarios above.
  return { entries: items, lastDoc: hasMore ? lastDoc : null, hasMore };
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
  originalAuthorName?: string;
  originalAuthorUid?: string;
  verifiedByBRO?: boolean;
  isPublic?: boolean;
  authorNotes?: string;
}

export const publishScenario = async (p: PublishScenarioPayload): Promise<string> => {
  const bloomLevels = extractBloomLevels(p.plan);
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    title: p.plan.title,
    grade: p.plan.grade,
    secondaryTrack: p.plan.secondaryTrack ?? null,
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
    originalAuthorName: p.originalAuthorName,
    originalAuthorUid: p.originalAuthorUid,
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
    authorNotes: `Kahoot квиз — ${p.questionCount} прашања`,
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
    authorNotes: 'Извлечен материјал',
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

export interface PublishThematicPlanPayload {
  title: string;
  grade: number;
  secondaryTrack?: SecondaryTrack | null;
  topicTitle: string;
  plan: AIGeneratedThematicPlan;
  authorUid: string;
  authorName: string;
  schoolName?: string;
  isPublic?: boolean;
  authorNotes?: string;
  originalId?: string;
  forkDepth?: number;
  originalAuthorName?: string;
  originalAuthorUid?: string;
}

/** Publish a thematic plan to the Scenario Bank — reuses its existing public gallery, rules, and fork/rate mechanics instead of a parallel collection. */
export const publishThematicPlanToBank = async (p: PublishThematicPlanPayload): Promise<string> => {
  const ref = await addDoc(collection(db, 'scenario_bank'), {
    entryType: 'thematic_plan' as EntryType,
    title: p.title,
    grade: p.grade,
    secondaryTrack: p.secondaryTrack ?? null,
    subject: 'Математика',
    topicTitle: p.topicTitle,
    objectives: [],
    scenarioIntro: '',
    scenarioMain: [],
    scenarioConcluding: '',
    materials: [],
    assessmentStandards: [],
    generatedContent: p.plan as unknown as Record<string, unknown>,
    generatedMaterialType: 'thematicplan',
    bloomLevels: [],
    dokLevel: null,
    teachingModel: null,
    duration: 0,
    authorUid: p.authorUid,
    authorName: p.authorName,
    schoolName: p.schoolName ?? '',
    originalId: p.originalId ?? null,
    forkDepth: p.forkDepth ?? 0,
    originalAuthorName: p.originalAuthorName,
    originalAuthorUid: p.originalAuthorUid,
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
  let newId: string;
  const originalAuthorName = original.originalAuthorName ?? original.authorName;
  const originalAuthorUid = original.originalAuthorUid ?? original.authorUid;
  if (original.entryType === 'thematic_plan' && original.generatedContent) {
    newId = await publishThematicPlanToBank({
      title: original.title,
      grade: original.grade,
      secondaryTrack: original.secondaryTrack,
      topicTitle: original.topicTitle,
      plan: original.generatedContent as unknown as AIGeneratedThematicPlan,
      authorUid,
      authorName,
      schoolName,
      originalId: original.originalId ?? original.id,
      forkDepth: (original.forkDepth ?? 0) + 1,
      originalAuthorName,
      originalAuthorUid,
    });
  } else {
    newId = await publishScenario({
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
      originalAuthorName,
      originalAuthorUid,
    });
  }
  // Increment forkCount on original (or root if this is already a fork)
  const rootId = original.originalId ?? original.id;
  await updateDoc(doc(db, 'scenario_bank', rootId), { forkCount: increment(1) });
  return newId;
};

/** Toggle public visibility of a scenario (teacher's own entries only) */
export const setScenarioPublic = async (entryId: string, isPublic: boolean): Promise<void> => {
  await updateDoc(doc(db, 'scenario_bank', entryId), { isPublic });
};

/**
 * Updates metadata (pedagogical model, DoK level, lesson-study notes) on an already-published
 * scenario in place — for scenarios published without these set (e.g. imported without a chosen
 * model) or that just need correcting. Unlike `publishScenario`, never creates a new document.
 */
export interface ScenarioMetadataPatch {
  teachingModel?: TeachingModel | null;
  dokLevel?: 1 | 2 | 3 | 4 | null;
  authorNotes?: string;
}
export const updateScenarioMetadata = async (entryId: string, patch: ScenarioMetadataPatch): Promise<void> => {
  // updateDoc's UpdateData<DocumentData> requires an index signature a named interface doesn't structurally carry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(doc(db, 'scenario_bank', entryId), patch as any);
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
