import type { GradeEntry } from '../types';
import type { QuizResult } from '../services/firestoreService.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentReadiness {
  studentName: string;
  readinessPct: number;
  gradeAvg: number;       // from GradeBook entries
  quizAvg: number;        // from Dugga/Kahoot results
  masteryCount: number;   // entries with mastered status
  weakAreas: string[];
  strongAreas: string[];
  level: 'high' | 'medium' | 'low';
}

export interface MaturaReadinessReport {
  classAvg: number;
  students: StudentReadiness[];
  topStudents: StudentReadiness[];
  atRiskStudents: StudentReadiness[];
}

// ── Scoring weights ───────────────────────────────────────────────────────────

const W_GRADE = 0.60;   // traditional grade average is most important
const W_QUIZ  = 0.40;   // Dugga/Kahoot quiz average

/**
 * Computes Matura readiness for each student in a grade book.
 * Intended for grade 9 (primary) or secondary grades approaching Matura.
 *
 * Score: weighted average of GradeBook percentages + Dugga quiz percentages.
 * Weak areas: test titles where student scored < 60%.
 * Strong areas: test titles where student scored ≥ 80%.
 */
export function computeMaturaReadiness(
  entries: GradeEntry[],
  quizResults: QuizResult[],
): MaturaReadinessReport {
  // Group gradebook entries by student
  const gradeMap = new Map<string, number[]>();
  const testMap = new Map<string, { title: string; pct: number }[]>();

  for (const e of entries) {
    const name = e.studentName;
    if (!gradeMap.has(name)) gradeMap.set(name, []);
    gradeMap.get(name)!.push(e.percentage);
    if (!testMap.has(name)) testMap.set(name, []);
    testMap.get(name)!.push({ title: e.testTitle, pct: e.percentage });
  }

  // Group quiz results by student
  const quizMap = new Map<string, number[]>();
  const quizTitleMap = new Map<string, { title: string; pct: number }[]>();

  for (const r of quizResults) {
    const name = r.studentName ?? '';
    if (!name) continue;
    if (!quizMap.has(name)) quizMap.set(name, []);
    quizMap.get(name)!.push(r.percentage);
    if (!quizTitleMap.has(name)) quizTitleMap.set(name, []);
    quizTitleMap.get(name)!.push({ title: r.quizTitle, pct: r.percentage });
  }

  // Build union of all student names
  const allNames = new Set([...gradeMap.keys(), ...quizMap.keys()]);
  if (allNames.size === 0) {
    return { classAvg: 0, students: [], topStudents: [], atRiskStudents: [] };
  }

  const students: StudentReadiness[] = [];

  for (const name of allNames) {
    const grades = gradeMap.get(name) ?? [];
    const quizzes = quizMap.get(name) ?? [];
    const tests = testMap.get(name) ?? [];
    const quizTitles = quizTitleMap.get(name) ?? [];

    const gradeAvg = grades.length
      ? Math.round(grades.reduce((s, n) => s + n, 0) / grades.length)
      : 0;
    const quizAvg = quizzes.length
      ? Math.round(quizzes.reduce((s, n) => s + n, 0) / quizzes.length)
      : 0;

    const readinessPct = grades.length && quizzes.length
      ? Math.round(gradeAvg * W_GRADE + quizAvg * W_QUIZ)
      : grades.length ? gradeAvg
      : quizAvg;

    const allTests = [...tests, ...quizTitles];
    const weakAreas = [...new Set(allTests.filter(t => t.pct < 60).map(t => t.title))];
    const strongAreas = [...new Set(allTests.filter(t => t.pct >= 80).map(t => t.title))];
    const masteryCount = grades.filter(g => g >= 80).length;

    const level: StudentReadiness['level'] =
      readinessPct >= 75 ? 'high' :
      readinessPct >= 55 ? 'medium' : 'low';

    students.push({
      studentName: name,
      readinessPct,
      gradeAvg,
      quizAvg,
      masteryCount,
      weakAreas: weakAreas.slice(0, 4),
      strongAreas: strongAreas.slice(0, 3),
      level,
    });
  }

  students.sort((a, b) => b.readinessPct - a.readinessPct);
  const classAvg = Math.round(
    students.reduce((s, st) => s + st.readinessPct, 0) / students.length,
  );

  return {
    classAvg,
    students,
    topStudents: students.filter(s => s.level === 'high'),
    atRiskStudents: students.filter(s => s.level === 'low'),
  };
}
