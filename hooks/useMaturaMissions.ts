import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  buildMissionPlan,
  getActiveMaturaMission,
  saveMaturaMissionPlan,
  type MaturaMissionDay,
  type MaturaMissionPlan,
  type MissionStatus,
} from '../services/firestoreService.matura';

export interface UseMaturaMissionsResult {
  mission: MaturaMissionPlan | null;
  loading: boolean;
  /** Today's mission day (1-based), or null if plan expired / not started. */
  todayDay: MaturaMissionDay | null;
  /** Start a new 7-day plan; replaces any existing plan. */
  startMission: (params: {
    sourceConceptId: string;
    sourceConceptTitle: string;
    primaryTopicArea: string;
  }) => Promise<void>;
  /** Mark a specific day as completed (with optional pctAfter score). */
  completeDay: (day: number, pctAfter?: number) => Promise<void>;
  /** Mark a day as skipped (does not break streak). */
  skipDay: (day: number) => Promise<void>;
  /** Human-readable streak label. */
  streakLabel: string;
}

function computeStreak(days: MaturaMissionDay[], createdAt: string): number {
  const todayDay = Math.min(daysElapsed(createdAt) + 1, 7);

  let streak = 0;
  for (const d of [...days]
    .filter((day) => day.day <= todayDay)
    .sort((a, b) => b.day - a.day)) {
    if (d.status === 'completed') streak++;
    else if (d.status === 'pending') break;
    // skipped days don't break the streak but don't extend it
  }
  return streak;
}

function daysElapsed(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

export function useMaturaMissions(): UseMaturaMissionsResult {
  const { firebaseUser } = useAuth();
  const [mission, setMission] = useState<MaturaMissionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    if (!firebaseUser?.uid) { setMission(null); return; }

    setLoading(true);
    void getActiveMaturaMission(firebaseUser.uid)
      .then((plan) => { if (!canceled) setMission(plan); })
      .finally(() => { if (!canceled) setLoading(false); });

    return () => { canceled = true; };
  }, [firebaseUser?.uid]);

  const startMission = useCallback(async ({
    sourceConceptId,
    sourceConceptTitle,
    primaryTopicArea,
  }: {
    sourceConceptId: string;
    sourceConceptTitle: string;
    primaryTopicArea: string;
  }) => {
    if (!firebaseUser?.uid) return;
    const plan = buildMissionPlan(
      firebaseUser.uid,
      sourceConceptId,
      sourceConceptTitle,
      primaryTopicArea,
    );
    setMission(plan);
    await saveMaturaMissionPlan(firebaseUser.uid, plan);
  }, [firebaseUser?.uid]);

  const updateDay = useCallback(async (day: number, status: MissionStatus, pctAfter?: number) => {
    if (!firebaseUser?.uid || !mission) return;

    const updatedDays = mission.days.map((d) =>
      d.day === day
        ? { ...d, status, completedAt: new Date().toISOString(), ...(pctAfter !== undefined ? { pctAfter } : {}) }
        : d,
    );

    const streak = computeStreak(updatedDays, mission.createdAt);
    const badgeEarned = updatedDays.every((d) => d.status === 'completed' || d.status === 'skipped')
      && updatedDays.some((d) => d.status === 'completed');

    const updated: MaturaMissionPlan = { ...mission, days: updatedDays, streakCount: streak, badgeEarned };
    setMission(updated);
    await saveMaturaMissionPlan(firebaseUser.uid, updated);
  }, [firebaseUser?.uid, mission]);

  const completeDay = useCallback(
    (day: number, pctAfter?: number) => updateDay(day, 'completed', pctAfter),
    [updateDay],
  );

  const skipDay = useCallback(
    (day: number) => updateDay(day, 'skipped'),
    [updateDay],
  );

  const elapsed = mission ? daysElapsed(mission.createdAt) : 0;
  const todayDay = mission
    ? (elapsed >= 0 && elapsed < mission.days.length ? (mission.days[elapsed] ?? null) : null)
    : null;

  const streakLabel = mission
    ? mission.badgeEarned
      ? '🏆 Завршено!'
      : mission.streakCount > 0
        ? `🔥 ${mission.streakCount} ден${mission.streakCount === 1 ? '' : 'а'} по ред`
        : 'Започни денеска'
    : '';

  return { mission, loading, todayDay, startMission, completeDay, skipDay, streakLabel };
}
