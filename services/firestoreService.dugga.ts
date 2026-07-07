import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, serverTimestamp, Timestamp, increment, limit,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { firestorePage } from './firestorePagination';

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
  | 'unit_circle_pick'
  | 'proof_steps'
  | 'geometry_construct'
  | 'feynman_explain'
  | 'proof_critique'
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

/** Expected slider transform for a `function_match` question (S61-C2 / S62-E2). */
export interface DuggaExpectedTransform {
  /** Base function key (aligned with BASE_FUNCTIONS in functionTransformerHelpers). */
  fnKey: 'sin' | 'cos' | 'tan' | 'log' | 'sq' | 'sqrt' | 'abs' | 'cube'
       | 'logBase' | 'expBase' | 'recip' | 'polyN' | 'linear';
  /** Target transform parameters student must reproduce: y = a·f(b·x + c) + d. */
  target: { a: number; b: number; c: number; d: number };
  /** Extra function-specific parameters (base for log/exp, n for polyN). */
  extraParams?: { base?: number; n?: number };
  /** Slider min/max per parameter; defaults to ±5 for a/b/d and ±π for c. */
  ranges?: {
    a?: [number, number];
    b?: [number, number];
    c?: [number, number];
    d?: [number, number];
    base?: [number, number];
    n?: [number, number];
  };
}

/** A single labelled step in a `proof_steps` question (S61-C4). */
export interface DuggaProofStep {
  id: string;
  text: string;
  /** Optional justification (theorem / axiom / definition reference). */
  justification?: string;
}

/** Expected proof structure for a `proof_steps` question (S61-C4). */
export interface DuggaExpectedProof {
  /** The correct ordered sequence of steps the student must reproduce. */
  steps: DuggaProofStep[];
  /** Optional distractor steps mixed into the picker; choosing them costs points. */
  distractors?: DuggaProofStep[];
  /**
   * Penalty per distractor selected, in the same units as the per-step
   * weight (1.0 ≙ a fully correctly placed expected step). Default 0.5.
   */
  distractorPenalty?: number;
}

/** Expected GeoGebra construction for a `geometry_construct` question (S61-C5). */
export interface DuggaExpectedConstruction {
  /** Plain-language description of what the student must construct. */
  description: string;
  /** Optional teacher rubric the AI grader should follow (line-separated). */
  rubric?: string;
  /** Optional GeoGebra material id to seed the embed. */
  materialId?: string;
  /** Optional initial GeoGebra XML/JSON state. */
  initialState?: string;
  /** Maximum AI score weight (default 1.0 = full points). */
  maxScoreWeight?: number;
}

/** Expected unit-circle target for a `unit_circle_pick` question (S61-C3). */
export interface DuggaExpectedUnitCirclePick {
  /** Target angle. */
  angle: number;
  /** Angle unit; degrees or radians. */
  unit: 'deg' | 'rad';
  /**
   * Optional explicit (x, y) coordinates on the unit circle. When omitted
   * the grader uses (cos θ, sin θ) derived from `angle`.
   */
  point?: { x: number; y: number };
  /**
   * What the student must submit:
   *   • 'angle' — only the angle value matters,
   *   • 'point' — only (x, y) match against the unit circle,
   *   • 'either' (default) — accept whichever the student provided.
   */
  match?: 'angle' | 'point' | 'either';
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
  /** Expected proof for `proof_steps` question (S61-C4). */
  expectedProof?: DuggaExpectedProof;
  /** Expected unit-circle target for `unit_circle_pick` question (S61-C3). */
  expectedUnitCircle?: DuggaExpectedUnitCirclePick;
  /**
   * Absolute tolerance for the angle (in the unit specified by
   * `expectedUnitCircle.unit`) and for each (x, y) coordinate. Default 0.05.
   */
  unitCircleTolerance?: number;
  /** Expected construction for `geometry_construct` question (S61-C5). */
  expectedConstruction?: DuggaExpectedConstruction;
  /** Concept name the student must explain Feynman-style (S63-C). */
  feynmanConcept?: string;
  /** Steps of a deliberately flawed proof for `proof_critique` questions. */
  proofCritiqueSteps?: string[];
  /** 0-based index of the step that contains the deliberate error. */
  proofCritiqueErrorStep?: number;
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

  // Provenance tracking (edit / adapt from library) -------------------------
  /** ID of the test this was cloned/adapted from, if any. */
  adaptedFromId?: string;
  /** Title of the original test at the time of adaptation. */
  adaptedFromTitle?: string;
  /** Display name of the original author. */
  originalAuthorName?: string;
  /** UID of the original author. */
  originalAuthorUid?: string;
  /** UID of the last user who edited this test. */
  lastEditedByUid?: string;
  /** Display name of the last editor. */
  lastEditedByName?: string;
  /** Number of times other teachers adapted this test — incremented on the ORIGINAL test only. */
  adaptCount?: number;

  // S61-E1 — Final exam mode (state-recognised exam) -------------------------
  /**
   * When true the test is treated as a high-stakes final exam: the player
   * locks the session, shuffles questions per student, disables hints,
   * pauses on visibility loss (S61-E2), and seals the submission with a
   * SHA-256 hash on submit (S61-E3).
   */
  finalExamMode?: boolean;
  /** Optional ISO datetime when the exam window opens. */
  finalExamOpensAt?: Timestamp | string;
  /** Optional ISO datetime when the exam window closes. */
  finalExamClosesAt?: Timestamp | string;
  /** Per-student randomisation: shuffle question order. Default true under finalExamMode. */
  shuffleQuestions?: boolean;
  /** Per-student randomisation: shuffle answer options. Default true under finalExamMode. */
  shuffleOptions?: boolean;
  /** Disable in-question hints during the exam. Default true under finalExamMode. */
  disableHints?: boolean;
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

  // S61-E3 — Tamper-evident seal for final-exam submissions ----------------
  /**
   * SHA-256 hex of `${testId}|${studentUid}|${stableJSON(answers)}` taken at
   * submit time. Stored only when the parent test had `finalExamMode=true`.
   * Used to prove the submission has not been altered after the fact.
   */
  submissionSeal?: string;
  /** ISO datetime the seal was computed (typically equal to submittedAt). */
  submissionSealedAt?: string;
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

/** Increment the "times adapted" counter on the original test — call once, when a new adapted test is first created. */
export const incrementDuggaAdaptCount = async (originalTestId: string): Promise<void> => {
  await updateDoc(doc(db, 'dugga_tests', originalTestId), { adaptCount: increment(1) });
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
    limit(200),
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as DuggaTest)));
  });
};

/**
 * Cursor-paginated one-time fetch for the public Dugga library tab — replaces a
 * previously-unbounded live onSnapshot listener on the entire public dugga_tests
 * collection (every teacher who opened the tab downloaded and real-time-synced ALL
 * public tests, with no cap, re-rendering on any unrelated write). This collection
 * actively grows (unlike communityLessonPlans), so it needs real pagination rather
 * than a one-time full fetch — same firestorePage helper already used by
 * fetchLibraryPage/fetchGlobalLibraryPage.
 */
export const fetchPublicDuggaTestsPage = async (
  pageSize = 30,
  cursor?: QueryDocumentSnapshot,
): Promise<{ items: DuggaTest[]; hasMore: boolean; lastDoc: QueryDocumentSnapshot | null }> => {
  return firestorePage<DuggaTest>({
    collectionName: 'dugga_tests',
    constraints: [
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
    ],
    pageSize,
    cursor,
    errorTag: 'public Dugga tests',
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

export const fetchStudentDuggaSubmissions = async (studentUid: string): Promise<DuggaSubmission[]> => {
  const q = query(
    collection(db, 'dugga_submissions'),
    where('studentUid', '==', studentUid),
    orderBy('submittedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DuggaSubmission));
};

export const fetchStudentDuggaSubmissionsByName = async (studentName: string): Promise<DuggaSubmission[]> => {
  const snap = await getDocs(query(
    collection(db, 'dugga_submissions'),
    where('studentName', '==', studentName.trim()),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as DuggaSubmission))
    .sort((a, b) => {
      const ta = a.submittedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.submittedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    });
};
