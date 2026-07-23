import type { GradeEntry } from '../types';
import type { QuizResult, ExamSession, ExamResponse } from '../services/firestoreService.types';
import type { DuggaSubmission } from '../services/firestoreService.dugga';

function percentToMasteryStatus(p: number): GradeEntry['masteryStatus'] {
  if (p >= 80) return 'mastered';
  if (p >= 60) return 'approaching';
  return 'not_yet';
}

export interface QuizResultGroup {
  key: string;
  quizTitle: string;
  conceptId?: string;
  results: QuizResult[];
}

/**
 * Groups a teacher's quiz results by quiz+concept so they can pick ONE group to import
 * as a gradebook batch (one row per student who took that quiz). Results with no
 * `studentName` (anonymous/device-only) are dropped — there's nothing to attribute a
 * gradebook row to.
 */
export function groupQuizResultsForImport(results: QuizResult[]): QuizResultGroup[] {
  const map = new Map<string, QuizResultGroup>();
  for (const r of results) {
    if (!r.studentName) continue;
    const key = `${r.quizId}__${r.conceptId ?? ''}`;
    if (!map.has(key)) map.set(key, { key, quizTitle: r.quizTitle, conceptId: r.conceptId, results: [] });
    map.get(key)!.results.push(r);
  }
  return Array.from(map.values()).sort((a, b) => b.results.length - a.results.length);
}

/**
 * Maps one quiz-result group into gradebook entries, ready for teacher review before
 * saving. Unlike manually-typed entries (random UUID `testId`, no real link to
 * anything), imported entries carry the real `quizId`/`conceptId` through as
 * `sourceQuizId`/`conceptId`.
 */
export function mapQuizResultsToGradeEntries(group: QuizResultGroup): GradeEntry[] {
  return group.results.map(r => {
    const percentage = Math.round(r.percentage);
    return {
      studentId: crypto.randomUUID(),
      studentName: r.studentName!,
      testId: r.quizId,
      testTitle: r.quizTitle,
      rawScore: r.correctCount,
      maxScore: r.totalQuestions,
      percentage,
      masteryStatus: percentToMasteryStatus(percentage),
      gradedAt: r.playedAt ? r.playedAt.toDate().toISOString() : new Date().toISOString(),
      sourceQuizId: r.quizId,
      ...(r.conceptId ? { conceptId: r.conceptId } : {}),
    };
  });
}

// ── Dugga submissions ───────────────────────────────────────────────────────

export interface DuggaSubmissionGroup {
  key: string;
  testTitle: string;
  submissions: DuggaSubmission[];
}

/**
 * Groups a teacher's Dugga submissions by test — one group per test, one row per
 * student submission (a student submits a given test at most once, unlike quizzes
 * which can be replayed, so there's no dedup step here).
 */
export function groupDuggaSubmissionsForImport(submissions: DuggaSubmission[]): DuggaSubmissionGroup[] {
  const map = new Map<string, DuggaSubmissionGroup>();
  for (const s of submissions) {
    if (!s.studentName) continue;
    if (!map.has(s.testId)) map.set(s.testId, { key: s.testId, testTitle: s.testTitle, submissions: [] });
    map.get(s.testId)!.submissions.push(s);
  }
  return Array.from(map.values()).sort((a, b) => b.submissions.length - a.submissions.length);
}

/** Maps one Dugga test's submissions into gradebook entries, carrying the real testId through as sourceDuggaTestId. */
export function mapDuggaSubmissionsToGradeEntries(group: DuggaSubmissionGroup): GradeEntry[] {
  return group.submissions.map(s => {
    const percentage = Math.round(s.percentage);
    return {
      studentId: crypto.randomUUID(),
      studentName: s.studentName,
      testId: s.testId,
      testTitle: s.testTitle,
      rawScore: s.score,
      maxScore: s.totalPoints,
      percentage,
      masteryStatus: percentToMasteryStatus(percentage),
      gradedAt: s.submittedAt ? s.submittedAt.toDate().toISOString() : new Date().toISOString(),
      sourceDuggaTestId: s.testId,
    };
  });
}

// ── Digital Exam responses ──────────────────────────────────────────────────

export interface ExamResponseGroup {
  key: string;
  sessionTitle: string;
  session: ExamSession;
  responses: ExamResponse[];
}

/**
 * Groups a teacher's graded Digital Exam responses by session — one group per exam
 * sitting. Responses with no score/maxScore (ungraded) or no studentName are expected
 * to already be filtered out by the caller (see examService.fetchTeacherGradedExamResponses).
 */
export function groupExamResponsesForImport(
  sessionsWithResponses: { session: ExamSession; responses: ExamResponse[] }[],
): ExamResponseGroup[] {
  return sessionsWithResponses
    .filter(({ responses }) => responses.some(r => r.studentName))
    .map(({ session, responses }) => ({
      key: session.id,
      sessionTitle: session.title,
      session,
      responses: responses.filter(r => r.studentName),
    }))
    .sort((a, b) => b.responses.length - a.responses.length);
}

/** Maps one exam session's graded responses into gradebook entries, carrying the real sessionId through as sourceExamSessionId. */
export function mapExamResponsesToGradeEntries(group: ExamResponseGroup): GradeEntry[] {
  return group.responses.map(r => {
    const maxScore = r.maxScore!;
    const percentage = maxScore > 0 ? Math.round((r.score! / maxScore) * 100) : 0;
    return {
      studentId: crypto.randomUUID(),
      studentName: r.studentName,
      testId: group.session.id,
      testTitle: group.session.title,
      rawScore: r.score!,
      maxScore,
      percentage,
      masteryStatus: percentToMasteryStatus(percentage),
      gradedAt: r.gradedAt ? r.gradedAt.toDate().toISOString() : new Date().toISOString(),
      sourceExamSessionId: group.session.id,
    };
  });
}
