import { describe, it, expect } from 'vitest';
import { groupQuizResultsForImport, mapQuizResultsToGradeEntries } from './gradeBookImport';
import type { QuizResult } from '../services/firestoreService.types';

function makeResult(overrides: Partial<QuizResult>): QuizResult {
  return {
    quizId: 'quiz-1',
    quizTitle: 'Дропки — квиз',
    score: 8,
    correctCount: 8,
    totalQuestions: 10,
    percentage: 80,
    ...overrides,
  };
}

describe('groupQuizResultsForImport', () => {
  it('groups results by quizId + conceptId, most-populous group first', () => {
    const results: QuizResult[] = [
      makeResult({ studentName: 'Ана', conceptId: 'c1' }),
      makeResult({ studentName: 'Марко', conceptId: 'c1' }),
      makeResult({ quizId: 'quiz-2', quizTitle: 'Друг квиз', studentName: 'Сара', conceptId: 'c2' }),
    ];
    const groups = groupQuizResultsForImport(results);
    expect(groups).toHaveLength(2);
    expect(groups[0].results).toHaveLength(2);
    expect(groups[0].key).toBe('quiz-1__c1');
    expect(groups[1].results).toHaveLength(1);
  });

  it('drops results with no studentName — nothing to attribute a gradebook row to', () => {
    const results: QuizResult[] = [
      makeResult({ studentName: undefined }),
      makeResult({ studentName: 'Ана' }),
    ];
    const groups = groupQuizResultsForImport(results);
    expect(groups).toHaveLength(1);
    expect(groups[0].results).toHaveLength(1);
    expect(groups[0].results[0].studentName).toBe('Ана');
  });
});

describe('mapQuizResultsToGradeEntries', () => {
  it('maps QuizResult fields to GradeEntry fields, carrying the real quizId/conceptId through', () => {
    const group = groupQuizResultsForImport([
      makeResult({ studentName: 'Ана', conceptId: 'c1', percentage: 87.4 }),
    ])[0];
    const entries = mapQuizResultsToGradeEntries(group);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.studentName).toBe('Ана');
    expect(e.testId).toBe('quiz-1');
    expect(e.testTitle).toBe('Дропки — квиз');
    expect(e.rawScore).toBe(8);
    expect(e.maxScore).toBe(10);
    expect(e.percentage).toBe(87); // rounded
    expect(e.sourceQuizId).toBe('quiz-1');
    expect(e.conceptId).toBe('c1');
    expect(e.masteryStatus).toBe('mastered');
  });

  it('derives masteryStatus from percentage thresholds (80/60)', () => {
    const results = [
      makeResult({ studentName: 'A', percentage: 85 }),
      makeResult({ studentName: 'B', percentage: 65 }),
      makeResult({ studentName: 'C', percentage: 40 }),
    ];
    const group = groupQuizResultsForImport(results)[0];
    const entries = mapQuizResultsToGradeEntries(group);
    expect(entries.find(e => e.studentName === 'A')?.masteryStatus).toBe('mastered');
    expect(entries.find(e => e.studentName === 'B')?.masteryStatus).toBe('approaching');
    expect(entries.find(e => e.studentName === 'C')?.masteryStatus).toBe('not_yet');
  });

  it('omits conceptId entirely when the source result has none, rather than writing undefined', () => {
    const group = groupQuizResultsForImport([makeResult({ studentName: 'Ана', conceptId: undefined })])[0];
    const entries = mapQuizResultsToGradeEntries(group);
    expect('conceptId' in entries[0]).toBe(false);
  });
});
