import { logger } from '../utils/logger';
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { GradeBookClass, GradeEntry, GradeModel } from '../types';

const COLLECTION = 'grade_books';
const MY_GRADE_BOOKS_LIMIT = 100;

/**
 * Saves a grade book — creates a new doc, or updates in place when `existingId` is
 * passed (mirrors saveMindMap's create-vs-update split in firestoreService.mindMaps.ts).
 * Previously this was an inline addDoc in GradeBookView.tsx with no update path and no
 * read/list function anywhere — a teacher could only ever create a new gradebook, never
 * revisit or update a saved one.
 */
export async function saveGradeBook(
  teacherUid: string,
  className: string,
  gradeLevel: number,
  model: GradeModel,
  entries: GradeEntry[],
  existingId?: string,
): Promise<string> {
  if (existingId) {
    await updateDoc(doc(db, COLLECTION, existingId), { className, gradeLevel, model, entries, updatedAt: serverTimestamp() });
    return existingId;
  }
  const ref = await addDoc(collection(db, COLLECTION), {
    teacherUid, className, gradeLevel, model, entries, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Lists a teacher's saved grade books, newest first. */
export async function fetchMyGradeBooks(teacherUid: string): Promise<GradeBookClass[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('teacherUid', '==', teacherUid), orderBy('updatedAt', 'desc'), limit(MY_GRADE_BOOKS_LIMIT)),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as GradeBookClass));
  } catch (error) {
    logger.error('Error fetching grade books:', error);
    return [];
  }
}

/** Loads a single saved grade book by id. */
export async function fetchGradeBook(id: string): Promise<GradeBookClass | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as GradeBookClass;
  } catch (error) {
    logger.error('Error fetching grade book:', error);
    return null;
  }
}
