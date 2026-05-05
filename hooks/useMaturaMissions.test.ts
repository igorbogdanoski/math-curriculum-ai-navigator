/**
 * Tests for useMaturaMissions (T1.3).
 *
 * Strategy: mock auth + firestore service helpers; drive the hook through
 * startMission → completeDay → skipDay flows and assert local state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../services/firestoreService.matura', async () => {
  const actual = await vi.importActual<typeof import('../services/firestoreService.matura')>(
    '../services/firestoreService.matura',
  );
  return {
    ...actual,
    getActiveMaturaMission: vi.fn(),
    saveMaturaMissionPlan: vi.fn(async () => undefined),
  };
});

import { useAuth } from '../contexts/AuthContext';
import {
  buildMissionPlan,
  getActiveMaturaMission,
  saveMaturaMissionPlan,
  type MaturaMissionPlan,
} from '../services/firestoreService.matura';
import { useMaturaMissions } from './useMaturaMissions';

function setUser(uid: string | null) {
  vi.mocked(useAuth).mockReturnValue({
    firebaseUser: uid ? { uid } : null,
    user: null,
  } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setUser(null);
  vi.mocked(getActiveMaturaMission).mockResolvedValue(null);
  vi.mocked(saveMaturaMissionPlan).mockResolvedValue(undefined);
});

describe('useMaturaMissions — initial load', () => {
  it('mission is null when user is not signed in', async () => {
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mission).toBeNull();
    expect(getActiveMaturaMission).not.toHaveBeenCalled();
  });

  it('fetches active mission for signed-in user', async () => {
    setUser('uid-1');
    const stored = buildMissionPlan('uid-1', 'c1', 'C1', 'algebra');
    vi.mocked(getActiveMaturaMission).mockResolvedValueOnce(stored);

    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.mission?.id).toBe(stored.id));
    expect(getActiveMaturaMission).toHaveBeenCalledWith('uid-1');
  });

  it('exposes loading=true initially', async () => {
    setUser('uid-1');
    let resolve: (v: MaturaMissionPlan | null) => void = () => {};
    vi.mocked(getActiveMaturaMission).mockImplementationOnce(
      () => new Promise(r => { resolve = r; }),
    );
    const { result } = renderHook(() => useMaturaMissions());
    expect(result.current.loading).toBe(true);
    act(() => resolve(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});

describe('useMaturaMissions — startMission', () => {
  it('builds and persists a new plan', async () => {
    setUser('uid-1');
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'Алгебра — Концепт 1', primaryTopicArea: 'algebra',
      });
    });

    expect(result.current.mission).not.toBeNull();
    expect(result.current.mission?.uid).toBe('uid-1');
    expect(result.current.mission?.days).toHaveLength(7);
    expect(saveMaturaMissionPlan).toHaveBeenCalledWith('uid-1', expect.objectContaining({ uid: 'uid-1' }));
  });

  it('is a no-op when user is not signed in', async () => {
    setUser(null);
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'C', primaryTopicArea: 'algebra',
      });
    });

    expect(saveMaturaMissionPlan).not.toHaveBeenCalled();
    expect(result.current.mission).toBeNull();
  });
});

describe('useMaturaMissions — completeDay / skipDay', () => {
  async function startedHook() {
    setUser('uid-1');
    const hook = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'C', primaryTopicArea: 'algebra',
      });
    });
    return hook;
  }

  it('completeDay marks the day as completed and persists', async () => {
    const { result } = await startedHook();
    await act(async () => { await result.current.completeDay(1, 80); });

    const day1 = result.current.mission?.days.find(d => d.day === 1);
    expect(day1?.status).toBe('completed');
    expect(day1?.pctAfter).toBe(80);
    // 1 fetch on init (returns null), 1 save in startMission, 1 save in completeDay = 2 saves
    expect(saveMaturaMissionPlan).toHaveBeenCalledTimes(2);
  });

  it('completeDay increments streakCount for the current day', async () => {
    const { result } = await startedHook();
    await act(async () => { await result.current.completeDay(1, 100); });
    expect(result.current.mission?.streakCount).toBe(1);
  });

  it('skipDay marks the day as skipped and does not increment streak', async () => {
    const { result } = await startedHook();
    await act(async () => { await result.current.skipDay(1); });

    const day1 = result.current.mission?.days.find(d => d.day === 1);
    expect(day1?.status).toBe('skipped');
    expect(result.current.mission?.streakCount).toBe(0);
  });

  it('completeDay is a no-op without active mission', async () => {
    setUser('uid-1');
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // No startMission called → no mission
    await act(async () => { await result.current.completeDay(1); });
    expect(saveMaturaMissionPlan).not.toHaveBeenCalled();
  });

  it('marks badgeEarned=true when all days are completed', async () => {
    const { result } = await startedHook();
    for (let d = 1; d <= 7; d++) {
      await act(async () => { await result.current.completeDay(d, 90); });
    }
    expect(result.current.mission?.badgeEarned).toBe(true);
  });
});

describe('useMaturaMissions — derived values', () => {
  it('todayDay is day 1 immediately after startMission (elapsed=0)', async () => {
    setUser('uid-1');
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'C', primaryTopicArea: 'algebra',
      });
    });
    expect(result.current.todayDay?.day).toBe(1);
  });

  it('streakLabel reads "Започни денеска" with no completions', async () => {
    setUser('uid-1');
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'C', primaryTopicArea: 'algebra',
      });
    });
    expect(result.current.streakLabel).toBe('Започни денеска');
  });

  it('streakLabel includes 🔥 emoji + count after completion', async () => {
    setUser('uid-1');
    const { result } = renderHook(() => useMaturaMissions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.startMission({
        sourceConceptId: 'c1', sourceConceptTitle: 'C', primaryTopicArea: 'algebra',
      });
    });
    await act(async () => { await result.current.completeDay(1, 90); });
    expect(result.current.streakLabel).toContain('🔥');
    expect(result.current.streakLabel).toContain('1');
  });
});
