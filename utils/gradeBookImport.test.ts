import { describe, it, expect } from 'vitest';
import {
  groupQuizResultsForImport, mapQuizResultsToGradeEntries,
  groupDuggaSubmissionsForImport, mapDuggaSubmissionsToGradeEntries,
  groupExamResponsesForImport, mapExamResponsesToGradeEntries,
} from './gradeBookImport';
import type { QuizResult, ExamSession, ExamResponse } from '../services/firestoreService.types';
import type { DuggaSubmission } from '../services/firestoreService.dugga';
import { Timestamp } from 'firebase/firestore';

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

function makeSubmission(overrides: Partial<DuggaSubmission>): DuggaSubmission {
  return {
    id: 'sub-1',
    testId: 'test-1',
    testTitle: 'Дугга — Дропки',
    teacherUid: 'teacher-1',
    studentUid: 'student-1',
    studentName: 'Ана',
    answers: {},
    score: 8,
    totalPoints: 10,
    percentage: 80,
    submittedAt: Timestamp.fromDate(new Date('2026-07-20T10:00:00Z')),
    ...overrides,
  };
}

describe('groupDuggaSubmissionsForImport', () => {
  it('groups submissions by testId, most-populous group first', () => {
    const subs: DuggaSubmission[] = [
      makeSubmission({ id: 's1', studentName: 'Ана' }),
      makeSubmission({ id: 's2', studentName: 'Марко' }),
      makeSubmission({ id: 's3', testId: 'test-2', testTitle: 'Друг тест', studentName: 'Сара' }),
    ];
    const groups = groupDuggaSubmissionsForImport(subs);
    expect(groups).toHaveLength(2);
    expect(groups[0].submissions).toHaveLength(2);
    expect(groups[0].key).toBe('test-1');
  });

  it('drops submissions with no studentName', () => {
    const subs: DuggaSubmission[] = [
      makeSubmission({ id: 's1', studentName: '' }),
      makeSubmission({ id: 's2', studentName: 'Ана' }),
    ];
    const groups = groupDuggaSubmissionsForImport(subs);
    expect(groups).toHaveLength(1);
    expect(groups[0].submissions).toHaveLength(1);
  });
});

describe('mapDuggaSubmissionsToGradeEntries', () => {
  it('maps DuggaSubmission fields to GradeEntry fields, carrying testId through as sourceDuggaTestId', () => {
    const group = groupDuggaSubmissionsForImport([makeSubmission({ percentage: 87.4 })])[0];
    const entries = mapDuggaSubmissionsToGradeEntries(group);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.studentName).toBe('Ана');
    expect(e.testId).toBe('test-1');
    expect(e.testTitle).toBe('Дугга — Дропки');
    expect(e.rawScore).toBe(8);
    expect(e.maxScore).toBe(10);
    expect(e.percentage).toBe(87);
    expect(e.sourceDuggaTestId).toBe('test-1');
    expect(e.masteryStatus).toBe('mastered');
  });
});

function makeSession(overrides: Partial<ExamSession>): ExamSession {
  return {
    id: 'session-1',
    title: 'Писмена работа — I тема',
    subject: 'Математика',
    gradeLevel: 8,
    variants: { A: [], B: [], V: [], G: [] },
    duration: 2700,
    joinCode: '123456',
    status: 'ended',
    createdBy: 'teacher-1',
    totalPoints: 20,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<ExamResponse>): ExamResponse {
  return {
    id: 'resp-1',
    sessionId: 'session-1',
    studentName: 'Ана',
    variantKey: 'A',
    answers: {},
    status: 'submitted',
    score: 16,
    maxScore: 20,
    gradedAt: Timestamp.fromDate(new Date('2026-07-20T10:00:00Z')),
    ...overrides,
  };
}

describe('groupExamResponsesForImport', () => {
  it('groups responses by session, most-populous group first, dropping sessions with no named responses', () => {
    const session1 = makeSession({ id: 's1', title: 'Испит 1' });
    const session2 = makeSession({ id: 's2', title: 'Испит 2' });
    const groups = groupExamResponsesForImport([
      { session: session1, responses: [makeResponse({ id: 'r1', studentName: 'Ана' }), makeResponse({ id: 'r2', studentName: 'Марко' })] },
      { session: session2, responses: [makeResponse({ id: 'r3', studentName: '' })] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('s1');
    expect(groups[0].responses).toHaveLength(2);
  });
});

describe('mapExamResponsesToGradeEntries', () => {
  it('maps ExamResponse fields to GradeEntry fields, carrying session.id through as sourceExamSessionId', () => {
    const session = makeSession({ id: 'session-9', title: 'Контролна работа' });
    const group = groupExamResponsesForImport([
      { session, responses: [makeResponse({ studentName: 'Ана', score: 17, maxScore: 20 })] },
    ])[0];
    const entries = mapExamResponsesToGradeEntries(group);
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.studentName).toBe('Ана');
    expect(e.testId).toBe('session-9');
    expect(e.testTitle).toBe('Контролна работа');
    expect(e.rawScore).toBe(17);
    expect(e.maxScore).toBe(20);
    expect(e.percentage).toBe(85);
    expect(e.sourceExamSessionId).toBe('session-9');
    expect(e.masteryStatus).toBe('mastered');
  });
});
