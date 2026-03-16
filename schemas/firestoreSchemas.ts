/**
 * Zod runtime validation schemas for Firestore documents.
 *
 * Pattern: use safeParse so unknown extra fields are stripped (passthrough
 * is used on strict collections) but the app never crashes on bad data.
 * parseFirestoreDoc logs a warning for schema mismatches and falls back to
 * the raw data — backward-compatible with existing Firestore documents.
 */
import { z } from 'zod';

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Parse a Firestore document against a Zod schema.
 * - On success: returns the parsed (and stripped) data.
 * - On failure: logs a dev-warning with field-level details and returns the
 *   raw data cast to T so callers never receive undefined unexpectedly.
 */
export function parseFirestoreDoc<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    console.warn(`[Firestore schema] ${context ?? 'unknown doc'} — ${issues}`);
    return data as T; // fallback: don't break the app on legacy/partial docs
  }
  return result.data;
}

// ── Firestore Timestamp (opaque object — just check shape) ─────────────────
const TimestampSchema = z
  .object({ seconds: z.number(), nanoseconds: z.number() })
  .passthrough()
  .optional();

// ── TeachingProfile ────────────────────────────────────────────────────────
export const TeachingProfileSchema = z.object({
  name: z.string(),
  photoURL: z.string().optional(),
  role: z.enum(['teacher', 'school_admin', 'admin']).optional(),
  schoolId: z.string().optional(),
  schoolName: z.string().optional(),
  municipality: z.string().optional(),
  aiCreditsBalance: z.number().optional(),
  isPremium: z.boolean().optional(),
  hasUnlimitedCredits: z.boolean().optional(),
  tier: z.enum(['Free', 'Pro', 'Unlimited']).optional(),
  isMentor: z.boolean().optional(),
  style: z.enum(['Constructivist', 'Direct Instruction', 'Inquiry-Based', 'Project-Based']),
  experienceLevel: z.enum(['Beginner', 'Intermediate', 'Expert']),
  levelDescription: z.string().optional(),
  studentProfiles: z.array(z.unknown()).optional(),
  favoriteConceptIds: z.array(z.string()).optional(),
  favoriteLessonPlanIds: z.array(z.string()).optional(),
  toursSeen: z.record(z.string(), z.boolean()).optional(),
}).passthrough(); // allow unknown extra fields from legacy docs

export type TeachingProfileParsed = z.infer<typeof TeachingProfileSchema>;

// ── QuizResult ─────────────────────────────────────────────────────────────
export const QuizResultSchema = z.object({
  quizId: z.string(),
  quizTitle: z.string(),
  score: z.number(),
  correctCount: z.number(),
  totalQuestions: z.number(),
  percentage: z.number(),
  playedAt: TimestampSchema,
  conceptId: z.string().optional(),
  topicId: z.string().optional(),
  gradeLevel: z.number().optional(),
  studentName: z.string().optional(),
  teacherUid: z.string().optional(),
  deviceId: z.string().optional(),
  differentiationLevel: z.enum(['support', 'standard', 'advanced']).optional(),
  confidence: z.number().optional(),
  misconceptions: z.array(z.object({
    question: z.string(),
    studentAnswer: z.string(),
    misconception: z.string(),
  })).optional(),
  metacognitiveNote: z.string().optional(),
  classId: z.string().optional(),
}).passthrough();

export type QuizResultParsed = z.infer<typeof QuizResultSchema>;

// ── SchoolClass ────────────────────────────────────────────────────────────
export const SchoolClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  gradeLevel: z.number(),
  teacherUid: z.string(),
  studentNames: z.array(z.string()),
  joinCode: z.string().optional(),
  joinCodeGeneratedAt: z.unknown().optional(),
  iepStudents: z.array(z.string()).optional(),
  createdAt: TimestampSchema,
}).passthrough();

export type SchoolClassParsed = z.infer<typeof SchoolClassSchema>;

// ── ConceptMastery ─────────────────────────────────────────────────────────
export const ConceptMasterySchema = z.object({
  studentName: z.string(),
  conceptId: z.string(),
  conceptTitle: z.string().optional(),
  topicId: z.string().optional(),
  gradeLevel: z.number().optional(),
  teacherUid: z.string().optional(),
  deviceId: z.string().optional(),
  attempts: z.number(),
  consecutiveHighScores: z.number(),
  bestScore: z.number(),
  lastScore: z.number(),
  mastered: z.boolean(),
  masteredAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).passthrough();

// ── StudentGamification ────────────────────────────────────────────────────
export const StudentGamificationSchema = z.object({
  studentName: z.string(),
  totalXP: z.number(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  lastActivityDate: z.string(),
  achievements: z.array(z.string()),
  totalQuizzes: z.number(),
  deviceId: z.string().optional(),
  teacherUid: z.string().optional(),
}).passthrough();

// ── ClassMembership ────────────────────────────────────────────────────────
export const ClassMembershipSchema = z.object({
  deviceId: z.string(),
  classId: z.string(),
  className: z.string(),
  gradeLevel: z.number(),
  teacherUid: z.string(),
  studentName: z.string().optional(),
  joinedAt: TimestampSchema,
}).passthrough();
