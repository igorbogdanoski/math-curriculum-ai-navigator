import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DuggaQuestionType =
  | 'multiple_choice'
  | 'checklist'
  | 'true_false'
  | 'inline_select'
  | 'multi_match'
  | 'fill_blanks'
  | 'short_answer'
  | 'list_items'
  | 'essay'
  | 'multi_part'
  | 'ordering'
  | 'diagram_annotate'
  | 'statement_eval'
  | 'interactive_table'
  | 'table_completion'
  | 'section_header';

export type DuggaTestType = 'topic' | 'midterm' | 'annual' | 'exam' | 'custom';
export type DuggaDok = 1 | 2 | 3 | 4;

export interface DuggaOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface DuggaMatchPair {
  left: string;
  right: string;
}

export interface DuggaQuestion {
  id: string;
  type: DuggaQuestionType;
  text: string;
  dok: DuggaDok;
  points: number;
  options?: DuggaOption[];
  correctAnswer?: string;
  matchPairs?: DuggaMatchPair[];
  solution?: string;
  hint?: string;
  imageUrl?: string;
  orderItems?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
}

export interface DuggaTest {
  id: string;
  title: string;
  description?: string;
  teacherUid: string;
  teacherName: string;
  grade: number;
  track: string;
  topics: string[];
  testType: DuggaTestType;
  questions: DuggaQuestion[];
  shareCode: string;
  isPublic: boolean;
  totalPoints: number;
  estimatedMinutes: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface DuggaSubmission {
  id: string;
  testId: string;
  testTitle: string;
  teacherUid: string;
  studentUid: string;
  studentName: string;
  answers: Record<string, string | string[]>;
  score: number;
  totalPoints: number;
  percentage: number;
  aiGradeNotes?: string;
  submittedAt: Timestamp;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Test CRUD ────────────────────────────────────────────────────────────────

export const createDuggaTest = async (data: Omit<DuggaTest, 'id' | 'shareCode' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'dugga_tests'), {
    ...data,
    shareCode: generateShareCode(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateDuggaTest = async (
  testId: string,
  data: Partial<Omit<DuggaTest, 'id' | 'createdAt'>>,
): Promise<void> => {
  await updateDoc(doc(db, 'dugga_tests', testId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteDuggaTest = async (testId: string): Promise<void> => {
  await deleteDoc(doc(db, 'dugga_tests', testId));
};

export const getDuggaTest = async (testId: string): Promise<DuggaTest | null> => {
  const snap = await getDoc(doc(db, 'dugga_tests', testId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DuggaTest;
};

export const getDuggaTestByCode = async (shareCode: string): Promise<DuggaTest | null> => {
  const q = query(collection(db, 'dugga_tests'), where('shareCode', '==', shareCode.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as DuggaTest;
};

export const subscribeMyDuggaTests = (
  teacherUid: string,
  onData: (tests: DuggaTest[]) => void,
): (() => void) => {
  const q = query(
    collection(db, 'dugga_tests'),
    where('teacherUid', '==', teacherUid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as DuggaTest)));
  });
};

export const subscribePublicDuggaTests = (
  onData: (tests: DuggaTest[]) => void,
): (() => void) => {
  const q = query(
    collection(db, 'dugga_tests'),
    where('isPublic', '==', true),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as DuggaTest)));
  });
};

// ─── Submissions ──────────────────────────────────────────────────────────────

export const submitDuggaTest = async (
  data: Omit<DuggaSubmission, 'id' | 'submittedAt'>,
): Promise<string> => {
  const ref = await addDoc(collection(db, 'dugga_submissions'), {
    ...data,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getTestSubmissions = async (testId: string): Promise<DuggaSubmission[]> => {
  const q = query(
    collection(db, 'dugga_submissions'),
    where('testId', '==', testId),
    orderBy('submittedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DuggaSubmission));
};
