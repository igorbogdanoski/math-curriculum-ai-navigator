import type { GradeEntry } from '../types';
import type { QuizResult } from '../services/firestoreService.types';

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
