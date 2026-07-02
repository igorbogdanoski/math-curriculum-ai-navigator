import { useQuery } from '@tanstack/react-query';
import { firestoreService } from '../services/firestoreService';
import type { QuizResult } from '../services/firestoreService';

export interface ConceptInsight {
  conceptId: string;
  totalSessions: number;
  avgPercentage: number;
  labSessions: number;
  labAvg: number;
  regularSessions: number;
}

export interface ClassInsightsData {
  /** Regular quiz sessions matching these concepts */
  regularSessions: number;
  regularAvg: number;
  /** Lab sessions (quizType === 'lab') matching these concepts */
  labSessions: number;
  labAvg: number;
  /** ConceptIds where avg < 70 — need attention */
  weakConceptIds: string[];
  /** Per-concept breakdown */
  byConceptId: ConceptInsight[];
  /** Recent trend: last-5 vs previous-5 avg difference */
  trend: number;
}

const EMPTY: ClassInsightsData = {
  regularSessions: 0, regularAvg: 0,
  labSessions: 0, labAvg: 0,
  weakConceptIds: [], byConceptId: [], trend: 0,
};

function computeInsights(results: QuizResult[], conceptIds: string[]): ClassInsightsData {
  const set = new Set(conceptIds);
  const matched = results.filter(r => r.conceptId && set.has(r.conceptId));
  if (matched.length === 0) return EMPTY;

  const labs    = matched.filter(r => r.quizType === 'lab');
  const regular = matched.filter(r => r.quizType !== 'lab');

  const avg = (arr: QuizResult[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, r) => s + r.percentage, 0) / arr.length);

  // Per-concept breakdown
  const byConceptId: ConceptInsight[] = conceptIds.map(cid => {
    const cAll  = matched.filter(r => r.conceptId === cid);
    const cLabs = cAll.filter(r => r.quizType === 'lab');
    const cReg  = cAll.filter(r => r.quizType !== 'lab');
    return {
      conceptId: cid,
      totalSessions: cAll.length,
      avgPercentage: avg(cAll),
      labSessions: cLabs.length,
      labAvg: avg(cLabs),
      regularSessions: cReg.length,
    };
  }).filter(c => c.totalSessions > 0);

  const weakConceptIds = byConceptId
    .filter(c => c.avgPercentage > 0 && c.avgPercentage < 70)
    .map(c => c.conceptId);

  // Trend: last-5 sessions vs previous-5
  const sorted = [...regular].sort((a, b) => {
    const ta = a.playedAt?.toDate?.()?.getTime() ?? 0;
    const tb = b.playedAt?.toDate?.()?.getTime() ?? 0;
    return tb - ta;
  });
  const last5 = avg(sorted.slice(0, 5));
  const prev5 = avg(sorted.slice(5, 10));
  const trend = last5 > 0 && prev5 > 0 ? last5 - prev5 : 0;

  return {
    regularSessions: regular.length,
    regularAvg:      avg(regular),
    labSessions:     labs.length,
    labAvg:          avg(labs),
    weakConceptIds,
    byConceptId,
    trend,
  };
}

export function useClassInsights(
  conceptIds: string[],
  teacherUid: string | undefined,
): { data: ClassInsightsData; isLoading: boolean } {
  const enabled = !!teacherUid && conceptIds.length > 0;

  const { data: results = [], isLoading } = useQuery<QuizResult[]>({
    queryKey: ['class-insights', teacherUid, conceptIds.join(',')],
    queryFn:  () => firestoreService.fetchQuizResults(500, teacherUid),
    enabled,
    staleTime: 5 * 60 * 1000,   // 5 min — class data doesn't change often
    gcTime:    15 * 60 * 1000,
  });

  const data = enabled ? computeInsights(results, conceptIds) : EMPTY;
  return { data, isLoading: enabled ? isLoading : false };
}
