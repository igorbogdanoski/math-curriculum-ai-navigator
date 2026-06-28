import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { keywordMatch, useLessonResources } from './useLessonResources';

// ── Firestore mock ────────────────────────────────────────────────────────────

vi.mock('../firebaseConfig', () => ({ db: {} }));

const { mockGetDocs } = vi.hoisted(() => ({ mockGetDocs: vi.fn() }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn((_db: unknown, name: string) => name),
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn((...args: unknown[]) => args),
    orderBy: vi.fn((...args: unknown[]) => args),
    limit: vi.fn((n: number) => n),
    getDocs: mockGetDocs,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnap(docs: Array<{ id: string; data: object }>) {
  return {
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
    })),
  };
}

// ── keywordMatch unit tests ────────────────────────────────────────────────────

describe('keywordMatch', () => {
  it('returns true when keyword found in text (case-insensitive)', () => {
    expect(keywordMatch('Линеарни равенки', 'равенки')).toBe(true);
  });

  it('returns true for partial word match', () => {
    expect(keywordMatch('Квадратни равенки', 'квадрат')).toBe(true);
  });

  it('returns false when no keyword matches', () => {
    expect(keywordMatch('Геометрија', 'равенки')).toBe(false);
  });

  it('ignores words shorter than 3 chars', () => {
    expect(keywordMatch('Рационални броеви', 'во')).toBe(false);
  });

  it('returns false for empty keyword', () => {
    expect(keywordMatch('Some text', '')).toBe(false);
  });

  it('returns false for empty text', () => {
    expect(keywordMatch('', 'равенки')).toBe(false);
  });

  it('matches multiple keywords — at least one must match', () => {
    expect(keywordMatch('Полиноми', 'полином алгебра')).toBe(true);
  });
});

// ── useLessonResources hook tests ─────────────────────────────────────────────

describe('useLessonResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result when grade is missing', () => {
    mockGetDocs.mockResolvedValue(makeSnap([]));
    const { result } = renderHook(() =>
      useLessonResources({ grade: null, uid: 'uid1', theme: 'Равенки' }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.scenarios).toHaveLength(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns empty result when uid is missing', () => {
    const { result } = renderHook(() =>
      useLessonResources({ grade: 8, uid: null, theme: 'Равенки' }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('fetches and filters scenarios by theme keyword', async () => {
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([
        { id: 's1', data: { grade: 8, deleted: false, topicTitle: 'Линеарни равенки', publishedAt: null, authorUid: 'a1', title: 'Сценарио 1' } },
        { id: 's2', data: { grade: 8, deleted: false, topicTitle: 'Тригонометрија', publishedAt: null, authorUid: 'a1', title: 'Сценарио 2' } },
      ]))
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([]));

    const { result } = renderHook(() =>
      useLessonResources({ grade: 8, uid: 'uid1', theme: 'Линеарни равенки' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.scenarios).toHaveLength(1);
    expect(result.current.scenarios[0].id).toBe('s1');
  });

  it('separates extracted tasks from presentations', async () => {
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([
        { id: 'm1', data: { type: 'problems', gradeLevel: 8, teacherUid: 'uid1', title: 'Задачи равенки', createdAt: null } },
        { id: 'm2', data: { type: 'package', gradeLevel: 8, teacherUid: 'uid1', title: 'Презентација равенки', createdAt: null } },
        { id: 'm3', data: { type: 'rubric', gradeLevel: 8, teacherUid: 'uid1', title: 'Рубрика', createdAt: null } },
      ]))
      .mockResolvedValueOnce(makeSnap([]));

    const { result } = renderHook(() =>
      useLessonResources({ grade: 8, uid: 'uid1', theme: 'равенки' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.extractedTasks).toHaveLength(1);
    expect(result.current.extractedTasks[0].id).toBe('m1');
    expect(result.current.presentations).toHaveLength(1);
    expect(result.current.presentations[0].id).toBe('m2');
  });

  it('filters Dugga tests by topic keyword', async () => {
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([
        { id: 't1', data: { grade: 8, teacherUid: 'uid1', title: 'Тест за равенки', topics: ['Линеарни равенки'], createdAt: null } },
        { id: 't2', data: { grade: 8, teacherUid: 'uid1', title: 'Годишен тест', topics: ['Геометрија'], createdAt: null } },
      ]));

    const { result } = renderHook(() =>
      useLessonResources({ grade: 8, uid: 'uid1', theme: 'равенки' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tests).toHaveLength(1);
    expect(result.current.tests[0].id).toBe('t1');
  });

  it('sets error on Firestore failure', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Permission denied'));
    // Second and third still need to be handled — reject all
    mockGetDocs.mockRejectedValue(new Error('Permission denied'));

    const { result } = renderHook(() =>
      useLessonResources({ grade: 8, uid: 'uid1', theme: 'Равенки' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.scenarios).toHaveLength(0);
  });

  it('runs 3 parallel Firestore queries when grade+uid provided', async () => {
    mockGetDocs.mockResolvedValue(makeSnap([]));

    const { result } = renderHook(() =>
      useLessonResources({ grade: 7, uid: 'uid2', theme: 'Геометрија' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGetDocs).toHaveBeenCalledTimes(3);
  });
});
