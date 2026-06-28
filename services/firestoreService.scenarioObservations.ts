/**
 * Scenario Observations — Firestore Service (S88-D2)
 *
 * Japanese Lesson Study "Kenkyuu Jugyou" observation protocol.
 * Teachers who delivered or observed a lesson leave structured notes.
 *
 * Collection: scenario_observations
 * Document:   auto-id
 */

import {
  collection, addDoc, getDocs,
  query, where, orderBy, serverTimestamp, type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface ScenarioObservation {
  id: string;
  scenarioId: string;
  /** UID of the observing teacher */
  authorUid: string;
  authorName: string;
  schoolName: string;
  role: 'delivered' | 'observed';
  /** What worked well */
  whatWorked: string;
  /** What would you change */
  whatToImprove: string;
  /** Student engagement level 1–5 */
  engagementLevel: 1 | 2 | 3 | 4 | 5;
  /** Bloom taxonomy levels activated during this lesson */
  bloomLevels?: string[];
  /** Grade level this was observed at */
  observedGrade: number;
  observedAt: Timestamp | null;
}

const COLLECTION = 'scenario_observations';

export const submitObservation = async (payload: Omit<ScenarioObservation, 'id' | 'observedAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...payload,
    observedAt: serverTimestamp(),
  });
  return ref.id;
};

export const fetchObservations = async (scenarioId: string): Promise<ScenarioObservation[]> => {
  const snap = await getDocs(
    query(collection(db, COLLECTION),
      where('scenarioId', '==', scenarioId),
      orderBy('observedAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScenarioObservation));
};
