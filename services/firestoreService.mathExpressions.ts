import { logger } from '../utils/logger';
import {
  addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface SavedMathExpression {
  id: string;
  teacherUid: string;
  latex: string;
  label?: string;
  updatedAt?: unknown;
}

const COLLECTION = 'math_expressions';
const MY_EXPRESSIONS_LIMIT = 50;

/**
 * Saves a LaTeX expression from the Math Editor — previously history was
 * `useState<string[]>([])` in MathEditorView.tsx, lost on every reload. Mirrors
 * saveMindMap's shape (firestoreService.mindMaps.ts) for the same "save a named
 * creation" use case.
 */
export async function saveExpression(teacherUid: string, latex: string, label?: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    teacherUid, latex, label: label ?? null, updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Lists a teacher's saved expressions, newest first, for the Math Editor's history dropdown. */
export async function fetchMyExpressions(teacherUid: string): Promise<SavedMathExpression[]> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION), where('teacherUid', '==', teacherUid), orderBy('updatedAt', 'desc'), limit(MY_EXPRESSIONS_LIMIT)),
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedMathExpression));
  } catch (error) {
    logger.error('Error fetching math expressions:', error);
    return [];
  }
}
