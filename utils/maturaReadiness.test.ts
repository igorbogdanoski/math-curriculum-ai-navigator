import { describe, it, expect } from 'vitest';
import { computeMaturaReadiness } from './maturaReadiness';
import type { GradeEntry } from '../types';
import type { QuizResult } from '../services/firestoreService.types';

function entry(name: string, pct: number, testTitle = 'Тест'): GradeEntry {
  return {
    studentId: crypto.randomUUID(),
    studentName: name,
    testId: crypto.randomUUID(),
    testTitle,
    rawScore: pct,
    maxScore: 100,
    percentage: pct,
    masteryStatus: pct >= 80 ? 'mastered' : pct >= 60 ? 'approaching' : 'not_yet',
    gradedAt: new Date().toISOString(),
  };
}

function quiz(name: string, pct: number, title = 'Kahoot'): QuizResult {
  return {
    quizId: crypto.randomUUID(),
    quizTitle: title,
    score: pct,
    correctCount: pct,
    totalQuestions: 100,
    percentage: pct,
    studentName: name,
  };
}

describe('computeMaturaReadiness', () => {
  it('returns empty report when no entries and no quiz results', () => {
    const r = computeMaturaReadiness([], []);
    expect(r.classAvg).toBe(0);
    expect(r.students).toHaveLength(0);
    expect(r.topStudents).toHaveLength(0);
    expect(r.atRiskStudents).toHaveLength(0);
  });

  it('computes readiness from grade entries alone', () => {
    const r = computeMaturaReadiness([entry('Ана', 80), entry('Ана', 60)], []);
    expect(r.students).toHaveLength(1);
    expect(r.students[0].gradeAvg).toBe(70);
    expect(r.students[0].readinessPct).toBe(70);
  });

  it('computes readiness from quiz results alone', () => {
    const r = computeMaturaReadiness([], [quiz('Марко', 90)]);
    expect(r.students[0].quizAvg).toBe(90);
    expect(r.students[0].readinessPct).toBe(90);
  });

  it('applies weighted formula when both data sources present (60/40)', () => {
    // gradeAvg=80 * 0.6 + quizAvg=60 * 0.4 = 48+24 = 72
    const r = computeMaturaReadiness(
      [entry('Ана', 80)],
      [quiz('Ана', 60)],
    );
    expect(r.students[0].readinessPct).toBe(72);
  });

  it('classifies high/medium/low levels correctly', () => {
    const entries = [entry('A', 90), entry('B', 65), entry('C', 40)];
    const r = computeMaturaReadiness(entries, []);
    expect(r.students.find(s => s.studentName === 'A')!.level).toBe('high');
    expect(r.students.find(s => s.studentName === 'B')!.level).toBe('medium');
    expect(r.students.find(s => s.studentName === 'C')!.level).toBe('low');
  });

  it('identifies weak areas (pct < 60)', () => {
    const r = computeMaturaReadiness(
      [entry('Ана', 40, 'Дропки'), entry('Ана', 90, 'Функции')],
      [],
    );
    expect(r.students[0].weakAreas).toContain('Дропки');
    expect(r.students[0].weakAreas).not.toContain('Функции');
  });

  it('identifies strong areas (pct >= 80)', () => {
    const r = computeMaturaReadiness(
      [entry('Ана', 40, 'Дропки'), entry('Ана', 90, 'Функции')],
      [],
    );
    expect(r.students[0].strongAreas).toContain('Функции');
    expect(r.students[0].strongAreas).not.toContain('Дропки');
  });

  it('sorts students by readiness descending', () => {
    const r = computeMaturaReadiness(
      [entry('B', 60), entry('A', 90), entry('C', 30)],
      [],
    );
    expect(r.students[0].studentName).toBe('A');
    expect(r.students[1].studentName).toBe('B');
    expect(r.students[2].studentName).toBe('C');
  });

  it('computes classAvg correctly', () => {
    const r = computeMaturaReadiness(
      [entry('A', 80), entry('B', 60)],
      [],
    );
    expect(r.classAvg).toBe(70);
  });

  it('fills topStudents and atRiskStudents correctly', () => {
    const r = computeMaturaReadiness(
      [entry('A', 90), entry('B', 65), entry('C', 30)],
      [],
    );
    expect(r.topStudents.map(s => s.studentName)).toContain('A');
    expect(r.atRiskStudents.map(s => s.studentName)).toContain('C');
    expect(r.topStudents.map(s => s.studentName)).not.toContain('C');
  });
});
