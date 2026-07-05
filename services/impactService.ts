import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { fetchMyScenarios } from './firestoreService.scenarioBank';
import { fetchMyAnnualPlans } from './firestoreService.materials';
import { subscribeMyDuggaTests, type DuggaTest } from './firestoreService.dugga';
import type { QuizResult } from './firestoreService.types';

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
  /** null when there isn't enough retest data yet (no student has attempted the
   *  same concept twice) rather than 0, so the UI can distinguish "no signal yet"
   *  from "no improvement". */
  retestImprovement: RetestImprovement | null;
}

export interface RetestImprovement {
  /** Distinct students who re-attempted at least one concept. */
  studentsWithRetest: number;
  /** Distinct concept×student pairs re-attempted — the sample size behind avgImprovementPct. */
  retestCount: number;
  /** Average (last attempt % − first attempt %) across all re-attempted concept×student pairs. */
  avgImprovementPct: number;
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

/**
 * Turns raw per-attempt quiz history into a pedagogy signal: for every
 * student×concept pair attempted 2+ times, compares the oldest vs newest
 * attempt's percentage. Reuses the same bounded/ordered query shape as
 * fetchClassStats (services/firestoreService.classroom.ts) rather than an
 * unbounded scan — same accepted "most recent 500" tradeoff, not a new one.
 */
async function computeRetestImprovement(uid: string): Promise<RetestImprovement | null> {
  const snap = await getDocs(query(
    collection(db, 'quiz_results'),
    where('teacherUid', '==', uid),
    orderBy('playedAt', 'desc'),
    limit(500),
  ));

  const byStudentConcept = new Map<string, QuizResult[]>();
  snap.forEach(d => {
    const r = d.data() as QuizResult;
    if (!r.studentName || !r.conceptId || typeof r.percentage !== 'number') return;
    const key = `${r.studentName}|${r.conceptId}`;
    const bucket = byStudentConcept.get(key) ?? [];
    bucket.push(r);
    byStudentConcept.set(key, bucket);
  });

  const students = new Set<string>();
  const improvements: number[] = [];
  for (const [key, attempts] of byStudentConcept) {
    if (attempts.length < 2) continue;
    const sorted = [...attempts].sort((a, b) => (a.playedAt?.toMillis?.() ?? 0) - (b.playedAt?.toMillis?.() ?? 0));
    const first = sorted[0].percentage;
    const last = sorted[sorted.length - 1].percentage;
    improvements.push(last - first);
    students.add(key.split('|')[0]);
  }

  if (improvements.length === 0) return null;
  const avgImprovementPct = Math.round(
    (improvements.reduce((a, b) => a + b, 0) / improvements.length) * 10
  ) / 10;
  return { studentsWithRetest: students.size, retestCount: improvements.length, avgImprovementPct };
}

/** Aggregates a teacher's fork/adapt/rating stats across all their shared content — no new Firestore writes, read-only. */
export async function fetchTeacherImpactSummary(uid: string): Promise<ImpactSummary> {
  const [scenarios, annualPlans, duggaTests, retestImprovement] = await Promise.all([
    fetchMyScenarios(uid),
    fetchMyAnnualPlans(uid),
    fetchMyDuggaTestsOnce(uid),
    computeRetestImprovement(uid).catch(() => null),
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
    retestImprovement,
  };
}
