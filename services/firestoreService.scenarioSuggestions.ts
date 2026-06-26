/**
 * Scenario Suggestions — Firestore Service (S88-D)
 *
 * Japanese Lesson Study "Predlozi izmena" workflow.
 * A teacher proposes a revision to a shared scenario.
 * The original author can accept (auto-fork with attribution) or reject.
 *
 * Collection: scenario_suggestions
 * Document:   auto-id
 */

import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, serverTimestamp, type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { forkScenario } from './firestoreService.scenarioBank';
import type { ScenarioBankEntry } from './firestoreService.scenarioBank';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface ScenarioSuggestion {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  /** UID of the original scenario author */
  targetAuthorUid: string;
  /** Who is suggesting */
  authorUid: string;
  authorName: string;
  schoolName: string;
  /** Free-form suggestion text */
  suggestionText: string;
  /** Specific section being revised: intro / main / concluding / general */
  section: 'intro' | 'main' | 'concluding' | 'objectives' | 'general';
  status: SuggestionStatus;
  createdAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  /** If accepted: ID of the forked scenario created from this suggestion */
  resultScenarioId: string | null;
}

const COLLECTION = 'scenario_suggestions';

export const submitSuggestion = async (payload: {
  scenario: ScenarioBankEntry;
  authorUid: string;
  authorName: string;
  schoolName: string;
  section: ScenarioSuggestion['section'];
  suggestionText: string;
}): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    scenarioId: payload.scenario.id,
    scenarioTitle: payload.scenario.title,
    targetAuthorUid: payload.scenario.authorUid,
    authorUid: payload.authorUid,
    authorName: payload.authorName,
    schoolName: payload.schoolName,
    suggestionText: payload.suggestionText,
    section: payload.section,
    status: 'pending' as SuggestionStatus,
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resultScenarioId: null,
  });
  return ref.id;
};

/** Fetch pending suggestions for a scenario author to review */
export const fetchSuggestionsForAuthor = async (
  targetAuthorUid: string,
): Promise<ScenarioSuggestion[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('targetAuthorUid', '==', targetAuthorUid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScenarioSuggestion));
};

/** Fetch suggestions on a specific scenario */
export const fetchSuggestionsForScenario = async (
  scenarioId: string,
): Promise<ScenarioSuggestion[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('scenarioId', '==', scenarioId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScenarioSuggestion));
};

/** Accept a suggestion: auto-fork the scenario, mark suggestion resolved */
export const acceptSuggestion = async (
  suggestion: ScenarioSuggestion,
  originalScenario: ScenarioBankEntry,
): Promise<string> => {
  const newId = await forkScenario(
    originalScenario,
    suggestion.authorUid,
    suggestion.authorName,
    suggestion.schoolName,
  );
  await updateDoc(doc(db, COLLECTION, suggestion.id), {
    status: 'accepted' as SuggestionStatus,
    resolvedAt: serverTimestamp(),
    resultScenarioId: newId,
  });
  return newId;
};

export const rejectSuggestion = async (suggestionId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, suggestionId), {
    status: 'rejected' as SuggestionStatus,
    resolvedAt: serverTimestamp(),
  });
};
