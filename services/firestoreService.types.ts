import type { Timestamp } from 'firebase/firestore';
import type { DifferentiationLevel } from '../types';

/**
 * Tracks a student's mastery of a specific concept over time.
 * Stored in Firestore under: concept_mastery/{studentName}_{conceptId}
 *
 * Mastery is achieved when the student scores ≥85% on 3+ consecutive attempts.
 */
export interface ConceptMastery {
  studentName: string;
  conceptId: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  teacherUid?: string;
  deviceId?: string;
  attempts: number;
  consecutiveHighScores: number;
  bestScore: number;
  lastScore: number;
  mastered: boolean;
  masteredAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LiveSession {
  id: string;
  hostUid: string;
  quizId: string;
  quizTitle: string;
  conceptId?: string;
  status: 'active' | 'ended';
  joinCode: string;
  studentResponses: Record<string, {
    status: 'joined' | 'in_progress' | 'completed';
    percentage?: number;
    completedAt?: Timestamp;
  }>;
  createdAt?: Timestamp;
  /** S47 — mkd-slidea async homework mode: session stays joinable until this timestamp */
  homeworkDeadline?: Timestamp | null;
  homeworkMode?: boolean;
}

export interface StudentGroup {
  id: string;
  name: string;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple';
  studentNames: string[];
  teacherUid?: string;
  createdAt?: Timestamp;
}

export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  teacherUid: string;
  studentNames: string[];
  joinCode?: string;
  joinCodeGeneratedAt?: any;
  iepStudents?: string[]; // П-Г: names of students with IEP (teacher-only flag)
  createdAt?: Timestamp;
}

export interface ClassMembership {
  deviceId: string;
  classId: string;
  className: string;
  gradeLevel: number;
  teacherUid: string;
  studentName?: string;
  joinedAt?: Timestamp;
}

export interface Assignment {
  id: string;
  title: string;
  materialType: 'QUIZ' | 'ASSESSMENT' | 'RECOVERY_WORKSHEET';
  /** Required for QUIZ/ASSESSMENT; empty string for RECOVERY_WORKSHEET */
  cacheId: string;
  teacherUid: string;
  classId: string;
  classStudentNames: string[];
  dueDate: string;
  createdAt?: Timestamp;
  completedBy: string[];
  /** Populated only for RECOVERY_WORKSHEET — concept IDs to practice */
  recoveryConceptIds?: string[];
}

export interface StudentGamification {
  studentName: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  achievements: string[];
  totalQuizzes: number;
  deviceId?: string;
  teacherUid?: string;
}

export const ACHIEVEMENTS: Record<string, { label: string; icon: string; condition: (g: StudentGamification) => boolean }> = {
  first_quiz:          { label: 'Прв квиз',             icon: '🎉', condition: g => g.totalQuizzes >= 1 },
  quiz_10:             { label: 'Десетти квиз',          icon: '🔟', condition: g => g.totalQuizzes >= 10 },
  quiz_50:             { label: 'Педесеттар',            icon: '💯', condition: g => g.totalQuizzes >= 50 },
  streak_3:            { label: 'Тридневна серија',      icon: '🔥', condition: g => g.longestStreak >= 3 },
  streak_7:            { label: 'Недела напред',         icon: '⚡', condition: g => g.longestStreak >= 7 },
  score_90:            { label: 'Одличен',               icon: '⭐', condition: () => false },
  mastered_1:          { label: 'Мајстор',               icon: '🎓', condition: () => false },
  mastered_5:          { label: 'Академик',              icon: '🏆', condition: () => false },
  mastered_10:         { label: 'Ерудит',                icon: '🦉', condition: () => false },
  pythagorean_master:  { label: 'Питагорин ученик',      icon: '📐', condition: g => g.achievements.includes('mastered_1') },
  euler_path:          { label: 'Ојлеров пат',           icon: '🔢', condition: g => g.longestStreak >= 5 },
  golden_ratio:        { label: 'Златен однос',          icon: '✨', condition: () => false },
};

export interface QuizResult {
  quizId: string;
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  playedAt?: Timestamp;
  conceptId?: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  studentName?: string;
  teacherUid?: string;
  deviceId?: string;
  differentiationLevel?: DifferentiationLevel;
  confidence?: number;
  misconceptions?: { question: string; studentAnswer: string; misconception: string }[];
  metacognitiveNote?: string; // П4 — рефлексивна белешка на ученикот по квизот
  classId?: string;           // И2 — одделение на ученикот (доколку се приклучил)
  dokLevel?: 1 | 2 | 3 | 4;  // S37-C1 DoK heatmap (explicit; falls back to differentiationLevel mapping)
}

export interface Announcement {
  id: string;
  teacherUid: string;
  message: string;
  gradeLevel?: number;
  createdAt?: Timestamp;
}

export interface CachedMaterial {
  id: string;
  content: unknown;
  type: 'analogy' | 'outline' | 'quiz' | 'discussion' | 'problems' | 'assessment' | 'rubric' | 'thematicplan' | 'ideas' | 'solver' | 'package';
  title?: string;
  conceptId?: string;
  topicId?: string;
  gradeLevel: number;
  teacherUid?: string;
  status?: 'draft' | 'published';
  embedding?: number[];
  createdAt: Timestamp;
  helpfulCount?: number;
  notHelpfulCount?: number;
  isApproved?: boolean;
  archivedAt?: Timestamp | null;
  // И3 — Teacher Collaboration
  ratingsByUid?: Record<string, number>; // uid → 1-5, max 1 rating per teacher (updatable)
  publishedByUid?: string;
  publishedByName?: string;
  publisherIsMentor?: boolean; // П-Д: true when publisher has mentor status
  isForked?: boolean;
  sourceId?: string;
  sourceAuthor?: string;
  /** PRO feature: false = private (only visible to owning teacher); default true = public library */
  isPublic?: boolean;
  isRecoveryWorksheet?: boolean;
  reviewStatus?: 'draft' | 'approved' | 'rejected';
  teacherNotes?: string;
  approvalRef?: string;
  removedQuestionIds?: number[];
  sourceQuizId?: string;
  contentHash?: string;
}

export interface RecoveryWorksheetApproval {
  id: string;
  teacherUid: string;
  conceptId?: string;
  topicId?: string;
  gradeLevel?: number;
  title: string;
  approvedQuestionCount: number;
  removedQuestionIds?: number[];
  teacherNotes?: string;
  classId?: string;
  assignedStudentCount?: number;
  createdAt?: Timestamp;
}

// ─── S46: Central Exam Mode ───────────────────────────────────────────────────

export type ExamVariantKey = 'A' | 'B' | 'V' | 'G';

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'calculation';
  question: string;
  options?: string[];
  answer: string;
  solution?: string;
  points: number;
  svgDiagram?: string;
}

export interface ExamSession {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  variants: Record<ExamVariantKey, ExamQuestion[]>;
  duration: number; // seconds
  joinCode: string; // 6 digits
  status: 'draft' | 'waiting' | 'active' | 'ended';
  createdBy: string; // uid
  createdAt?: Timestamp;
  startedAt?: Timestamp;
  endsAt?: Timestamp;
  totalPoints: number;
}

export interface ExamResponse {
  id: string; // studentId / deviceId
  sessionId: string;
  studentName: string;
  variantKey: ExamVariantKey;
  answers: Record<string, string>; // q0, q1, ...
  photoUrls?: Record<string, string>;
  status: 'joined' | 'solving' | 'submitted';
  submittedAt?: Timestamp;
  timeRemainingOnSubmit?: number;
  score?: number;
  maxScore?: number;
  aiFeedback?: { questionId: string; correct: boolean; points: number; feedback: string }[];
  gradedAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────────────────────

export type AIMaterialType = 'assessment' | 'ideas' | 'presentation' | 'lesson_plan' | 'rubric' | 'annual_plan' | 'learning_paths' | 'illustration' | 'other';

export type AIMaterialFeedbackAction =
  | 'edit_started'
  | 'edit_saved'
  | 'edit_regenerated'
  | 'reject_edit'
  | 'reject_visual'
  | 'accept_saved';

export interface AIMaterialFeedbackEvent {
  id: string;
  teacherUid: string;
  materialType: AIMaterialType;
  action: AIMaterialFeedbackAction;
  materialId?: string;
  context?: string;
  occurredAt?: Timestamp;
}

export interface AIMaterialFeedbackSummaryRow {
  materialType: AIMaterialType;
  total: number;
  editEvents: number;
  rejectEvents: number;
  acceptEvents: number;
}

export interface AIMaterialFeedbackSummary {
  windowDays: number;
  totalEvents: number;
  byMaterialType: AIMaterialFeedbackSummaryRow[];
}
