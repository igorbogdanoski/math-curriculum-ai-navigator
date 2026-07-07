// ── Grade Book ────────────────────────────────────────────────────────────────

export type GradeModel = 'traditional' | 'mastery' | 'sbg';

export interface GradeEntry {
  studentId: string;
  studentName: string;
  testId: string;
  testTitle: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  /** Mastery model: 'mastered' | 'approaching' | 'not_yet' */
  masteryStatus?: 'mastered' | 'approaching' | 'not_yet';
  /** SBG: proficiency per standard id → 1-4 */
  standardScores?: Record<string, 1 | 2 | 3 | 4>;
  gradedAt: string;
  notes?: string;
  /** Set only when this entry was imported from a real quiz_results doc (not manually typed) — testId is the real quizId in that case, not a random UUID. */
  sourceQuizId?: string;
  /** Set only when imported from a Digital Exam session. */
  sourceExamSessionId?: string;
  conceptId?: string;
}

export interface GradeBookClass {
  id?: string;
  teacherUid: string;
  className: string;
  gradeLevel: number;
  model: GradeModel;
  entries: GradeEntry[];
  createdAt: string;
  updatedAt: string;
}
