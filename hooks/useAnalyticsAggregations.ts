/**
 * useAnalyticsAggregations — all derived analytics computations.
 * Extracted from TeacherAnalyticsView for single-responsibility.
 * Pure useMemo aggregations — no side-effects, no Firestore calls.
 */
import { useMemo } from 'react';
import type { QuizResult, ConceptMastery } from '../services/firestoreService';
import type { Concept, NationalStandard } from '../types';
import {
  groupBy,
  type QuizAggregate,
  type ConceptStat,
  type PerStudentStat,
  type GradeStat,
} from '../views/analytics/shared';

interface UseAnalyticsAggregationsParams {
  localResults: QuizResult[];
  masteryRecords: ConceptMastery[];
  allConcepts: Concept[];
  allNationalStandards: NationalStandard[] | undefined;
  getConceptDetails: (id: string) => { concept?: Concept; grade?: { id: string; level: number; title: string; topics: import('../types').Topic[] }; topic?: import('../types').Topic };
}

export type FullStandardStatus = {
  standard: NationalStandard;
  isCovered: boolean;
  isTested: boolean;
  avgScore: number;
  masteredCount: number;
  coveringConcepts: { id: string; title: string; avgPct: number | undefined }[];
};

export type StandardsCoverage = {
  tested: { standard: { id: string; code: string; description: string }; avgScore: number; conceptCount: number }[];
  notTested: never[];
  all: FullStandardStatus[];
};

export function useAnalyticsAggregations({
  localResults,
  masteryRecords,
  allConcepts,
  allNationalStandards,
  getConceptDetails,
}: UseAnalyticsAggregationsParams) {
  const coreStats = useMemo(() => {
    if (localResults.length === 0) {
      return {
        totalAttempts: 0, avgScore: 0, passRate: 0,
        quizAggregates: [] as QuizAggregate[],
        distribution: [0, 0, 0, 0],
        weakConcepts: [] as ConceptStat[],
        allConceptStats: [] as ConceptStat[],
        uniqueStudents: [] as string[],
      };
    }

    const totalAttempts = localResults.length;
    const avgScore = localResults.reduce((s, r) => s + r.percentage, 0) / totalAttempts;
    const passRate = (localResults.filter(r => r.percentage >= 70).length / totalAttempts) * 100;

    const buckets = [0, 0, 0, 0];
    for (const r of localResults) {
      if (r.percentage < 50) buckets[0]++;
      else if (r.percentage < 70) buckets[1]++;
      else if (r.percentage < 85) buckets[2]++;
      else buckets[3]++;
    }
    const distribution = buckets.map(b => (b / totalAttempts) * 100);

    const grouped = groupBy(localResults, r => r.quizId);
    const quizAggregates: QuizAggregate[] = Object.entries(grouped).map(([quizId, items]) => {
      const pcts = items.map(i => i.percentage);
      const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
      const pass = (items.filter(i => i.percentage >= 70).length / items.length) * 100;
      return {
        quizId,
        quizTitle: items[0].quizTitle || quizId,
        attempts: items.length,
        avgPct: avg,
        bestPct: Math.max(...pcts),
        worstPct: Math.min(...pcts),
        passRate: pass,
      };
    }).sort((a, b) => b.attempts - a.attempts);

    const conceptStats = localResults.filter(r => r.conceptId).reduce((acc, r) => {
      const key = r.conceptId!;
      if (!acc[key]) acc[key] = { total: 0, sum: 0, passCount: 0, students: new Set<string>(), failedStudents: new Set<string>(), quizTitle: r.quizTitle, confSum: 0, confCount: 0, misconceptions: [] as string[], metacognitiveNotes: [] as string[] };
      acc[key].total++;
      acc[key].sum += r.percentage;
      if (r.percentage >= 70) acc[key].passCount++;
      if (r.studentName) {
        acc[key].students.add(r.studentName);
        if (r.percentage < 70) acc[key].failedStudents.add(r.studentName);
      }
      if (r.confidence != null) { acc[key].confSum += r.confidence; acc[key].confCount++; }
      if (r.misconceptions && Array.isArray(r.misconceptions)) {
        r.misconceptions.forEach(m => {
          if (m.misconception && m.misconception !== 'Непозната грешка' && m.misconception !== 'Пресметковна грешка или случајно погодување') {
            acc[key].misconceptions.push(m.misconception);
          }
        });
      }
      if (r.metacognitiveNote && r.metacognitiveNote.trim()) {
        acc[key].metacognitiveNotes.push(r.metacognitiveNote.trim());
      }
      return acc;
    }, {} as Record<string, { total: number; sum: number; passCount: number; students: Set<string>; failedStudents: Set<string>; quizTitle: string; confSum: number; confCount: number; misconceptions: string[]; metacognitiveNotes: string[] }>);

    const allConceptStats: ConceptStat[] = Object.entries(conceptStats).map(([conceptId, s]) => {
      const conceptTitle = getConceptDetails(conceptId).concept?.title || s.quizTitle;
      const masteredCount = masteryRecords.filter(m => m.conceptId === conceptId && m.mastered).length;
      const miscMap: Record<string, number> = {};
      s.misconceptions.forEach(m => (miscMap[m] = (miscMap[m] || 0) + 1));
      const sortedMisconceptions = Object.entries(miscMap)
        .sort((a, b) => b[1] - a[1])
        .map(([text, count]) => ({ text, count }));
      return {
        conceptId,
        title: conceptTitle,
        avgPct: Math.round(s.sum / s.total),
        attempts: s.total,
        passRate: Math.round((s.passCount / s.total) * 100),
        uniqueStudents: s.students.size,
        masteredCount,
        avgConfidence: s.confCount > 0 ? s.confSum / s.confCount : undefined,
        misconceptions: sortedMisconceptions.length > 0 ? sortedMisconceptions : undefined,
        metacognitiveNotes: s.metacognitiveNotes.length > 0 ? s.metacognitiveNotes : undefined,
        strugglingStudents: s.failedStudents.size > 0 ? Array.from(s.failedStudents).sort() : undefined,
      };
    }).sort((a, b) => a.avgPct - b.avgPct);

    const weakConcepts = allConceptStats.filter(c => c.avgPct < 70);
    const uniqueStudents = Array.from(
      new Set(localResults.filter(r => r.studentName).map(r => r.studentName!)),
    ).sort();

    return { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents };
  }, [localResults, masteryRecords, getConceptDetails]);

  const masteryStats = useMemo(() => {
    if (masteryRecords.length === 0) return null;
    const mastered = masteryRecords.filter(m => m.mastered);
    const inProgress = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0);
    const struggling = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores === 0 && m.attempts > 1);
    const masteredByConcept = mastered.reduce((acc, m) => {
      const key = m.conceptId;
      if (!acc[key]) acc[key] = { title: m.conceptTitle || m.conceptId, count: 0, students: [] as string[] };
      acc[key].count++;
      acc[key].students.push(m.studentName);
      return acc;
    }, {} as Record<string, { title: string; count: number; students: string[] }>);
    const topMasteredConcepts = Object.entries(masteredByConcept)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    return { mastered, inProgress, struggling, topMasteredConcepts };
  }, [masteryRecords]);

  const weeklyTrend = useMemo(() => {
    if (localResults.length === 0) return [];
    const weeks: Record<string, { sum: number; count: number; label: string }> = {};
    localResults.forEach(r => {
      if (!r.playedAt) return;
      const d = r.playedAt.toDate ? r.playedAt.toDate() : new Date(r.playedAt as unknown as string);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const label = weekStart.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' });
      if (!weeks[key]) weeks[key] = { sum: 0, count: 0, label };
      weeks[key].sum += r.percentage;
      weeks[key].count++;
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([, v]) => ({ label: v.label, avg: Math.round(v.sum / v.count), count: v.count }));
  }, [localResults]);

  const perStudentStats = useMemo((): PerStudentStat[] => {
    if (localResults.length === 0) return [];
    const grouped = groupBy(localResults.filter(r => r.studentName), r => r.studentName!);
    return Object.entries(grouped).map(([name, items]) => {
      const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);
      const passedCount = items.filter(r => r.percentage >= 70).length;
      const mastery = masteryRecords.filter(m => m.studentName === name);
      const confItems = items.filter(r => r.confidence != null);
      const avgConfidence = confItems.length > 0
        ? confItems.reduce((s, r) => s + r.confidence!, 0) / confItems.length
        : undefined;
      return {
        name,
        attempts: items.length,
        avg,
        passRate: Math.round((passedCount / items.length) * 100),
        masteredCount: mastery.filter(m => m.mastered).length,
        lastAttempt: items[0]?.playedAt,
        avgConfidence,
      };
    }).sort((a, b) => a.avg - b.avg);
  }, [localResults, masteryRecords]);

  const gradeStats = useMemo((): GradeStat[] => {
    if (localResults.length === 0) return [];
    const grouped = groupBy(localResults, r => String(r.gradeLevel ?? 'N/A'));
    return Object.entries(grouped).map(([grade, quizzes]) => {
      const avgs = quizzes.map(q => q.percentage);
      const avgPct = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
      const passRate = Math.round(quizzes.filter(q => q.percentage >= 70).length / quizzes.length * 100);
      const uniqueStudents = new Set(quizzes.map(q => q.studentName).filter(Boolean)).size;
      const masteredCount = masteryRecords.filter(m => m.gradeLevel === Number(grade) && m.mastered).length;
      return { grade, attempts: quizzes.length, avgPct, passRate, uniqueStudents, masteredCount };
    }).sort((a, b) => Number(a.grade) - Number(b.grade));
  }, [localResults, masteryRecords]);

  const standardsCoverage = useMemo((): StandardsCoverage => {
    const testedConceptIds = Array.from(new Set(localResults.filter(r => r.conceptId).map(r => r.conceptId!)));
    const conceptAvg: Record<string, number> = {};
    testedConceptIds.forEach(cid => {
      const conceptResults = localResults.filter(r => r.conceptId === cid);
      if (conceptResults.length > 0) {
        conceptAvg[cid] = Math.round(conceptResults.reduce((s, r) => s + r.percentage, 0) / conceptResults.length);
      }
    });

    const all: FullStandardStatus[] = (allNationalStandards || []).map(s => {
      const coveringConceptIds = Array.from(new Set([
        ...(s.relatedConceptIds || []),
        ...allConcepts.filter(c => c.nationalStandardIds?.includes(s.id)).map(c => c.id),
      ]));
      const isCovered = coveringConceptIds.length > 0;
      const testedForStd = coveringConceptIds.filter(cid => testedConceptIds.includes(cid));
      const isTested = testedForStd.length > 0;
      const avgScore = isTested
        ? Math.round(testedForStd.reduce((sum, cid) => sum + (conceptAvg[cid] ?? 0), 0) / testedForStd.length)
        : 0;
      const stdMasteredCount = coveringConceptIds.reduce((sum, cid) =>
        sum + masteryRecords.filter(m => m.conceptId === cid && m.mastered).length, 0);
      const coveringConcepts = coveringConceptIds.map(cid => {
        const { concept } = getConceptDetails(cid);
        return { id: cid, title: concept?.title || cid, avgPct: conceptAvg[cid] };
      });
      return { standard: s, isCovered, isTested, avgScore, masteredCount: stdMasteredCount, coveringConcepts };
    });

    const tested = all
      .filter(s => s.isTested)
      .map(s => ({ standard: { id: s.standard.id, code: s.standard.code, description: s.standard.description }, avgScore: s.avgScore, conceptCount: s.coveringConcepts.length }))
      .sort((a, b) => a.avgScore - b.avgScore);

    return { tested, notTested: [], all };
  }, [localResults, allNationalStandards, allConcepts, getConceptDetails, masteryRecords]);

  return {
    ...coreStats,
    masteryStats,
    weeklyTrend,
    perStudentStats,
    gradeStats,
    standardsCoverage,
  };
}
