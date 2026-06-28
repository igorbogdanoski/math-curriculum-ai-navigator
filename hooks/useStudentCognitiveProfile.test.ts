import { describe, it, expect } from 'vitest';
import { aggregateCognitiveProfile } from './useStudentCognitiveProfile';
import type { ConceptMastery, QuizResult } from '../services/firestoreService.types';

function mastery(overrides: Partial<ConceptMastery> = {}): ConceptMastery {
  return {
    studentName: 'Ана',
    conceptId: 'c1',
    attempts: 3,
    consecutiveHighScores: 2,
    bestScore: 90,
    lastScore: 85,
    mastered: true,
    ...overrides,
  };
}

function quiz(overrides: Partial<QuizResult> = {}): QuizResult {
  return {
    quizId: 'q1',
    quizTitle: 'Тест 1',
    score: 8,
    correctCount: 8,
    totalQuestions: 10,
    percentage: 80,
    studentName: 'Ана',
    teacherUid: 'teacher-1',
    gradeLevel: 8,
    ...overrides,
  };
}

describe('aggregateCognitiveProfile', () => {
  it('returns zero state when no data', () => {
    const p = aggregateCognitiveProfile('Ана', [], []);
    expect(p.overallMasteryPct).toBe(0);
    expect(p.masteredConcepts).toBe(0);
    expect(p.totalConcepts).toBe(0);
    expect(p.topicBreakdown).toHaveLength(0);
    expect(p.weakTopics).toHaveLength(0);
    expect(p.strongTopics).toHaveLength(0);
  });

  it('counts mastered vs total concepts', () => {
    const m = [
      mastery({ conceptId: 'c1', mastered: true }),
      mastery({ conceptId: 'c2', mastered: false }),
      mastery({ conceptId: 'c3', mastered: true }),
    ];
    const p = aggregateCognitiveProfile('Ана', m, []);
    expect(p.masteredConcepts).toBe(2);
    expect(p.totalConcepts).toBe(3);
  });

  it('computes overall mastery from quiz scores', () => {
    const q = [
      quiz({ quizId: 'q1', percentage: 60 }),
      quiz({ quizId: 'q2', percentage: 80 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.overallMasteryPct).toBe(70);
  });

  it('groups quiz results by topicId', () => {
    const q = [
      quiz({ quizId: 'q1', topicId: 't1', percentage: 50 }),
      quiz({ quizId: 'q2', topicId: 't1', percentage: 70 }),
      quiz({ quizId: 'q3', topicId: 't2', percentage: 90 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.topicBreakdown).toHaveLength(2);
    const t1 = p.topicBreakdown.find(t => t.topicId === 't1')!;
    expect(t1.avgScore).toBe(60);
    expect(t1.attempts).toBe(2);
  });

  it('identifies weak topics (avgScore < 60)', () => {
    const q = [
      quiz({ quizId: 'q1', topicId: 't1', quizTitle: 'Дропки', percentage: 40 }),
      quiz({ quizId: 'q2', topicId: 't2', quizTitle: 'Функции', percentage: 90 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.weakTopics).toContain('Дропки');
    expect(p.weakTopics).not.toContain('Функции');
  });

  it('identifies strong topics (avgScore >= 80)', () => {
    const q = [
      quiz({ quizId: 'q1', topicId: 't1', quizTitle: 'Алгебра', percentage: 90 }),
      quiz({ quizId: 'q2', topicId: 't2', quizTitle: 'Статистика', percentage: 50 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.strongTopics).toContain('Алгебра');
    expect(p.strongTopics).not.toContain('Статистика');
  });

  it('aggregates DoK distribution from quiz results', () => {
    const q = [
      quiz({ quizId: 'q1', dokLevel: 1 }),
      quiz({ quizId: 'q2', dokLevel: 2 }),
      quiz({ quizId: 'q3', dokLevel: 2 }),
      quiz({ quizId: 'q4', dokLevel: 3 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.dokDistribution[1]).toBe(1);
    expect(p.dokDistribution[2]).toBe(2);
    expect(p.dokDistribution[3]).toBe(1);
    expect(p.dokDistribution[4]).toBe(0);
  });

  it('ignores DoK levels outside 1-4', () => {
    const q = [quiz({ quizId: 'q1', dokLevel: undefined })];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(Object.values(p.dokDistribution).every(v => v === 0)).toBe(true);
  });

  it('sorts topic breakdown by attempts descending', () => {
    const q = [
      quiz({ quizId: 'q1', topicId: 't1', percentage: 70 }),
      quiz({ quizId: 'q2', topicId: 't2', percentage: 70 }),
      quiz({ quizId: 'q3', topicId: 't2', percentage: 80 }),
    ];
    const p = aggregateCognitiveProfile('Ана', [], q);
    expect(p.topicBreakdown[0].topicId).toBe('t2');
    expect(p.topicBreakdown[0].attempts).toBe(2);
  });

  it('counts mastered concepts per topic', () => {
    const m = [
      mastery({ conceptId: 'c1', topicId: 't1', mastered: true }),
      mastery({ conceptId: 'c2', topicId: 't1', mastered: false }),
      mastery({ conceptId: 'c3', topicId: 't2', mastered: true }),
    ];
    const p = aggregateCognitiveProfile('Ана', m, []);
    const t1 = p.topicBreakdown.find(t => t.topicId === 't1')!;
    expect(t1.masteredConcepts).toBe(1);
    expect(t1.totalConcepts).toBe(2);
  });

  it('preserves student name in profile', () => {
    const p = aggregateCognitiveProfile('Марко', [], []);
    expect(p.studentName).toBe('Марко');
  });
});
