/**
 * Tests for useMaturaStats (T1.2).
 *
 * Strategy: mock all underlying hooks/services so we can drive the aggregation
 * pipeline with synthetic SimResult + MaturaQuestion fixtures.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./useMatura', () => ({
  useMaturaExams: vi.fn(),
  useMaturaQuestions: vi.fn(),
}));
vi.mock('./useMaturaCurriculumAlignment', () => ({
  useMaturaCurriculumAlignment: vi.fn(() => ({ alignedQuestions: [], byQuestionId: new Map() })),
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../services/firestoreService.matura', () => ({
  getUserMaturaResults: vi.fn(async () => []),
}));

import { useMaturaExams, useMaturaQuestions } from './useMatura';
import { useAuth } from '../contexts/AuthContext';
import { getUserMaturaResults, type MaturaStoredResult } from '../services/firestoreService.matura';
import { useMaturaStats } from './useMaturaStats';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function setExams(exams: Array<{ id: string; year?: number }>) {
  vi.mocked(useMaturaExams).mockReturnValue({
    exams: exams.map(e => ({
      id: e.id, year: e.year ?? 2024, session: 'june', language: 'mk', title: e.id,
      questionCount: 0, totalPoints: 0, importedAt: '',
    })),
    loading: false, error: null, refetch: vi.fn(),
  });
}

function setQuestions(qs: Array<Partial<{ examId: string; questionNumber: number; part: 1|2|3; topicArea: string; dokLevel: number }>>) {
  vi.mocked(useMaturaQuestions).mockReturnValue({
    questions: qs.map(q => ({
      examId: q.examId ?? 'e1',
      year: 2024,
      session: 'june',
      language: 'mk',
      questionNumber: q.questionNumber ?? 1,
      part: q.part ?? 1,
      points: 1,
      questionText: 'Q',
      correctAnswer: 'А',
      topicArea: q.topicArea ?? 'algebra',
      dokLevel: q.dokLevel ?? 1,
    })),
    loading: false, error: null,
  });
}

function setUser(uid: string | null) {
  vi.mocked(useAuth).mockReturnValue({
    firebaseUser: uid ? { uid } : null,
    user: null,
  } as ReturnType<typeof useAuth>);
}

function setCloudResults(results: MaturaStoredResult[]) {
  vi.mocked(getUserMaturaResults).mockResolvedValue(results);
}

beforeEach(() => {
  vi.clearAllMocks();
  setExams([]);
  setQuestions([]);
  setUser(null);
  setCloudResults([]);
  // Clear localStorage between tests
  if (typeof window !== 'undefined') window.localStorage.clear();
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('useMaturaStats — empty state', () => {
  it('returns hasAttempts=false and zero stats when no results exist', async () => {
    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAttempts).toBe(false);
    expect(result.current.attempts).toBe(0);
    expect(result.current.avgPct).toBe(0);
    expect(result.current.bestPct).toBe(0);
    expect(result.current.passRatePct).toBe(0);
    expect(result.current.lastAttemptAt).toBeNull();
    expect(result.current.topicStats).toEqual([]);
  });

  it('initializes partStats with zero buckets for parts 1-3', async () => {
    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.partStats[1]).toEqual({ correct: 0, max: 0, questions: 0, pct: 0 });
    expect(result.current.partStats[2]).toEqual({ correct: 0, max: 0, questions: 0, pct: 0 });
    expect(result.current.partStats[3]).toEqual({ correct: 0, max: 0, questions: 0, pct: 0 });
  });
});

// ─── avg/best/pass/duration aggregation ───────────────────────────────────────

describe('useMaturaStats — basic aggregation', () => {
  it('computes avgPct and bestPct from cloud results', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }, { id: 'e2' }]);
    setCloudResults([
      { examId: 'e1', examTitle: 'E1', grades: {}, totalScore: 30, maxScore: 60, durationSeconds: 5400, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1, source: 'firestore' },
      { examId: 'e2', examTitle: 'E2', grades: {}, totalScore: 45, maxScore: 60, durationSeconds: 4800, completedAt: '2026-04-02T10:00:00Z', completedAtTs: 2, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(2));

    expect(result.current.avgPct).toBeCloseTo(62.5, 1); // (50 + 75) / 2
    expect(result.current.bestPct).toBeCloseTo(75, 1);
  });

  it('passRatePct counts attempts where totalScore ≥ 35', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setCloudResults([
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 40, maxScore: 60, durationSeconds: 0, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1, source: 'firestore' },
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 20, maxScore: 60, durationSeconds: 0, completedAt: '2026-04-02T10:00:00Z', completedAtTs: 2, source: 'firestore' },
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 50, maxScore: 60, durationSeconds: 0, completedAt: '2026-04-03T10:00:00Z', completedAtTs: 3, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(3));

    // 2 out of 3 are ≥35 → 66.7%
    expect(result.current.passRatePct).toBeCloseTo(66.7, 1);
  });

  it('avgDurationMin averages and rounds to nearest minute', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setCloudResults([
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 60, durationSeconds: 3600, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1, source: 'firestore' },
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 60, durationSeconds: 5400, completedAt: '2026-04-02T10:00:00Z', completedAtTs: 2, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(2));
    // (3600 + 5400) / 2 / 60 = 75
    expect(result.current.avgDurationMin).toBe(75);
  });

  it('lastAttemptAt is the newest completedAt', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setCloudResults([
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 60, durationSeconds: 0, completedAt: '2026-04-01T10:00:00Z', completedAtTs: 1, source: 'firestore' },
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 60, durationSeconds: 0, completedAt: '2026-05-01T10:00:00Z', completedAtTs: 2, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(2));
    expect(result.current.lastAttemptAt).toBe('2026-05-01T10:00:00Z');
  });
});

// ─── topicStats / partStats / dokStats ────────────────────────────────────────

describe('useMaturaStats — bucket aggregation', () => {
  it('computes topicStats sorted by question count desc', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setQuestions([
      { examId: 'e1', questionNumber: 1, topicArea: 'algebra' },
      { examId: 'e1', questionNumber: 2, topicArea: 'algebra' },
      { examId: 'e1', questionNumber: 3, topicArea: 'geometrija' },
    ]);
    setCloudResults([
      {
        examId: 'e1', examTitle: 'E', grades: {
          1: { score: 1, maxPoints: 1 },
          2: { score: 1, maxPoints: 1 },
          3: { score: 0, maxPoints: 1 },
        },
        totalScore: 2, maxScore: 3, durationSeconds: 0, completedAt: '2026-04-01', completedAtTs: 1, source: 'firestore',
      },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(1));

    const algebra = result.current.topicStats.find(t => t.key === 'algebra');
    const geo     = result.current.topicStats.find(t => t.key === 'geometrija');
    expect(algebra?.questions).toBe(2);
    expect(algebra?.pct).toBe(100);
    expect(geo?.questions).toBe(1);
    expect(geo?.pct).toBe(0);
    // Algebra has more questions, must come first
    expect(result.current.topicStats[0].key).toBe('algebra');
  });

  it('partStats correctly buckets by question.part', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setQuestions([
      { examId: 'e1', questionNumber: 1, part: 1 },
      { examId: 'e1', questionNumber: 2, part: 2 },
      { examId: 'e1', questionNumber: 3, part: 3 },
    ]);
    setCloudResults([
      {
        examId: 'e1', examTitle: 'E', grades: {
          1: { score: 1, maxPoints: 1 },
          2: { score: 1, maxPoints: 2 },
          3: { score: 3, maxPoints: 4 },
        },
        totalScore: 5, maxScore: 7, durationSeconds: 0, completedAt: '2026-04-01', completedAtTs: 1, source: 'firestore',
      },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(1));

    expect(result.current.partStats[1].pct).toBe(100);
    expect(result.current.partStats[2].pct).toBe(50);
    expect(result.current.partStats[3].pct).toBe(75);
    expect(result.current.partStats[1].questions).toBe(1);
    expect(result.current.partStats[2].questions).toBe(1);
    expect(result.current.partStats[3].questions).toBe(1);
  });

  it('dokStats sorted ascending by level', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setQuestions([
      { examId: 'e1', questionNumber: 1, dokLevel: 3 },
      { examId: 'e1', questionNumber: 2, dokLevel: 1 },
      { examId: 'e1', questionNumber: 3, dokLevel: 2 },
    ]);
    setCloudResults([
      {
        examId: 'e1', examTitle: 'E',
        grades: {
          1: { score: 0, maxPoints: 1 },
          2: { score: 1, maxPoints: 1 },
          3: { score: 1, maxPoints: 1 },
        },
        totalScore: 2, maxScore: 3, durationSeconds: 0, completedAt: '2026-04-01', completedAtTs: 1, source: 'firestore',
      },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(1));

    expect(result.current.dokStats.map(d => d.level)).toEqual([1, 2, 3]);
  });

  it('attempts count reflects total result rows including duplicates dedup by examId+completedAt', async () => {
    setUser('uid-1');
    setExams([{ id: 'e1' }]);
    setCloudResults([
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 1, durationSeconds: 0, completedAt: '2026-04-01', completedAtTs: 1, source: 'firestore' },
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 1, durationSeconds: 0, completedAt: '2026-04-01', completedAtTs: 1, source: 'firestore' }, // duplicate
      { examId: 'e1', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 1, durationSeconds: 0, completedAt: '2026-04-02', completedAtTs: 2, source: 'firestore' },
    ]);

    const { result } = renderHook(() => useMaturaStats());
    await waitFor(() => expect(result.current.attempts).toBe(2));
  });
});
