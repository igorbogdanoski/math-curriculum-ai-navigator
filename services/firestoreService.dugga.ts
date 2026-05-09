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
  | 'student_chart'
  | 'function_match'
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

// ─── S61 — Per-question naставнички контроли ──────────────────────────────────

/**
 * Embedded interactive math tool the teacher can attach to an open-ended
 * question. `none` (default) hides the embed slot.
 */
export type DuggaEmbedTool =
  | 'none'
  | 'geogebra-graphing'
  | 'geogebra-cas'
  | 'geogebra-geometry'
  | 'geogebra-3d'
  | 'desmos-calc'
  | 'desmos-graph';

export interface DuggaEmbedConfig {
  /** GeoGebra material slug (e.g. "abc123") or Desmos calculator state hash. */
  materialId?: string;
  /** Initial state JSON / GeoGebra XML to seed the embed when student opens. */
  initialState?: string;
  /** Render height in px (default 420). */
  height?: number;
  /** When true, the student's tool state is captured into the submission. */
  persistState?: boolean;
}

/** Editor type for the student answer field on open-ended questions. */
export type DuggaAnswerInput = 'text' | 'math' | 'mixed';

/** Free-draw modes for student-submitted diagrams (S61-C1). */
export type DuggaDrawingMode = 'none' | 'bar-chart' | 'line-chart' | 'free-draw';

/** Expected slider transform for a `function_match` question (S61-C2). */
export interface DuggaExpectedTransform {
  /** Base function key (must align with BASE_FUNCTIONS in functionTransformerHelpers). */
  fnKey: 'sin' | 'cos' | 'tan' | 'log' | 'sq' | 'sqrt' | 'abs' | 'cube';
  /** Target transform parameters student must reproduce: y = a·f(b·x + c) + d. */
  target: { a: number; b: number; c: number; d: number };
  /** Slider min/max per parameter; defaults to ±5 for a/b/d and ±π for c. */
  ranges?: {
    a?: [number, number];
    b?: [number, number];
    c?: [number, number];
    d?: [number, number];
  };
}

/** Expected dataset for a `student_chart` question (S61-C1). */
export interface DuggaExpectedChart {
  /** Diagram kind expected from the student. */
  kind: 'bar' | 'line' | 'scatter' | 'pie';
  xLabel?: string;
  yLabel?: string;
  /** Ordered (x, y) pairs the student must reproduce. */
  data: Array<{ x: string | number; y: number }>;
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

  // S61-A1 — per-question naставнички контроли (сите опционални за бекф-компат).
  /** Allow the student to attach a photo of their handwritten solution via QR upload. */
  allowSolutionUpload?: boolean;
  /** Embedded interactive math tool the student can use while answering. */
  embedTool?: DuggaEmbedTool;
  embedConfig?: DuggaEmbedConfig;
  /** Override the default answer input editor for open-ended questions. */
  answerInput?: DuggaAnswerInput;
  /** Curriculum concept IDs this question is linked to (S61-D). */
  linkedConceptIds?: string[];
  /** Student-drawing canvas mode for diagram-style answers (S61-C1). */
  studentDrawingMode?: DuggaDrawingMode;
  /** Expected chart for `student_chart` question (S61-C1). */
  expectedChart?: DuggaExpectedChart;
  /** Tolerance percentage for numeric chart grading (default 5%). */
  chartTolerance?: number;
  /** Expected slider transform for `function_match` question (S61-C2). */
  expectedTransform?: DuggaExpectedTransform;
  /** Absolute tolerance per parameter (default 0.1). */
  transformTolerance?: number;
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
