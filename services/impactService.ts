import { fetchMyScenarios } from './firestoreService.scenarioBank';
import { fetchMyAnnualPlans } from './firestoreService.materials';
import { subscribeMyDuggaTests, type DuggaTest } from './firestoreService.dugga';

export interface ImpactSurfaceStats {
  totalShared: number;
  totalForksOrAdapts: number;
  totalRatings: number;
  avgRating: number | null;
}

export interface ImpactSummary {
  scenarioBank: ImpactSurfaceStats;
  annualPlans: ImpactSurfaceStats;
  duggaTests: ImpactSurfaceStats;
  totals: ImpactSurfaceStats;
}

function ratingStats(ratingsByUidList: (Record<string, number> | undefined)[]): { count: number; avg: number | null } {
  const values = ratingsByUidList.flatMap(r => Object.values(r ?? {}));
  if (values.length === 0) return { count: 0, avg: null };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { count: values.length, avg: Math.round(avg * 10) / 10 };
}

function combine(...stats: ImpactSurfaceStats[]): ImpactSurfaceStats {
  const totalShared = stats.reduce((a, s) => a + s.totalShared, 0);
  const totalForksOrAdapts = stats.reduce((a, s) => a + s.totalForksOrAdapts, 0);
  const totalRatings = stats.reduce((a, s) => a + s.totalRatings, 0);
  const ratingSum = stats.reduce((a, s) => a + (s.avgRating ?? 0) * s.totalRatings, 0);
  const avgRating = totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 10) / 10 : null;
  return { totalShared, totalForksOrAdapts, totalRatings, avgRating };
}

/** One-shot fetch of a teacher's Dugga tests — subscribeMyDuggaTests is live, so this takes the first snapshot and unsubscribes. */
function fetchMyDuggaTestsOnce(uid: string): Promise<DuggaTest[]> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | null = null;
    let resolved = false;
    unsubscribe = subscribeMyDuggaTests(uid, (tests) => {
      if (resolved) return;
      resolved = true;
      resolve(tests);
      unsubscribe?.();
    });
    if (resolved) unsubscribe();
  });
}

/** Aggregates a teacher's fork/adapt/rating stats across all their shared content — no new Firestore writes, read-only. */
export async function fetchTeacherImpactSummary(uid: string): Promise<ImpactSummary> {
  const [scenarios, annualPlans, duggaTests] = await Promise.all([
    fetchMyScenarios(uid),
    fetchMyAnnualPlans(uid),
    fetchMyDuggaTestsOnce(uid),
  ]);

  const scenarioRatings = ratingStats(scenarios.map(s => s.ratingsByUid));
  const scenarioBank: ImpactSurfaceStats = {
    totalShared: scenarios.filter(s => s.isPublic).length,
    totalForksOrAdapts: scenarios.reduce((a, s) => a + (s.forkCount ?? 0), 0),
    totalRatings: scenarioRatings.count,
    avgRating: scenarioRatings.avg,
  };

  const annualPlanRatings = ratingStats(annualPlans.map(p => p.ratingsByUid));
  const annualPlansStats: ImpactSurfaceStats = {
    totalShared: annualPlans.filter(p => p.isPublic).length,
    totalForksOrAdapts: annualPlans.reduce((a, p) => a + (p.forks ?? 0), 0),
    totalRatings: annualPlanRatings.count,
    avgRating: annualPlanRatings.avg,
  };

  const duggaStats: ImpactSurfaceStats = {
    totalShared: duggaTests.filter(t => t.isPublic).length,
    totalForksOrAdapts: duggaTests.reduce((a, t) => a + (t.adaptCount ?? 0), 0),
    totalRatings: 0,
    avgRating: null,
  };

  return {
    scenarioBank,
    annualPlans: annualPlansStats,
    duggaTests: duggaStats,
    totals: combine(scenarioBank, annualPlansStats, duggaStats),
  };
}
