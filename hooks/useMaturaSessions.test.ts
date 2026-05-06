/**
 * Tests for useMaturaSessions / buildSessionSummaries (T2.4).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('./useMatura', () => ({
  useMaturaExams: vi.fn(),
  useMaturaQuestions: vi.fn(),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../services/firestoreService.matura', () => ({
  getUserMaturaResults: vi.fn(async () => []),
}));

import { useMaturaExams, useMaturaQuestions } from './useMatura';
import { useAuth } from '../contexts/AuthContext';
import { getUserMaturaResults, type MaturaQuestion, type MaturaStoredResult } from '../services/firestoreService.matura';
import { buildSessionSummaries, useMaturaSessions } from './useMaturaSessions';

function setUser(uid: string | null) {
  vi.mocked(useAuth).mockReturnValue({
    firebaseUser: uid ? { uid } : null,
    user: null,
  } as ReturnType<typeof useAuth>);
}

function setExams(ids: string[]) {
  vi.mocked(useMaturaExams).mockReturnValue({
    exams: ids.map((id) => ({
      id, year: 2024, session: 'june', language: 'mk', title: id,
      questionCount: 0, totalPoints: 0, importedAt: '',
    })),
    loading: false, error: null, refetch: vi.fn(),
  });
}

function setQuestions(qs: Partial<MaturaQuestion>[]) {
  vi.mocked(useMaturaQuestions).mockReturnValue({
    questions: qs.map((q) => ({
      examId: q.examId ?? 'e1',
      year: 2024,
      session: 'june',
      language: 'mk',
      questionNumber: q.questionNumber ?? 1,
      part: q.part ?? 1,
      points: q.points ?? 1,
      questionText: q.questionText ?? 'Q',
      correctAnswer: q.correctAnswer ?? 'А',
      topicArea: q.topicArea ?? 'algebra',
      dokLevel: q.dokLevel ?? 1,
      questionType: q.questionType ?? 'mc',
    })),
    loading: false, error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setUser(null);
  setExams([]);
  setQuestions([]);
  vi.mocked(getUserMaturaResults).mockResolvedValue([]);
  if (typeof window !== 'undefined') window.localStorage.clear();
});

describe('buildSessionSummaries', () => {
  const baseAttempt: MaturaStoredResult = {
    examId: 'e1',
    examTitle: 'Exam 1',
    grades: {
      1: { score: 1, maxPoints: 1 },
      2: { score: 0, maxPoints: 2 },
      3: { score: 2, maxPoints: 3 },
    },
    totalScore: 3,
    maxScore: 6,
    durationSeconds: 600,
    completedAt: '2026-04-01T10:00:00Z',
    completedAtTs: 1_700_000_000_000,
    source: 'firestore',
  };

  const questions: MaturaQuestion[] = [
    { examId: 'e1', year: 2024, session: 'june', language: 'mk', questionNumber: 1, part: 1, points: 1, questionText: 'Q1', correctAnswer: 'А', topicArea: 'algebra', dokLevel: 1, questionType: 'mc' },
    { examId: 'e1', year: 2024, session: 'june', language: 'mk', questionNumber: 2, part: 2, points: 2, questionText: 'Q2', correctAnswer: 'x', topicArea: 'analiza',  dokLevel: 2, questionType: 'open' },
    { examId: 'e1', year: 2024, session: 'june', language: 'mk', questionNumber: 3, part: 3, points: 3, questionText: 'Q3', correctAnswer: 'y', topicArea: 'algebra', dokLevel: 3, questionType: 'open' },
  ];

  it('aggregates per-topic / per-part / per-DoK from grades + questions', () => {
    const [s] = buildSessionSummaries([baseAttempt], questions);
    expect(s.examId).toBe('e1');
    expect(s.totalScore).toBe(3);
    expect(s.maxScore).toBe(6);
    expect(s.pct).toBe(50);

    const algebra = s.perTopic.find((t) => t.key === 'algebra')!;
    expect(algebra.correct).toBe(3); // q1 (1) + q3 (2)
    expect(algebra.max).toBe(4);     // 1 + 3
    expect(algebra.questions).toBe(2);

    const analiza = s.perTopic.find((t) => t.key === 'analiza')!;
    expect(analiza.correct).toBe(0);
    expect(analiza.max).toBe(2);

    expect(s.perPart.find((p) => p.key === '1')?.correct).toBe(1);
    expect(s.perPart.find((p) => p.key === '2')?.correct).toBe(0);
    expect(s.perPart.find((p) => p.key === '3')?.correct).toBe(2);

    expect(s.perDoK.find((d) => d.key === '3')?.correct).toBe(2);
  });

  it('computes avgSecPerQuestion = duration / questionCount', () => {
    const [s] = buildSessionSummaries([baseAttempt], questions);
    expect(s.questionCount).toBe(3);
    expect(s.avgSecPerQuestion).toBe(200); // 600 / 3
  });

  it('returns 0 avgSecPerQuestion when there are no graded questions', () => {
    const empty: MaturaStoredResult = { ...baseAttempt, grades: {}, totalScore: 0, maxScore: 0 };
    const [s] = buildSessionSummaries([empty], []);
    expect(s.avgSecPerQuestion).toBe(0);
    expect(s.questionCount).toBe(0);
  });

  it('falls back to "other" topic when question metadata is unknown', () => {
    const [s] = buildSessionSummaries([baseAttempt], []); // no questions
    const other = s.perTopic.find((t) => t.key === 'other');
    expect(other).toBeTruthy();
    expect(other!.questions).toBe(3);
  });

  it('sorts sessions newest-first by completedAtTs', () => {
    const a = { ...baseAttempt, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1 };
    const b = { ...baseAttempt, completedAt: '2026-04-02T10:00:00Z', completedAtTs: 2 };
    const c = { ...baseAttempt, completedAt: '2026-04-03T10:00:00Z', completedAtTs: 3 };
    const sorted = buildSessionSummaries([a, b, c], questions);
    expect(sorted.map((s) => s.completedAtTs)).toEqual([3, 2, 1]);
  });

  it('marks question correct only when score equals maxPoints', () => {
    const [s] = buildSessionSummaries([baseAttempt], questions);
    const q1 = s.questions.find((q) => q.questionNumber === 1)!;
    const q2 = s.questions.find((q) => q.questionNumber === 2)!;
    const q3 = s.questions.find((q) => q.questionNumber === 3)!;
    expect(q1.correct).toBe(true);
    expect(q2.correct).toBe(false);
    expect(q3.correct).toBe(false); // 2/3 — partial
  });
});

describe('useMaturaSessions hook', () => {
  it('returns empty list when no user is signed in', async () => {
    const { result } = renderHook(() => useMaturaSessions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sessions).toEqual([]);
  });

  it('exposes Firestore sessions sorted newest-first', async () => {
    setUser('uid-1');
    setExams(['e1', 'e2']);
    setQuestions([
      { examId: 'e1', questionNumber: 1, part: 1, points: 1, topicArea: 'algebra' },
      { examId: 'e2', questionNumber: 1, part: 1, points: 1, topicArea: 'analiza' },
    ]);
    vi.mocked(getUserMaturaResults).mockResolvedValue([
      { examId: 'e1', examTitle: 'E1', grades: { 1: { score: 1, maxPoints: 1 } },
        totalScore: 1, maxScore: 1, durationSeconds: 60, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1, source: 'firestore' },
      { examId: 'e2', examTitle: 'E2', grades: { 1: { score: 0, maxPoints: 1 } },
        totalScore: 0, maxScore: 1, durationSeconds: 60, completedAt: '2026-04-02T10:00:00Z', completedAtTs: 2, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaSessions());
    await waitFor(() => expect(result.current.sessions).toHaveLength(2));
    expect(result.current.sessions[0].examId).toBe('e2'); // newest first
    expect(result.current.sessions[1].examId).toBe('e1');
  });

  it('merges localStorage results not duplicated in cloud', async () => {
    setUser('uid-1');
    setExams(['e1']);
    setQuestions([{ examId: 'e1', questionNumber: 1, part: 1, points: 1, topicArea: 'algebra' }]);
    vi.mocked(getUserMaturaResults).mockResolvedValue([]);

    const local: MaturaStoredResult = {
      examId: 'e1', examTitle: 'E1',
      grades: { 1: { score: 1, maxPoints: 1 } },
      totalScore: 1, maxScore: 1, durationSeconds: 60,
      completedAt: '2026-04-05T08:00:00Z', completedAtTs: 5, source: 'local',
    };
    window.localStorage.setItem('matura_sim_result_e1', JSON.stringify(local));

    const { result } = renderHook(() => useMaturaSessions());
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(result.current.sessions[0].source).toBe('local');
  });
});
