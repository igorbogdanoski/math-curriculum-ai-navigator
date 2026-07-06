import { logger } from '../utils/logger';
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { MMNode } from './gemini/mindmap';

export interface SavedMindMap {
  id: string;
  teacherUid: string;
  topic: string;
  gradeLevel: number;
  nodes: MMNode[];
  updatedAt?: unknown;
}

const COLLECTION = 'mind_maps';
const MY_MAPS_LIMIT = 50;

/**
 * Saves a mind map — creates a new doc, or updates in place when `existingId` is passed
 * (mirrors createAnnualPlan/updateAnnualPlan's create-vs-update split in
 * firestoreService.materials.ts, kept as a single function here since the payload shape
 * is identical either way).
 */
export async function saveMindMap(
  teacherUid: string,
  topic: string,
  gradeLevel: number,
  nodes: MMNode[],
  existingId?: string,
): Promise<string> {
  if (existingId) {
    await updateDoc(doc(db, COLLECTION, existingId), { topic, gradeLevel, nodes, updatedAt: serverTimestamp() });
    return existingId;
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    teacherUid, topic, gradeLevel, nodes, updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Lists a teacher's saved mind maps, newest first, for the "Мои карти" selector. */
export async function fetchMyMindMaps(teacherUid: string): Promise<SavedMindMap[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('teacherUid', '==', teacherUid), orderBy('updatedAt', 'desc'), limit(MY_MAPS_LIMIT)),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedMindMap));
  } catch (error) {
    logger.error('Error fetching mind maps:', error);
    return [];
  }
}

/** Loads a single saved mind map by id. */
export async function fetchMindMap(id: string): Promise<SavedMindMap | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as SavedMindMap;
  } catch (error) {
    logger.error('Error fetching mind map:', error);
    return null;
  }
}
