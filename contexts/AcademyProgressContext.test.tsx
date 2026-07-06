import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AcademyProgressProvider, useAcademyProgress } from './AcademyProgressContext';
import { useAuth } from './AuthContext';
import { academyBadgesService } from '../services/firestoreService.academyBadges';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  onSnapshot: vi.fn(() => () => {}), // never fires — no remote progress doc in this test
  setDoc: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/firestoreService.academyBadges', () => ({
  academyBadgesService: { setOwnBadges: vi.fn().mockResolvedValue(undefined) },
}));

// The 5 lessonIds that make up the 'inclusive-teacher' specialization
// (data/academy/specializations.ts) — completing all of them (applied + quizzed)
// is what should flip earnedSpecializationIds and fire exactly one badge sync.
const INCLUSIVE_TEACHER_LESSONS = [
  'model-udl',
  'focus-diferencijacija-i-personalizacija',
  'focus-sorabotka-i-timska-rabota',
  'tone-praktichen-i-hands-on',
  'focus-konceptualno-razbiranje',
];

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(AcademyProgressProvider, null, children),
  );
}

describe('AcademyProgressContext — earnedSpecializationIds + badge sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: { uid: 'u1' } } as unknown as ReturnType<typeof useAuth>);
    try { localStorage.clear(); } catch { /* noop */ }
  });

  it('starts with no earned specializations', () => {
    const { result } = renderHook(() => useAcademyProgress(), { wrapper });
    expect(result.current.earnedSpecializationIds).toEqual([]);
    expect(academyBadgesService.setOwnBadges).not.toHaveBeenCalled();
  });

  it('marks a specialization earned once every lesson is applied + quizzed, syncing exactly once', async () => {
    const { result } = renderHook(() => useAcademyProgress(), { wrapper });

    for (const id of INCLUSIVE_TEACHER_LESSONS) {
      act(() => result.current.markLessonAsApplied(id));
    }
    // Not yet earned — quizzes still missing
    expect(result.current.earnedSpecializationIds).not.toContain('inclusive-teacher');
    expect(academyBadgesService.setOwnBadges).not.toHaveBeenCalled();

    for (const id of INCLUSIVE_TEACHER_LESSONS.slice(0, -1)) {
      act(() => result.current.markQuizAsCompleted(id));
    }
    // Still one lesson's quiz short
    expect(result.current.earnedSpecializationIds).not.toContain('inclusive-teacher');
    expect(academyBadgesService.setOwnBadges).not.toHaveBeenCalled();

    act(() => result.current.markQuizAsCompleted(INCLUSIVE_TEACHER_LESSONS[INCLUSIVE_TEACHER_LESSONS.length - 1]));

    await waitFor(() => expect(result.current.earnedSpecializationIds).toContain('inclusive-teacher'));
    expect(academyBadgesService.setOwnBadges).toHaveBeenCalledTimes(1);
    expect(academyBadgesService.setOwnBadges).toHaveBeenCalledWith('u1', expect.arrayContaining(['inclusive-teacher']));
  });

  it('does not sync badges when there is no authenticated user', () => {
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null } as unknown as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useAcademyProgress(), { wrapper });

    for (const id of INCLUSIVE_TEACHER_LESSONS) {
      act(() => result.current.markLessonAsApplied(id));
      act(() => result.current.markQuizAsCompleted(id));
    }

    expect(result.current.earnedSpecializationIds).toContain('inclusive-teacher');
    expect(academyBadgesService.setOwnBadges).not.toHaveBeenCalled();
  });
});
