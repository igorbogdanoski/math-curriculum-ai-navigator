/**
 * Curriculum Overrides — Firestore Service (T4)
 *
 * Allows school admins to extend the static curriculum with custom concepts
 * and topics, stored in Firestore under `curriculum_overrides/{ownerUid}`.
 *
 * Architecture: overlay pattern — static local data is never modified.
 * Custom additions are merged on top at runtime in useCurriculum.ts.
 *
 * Collection: curriculum_overrides
 * Document:   {ownerUid}
 * Shape:      CurriculumOverridesDoc
 */

import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomConcept {
  id: string;           // e.g. "custom_{uid}_{timestamp}"
  title: string;
  description: string;
  assessmentStandards: string[];
  activities: string[];
  priorKnowledgeIds: string[];
  /** ownerUid of the admin who added it */
  createdBy: string;
  createdAt: string;    // ISO
}

export interface CustomTopic {
  id: string;           // e.g. "custom-topic_{uid}_{timestamp}"
  title: string;
  description: string;
  suggestedHours: number;
  concepts: CustomConcept[];
  createdBy: string;
  createdAt: string;
}

export interface ConceptAddition {
  /** Target grade id, e.g. "grade-1" */
  gradeId: string;
  /** Target topic id, e.g. "grade1-topic-1" */
  topicId: string;
  concept: CustomConcept;
}

export interface TopicAddition {
  gradeId: string;
  topic: CustomTopic;
}

export interface CurriculumOverridesDoc {
  ownerUid: string;
  addedConcepts: ConceptAddition[];
  addedTopics: TopicAddition[];
  updatedAt: string;
}

const COLLECTION = 'curriculum_overrides';

// ── Service ───────────────────────────────────────────────────────────────────

export async function fetchCurriculumOverrides(ownerUid: string): Promise<CurriculumOverridesDoc | null> {
  try {
    const ref = doc(db, COLLECTION, ownerUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as CurriculumOverridesDoc;
  } catch {
    return null;
  }
}

export async function saveCurriculumOverrides(overrides: CurriculumOverridesDoc): Promise<void> {
  const ref = doc(db, COLLECTION, overrides.ownerUid);
  await setDoc(ref, { ...overrides, updatedAt: new Date().toISOString() }, { merge: false });
}

export async function addConceptOverride(
  ownerUid: string,
  gradeId: string,
  topicId: string,
  concept: Omit<CustomConcept, 'id' | 'createdBy' | 'createdAt'>,
): Promise<void> {
  const existing = await fetchCurriculumOverrides(ownerUid);
  const newConcept: CustomConcept = {
    ...concept,
    id: `custom_${ownerUid.slice(-6)}_${Date.now()}`,
    createdBy: ownerUid,
    createdAt: new Date().toISOString(),
  };
  const doc_: CurriculumOverridesDoc = existing ?? {
    ownerUid,
    addedConcepts: [],
    addedTopics: [],
    updatedAt: new Date().toISOString(),
  };
  doc_.addedConcepts.push({ gradeId, topicId, concept: newConcept });
  await saveCurriculumOverrides(doc_);
}

export async function updateConceptOverride(
  ownerUid: string,
  conceptId: string,
  patch: Partial<Pick<CustomConcept, 'title' | 'description' | 'assessmentStandards' | 'activities' | 'priorKnowledgeIds'>>,
): Promise<void> {
  const existing = await fetchCurriculumOverrides(ownerUid);
  if (!existing) return;
  existing.addedConcepts = existing.addedConcepts.map(a =>
    a.concept.id === conceptId ? { ...a, concept: { ...a.concept, ...patch } } : a,
  );
  await saveCurriculumOverrides(existing);
}

export async function deleteConceptOverride(ownerUid: string, conceptId: string): Promise<void> {
  const existing = await fetchCurriculumOverrides(ownerUid);
  if (!existing) return;
  existing.addedConcepts = existing.addedConcepts.filter(a => a.concept.id !== conceptId);
  await saveCurriculumOverrides(existing);
}

export async function addTopicOverride(
  ownerUid: string,
  gradeId: string,
  topic: Omit<CustomTopic, 'id' | 'createdBy' | 'createdAt' | 'concepts'>,
): Promise<void> {
  const existing = await fetchCurriculumOverrides(ownerUid);
  const newTopic: CustomTopic = {
    ...topic,
    id: `custom-topic_${ownerUid.slice(-6)}_${Date.now()}`,
    concepts: [],
    createdBy: ownerUid,
    createdAt: new Date().toISOString(),
  };
  const doc_: CurriculumOverridesDoc = existing ?? {
    ownerUid,
    addedConcepts: [],
    addedTopics: [],
    updatedAt: new Date().toISOString(),
  };
  doc_.addedTopics.push({ gradeId, topic: newTopic });
  await saveCurriculumOverrides(doc_);
}

export const curriculumOverridesService = {
  fetchCurriculumOverrides,
  saveCurriculumOverrides,
  addConceptOverride,
  updateConceptOverride,
  deleteConceptOverride,
  addTopicOverride,
};
