import type { AssessmentQuestion } from './aiContent';

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

export interface LiveQuizSession {
    pin: string;
    teacherId: string;
    status: 'waiting' | 'active' | 'finished';
    questions: AssessmentQuestion[];
    currentQuestionIndex: number;
    title: string;
    createdAt: any;
}

export interface LiveQuizParticipant {
    id: string;
    name: string;
    score: number;
    answers: Record<string, string>; // questionId or index -> answer string
    joinedAt: any;
}
