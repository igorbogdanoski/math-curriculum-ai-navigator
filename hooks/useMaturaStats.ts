import { useEffect, useMemo, useState } from 'react';
import { useMaturaExams, useMaturaQuestions } from './useMatura';
import { useMaturaCurriculumAlignment } from './useMaturaCurriculumAlignment';
import type { Concept } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getUserMaturaResults, type MaturaStoredResult } from '../services/firestoreService.matura';

type SimResult = MaturaStoredResult;

interface BucketStat {
  correct: number;
  max: number;
  questions: number;
  pct: number;
}

export interface ConceptDelta {
  pctBefore: number | null;
  pctAfter: number;
  deltaAt: string;
}

export interface UseMaturaStatsResult {
  loading: boolean;
  hasAttempts: boolean;
  attempts: number;
  avgPct: number;
  bestPct: number;
  passRatePct: number;
  avgDurationMin: number;
  lastAttemptAt: string | null;
  partStats: Record<number, BucketStat>;
  topicStats: Array<{ key: string; label: string; pct: number; questions: number }>;
  dokStats: Array<{ level: number; pct: number; questions: number }>;
  weakConcepts: Array<{
    concept: Concept & { gradeLevel: number; topicId: string; topicTitle?: string; gradeTitle?: string };
    pct: number;
    questions: number;
    topicArea?: string;
    dokLevel?: number;
    delta?: ConceptDelta;
  }>;
}

function resultKey(examId: string): string {
  return `matura_sim_result_${examId}`;
}

function parseStoredResult(raw: string | null): SimResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SimResult;
    if (!parsed?.examId || !parsed?.grades) return null;
    return parsed;
  } catch {
    return null;
  }
}

function pct(correct: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((correct / max) * 1000) / 10;
}

export function useMaturaStats(): UseMaturaStatsResult {
  const { exams, loading: examsLoading } = useMaturaExams();
  const { firebaseUser } = useAuth();

  const [cloudResults, setCloudResults] = useState<SimResult[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    let canceled = false;

    if (!firebaseUser?.uid) {
      setCloudResults([]);
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    void getUserMaturaResults(firebaseUser.uid)
      .then((rows) => {
        if (canceled) return;
        setCloudResults(rows);
      })
      .finally(() => {
        if (!canceled) setCloudLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [firebaseUser?.uid]);

  const localResults = useMemo(() => {
    if (typeof window === 'undefined' || exams.length === 0) return [] as SimResult[];

    return exams
      .map((exam) => parseStoredResult(window.localStorage.getItem(resultKey(exam.id))))
      .filter((item): item is SimResult => Boolean(item))
      .map((item) => ({ ...item, source: 'local' as const }))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [exams]);

  const results = useMemo(() => {
    const dedup = new Map<string, SimResult>();

    for (const row of cloudResults) {
      dedup.set(`${row.examId}:${row.completedAt}`, row);
    }
    for (const row of localResults) {
      const key = `${row.examId}:${row.completedAt}`;
      if (!dedup.has(key)) dedup.set(key, row);
    }

    return Array.from(dedup.values())
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [cloudResults, localResults]);

  const attemptedExamIds = useMemo(
    () => Array.from(new Set(results.map((result) => result.examId))).sort(),
    [results],
  );

  const { questions, loading: questionsLoading } = useMaturaQuestions(
    attemptedExamIds,
    undefined,
    attemptedExamIds.length > 0,
  );

  const { alignedQuestions } = useMaturaCurriculumAlignment(questions, 'gymnasium');

  // Read per-concept practice deltas saved by MaturaPracticeView recovery sessions
  const conceptDeltas = useMemo<Map<string, ConceptDelta>>(() => {
    const map = new Map<string, ConceptDelta>();
    try {
      if (typeof window === 'undefined') return map;
      const raw = window.localStorage.getItem('matura_concept_progress');
      if (raw) {
        const entries = JSON.parse(raw) as Array<{
          conceptId: string;
          pctBefore: number | null;
          pctAfter: number;
          practiceAt: string;
        }>;
        for (const entry of entries) {
          if (entry.conceptId) {
            map.set(entry.conceptId, {
              pctBefore: entry.pctBefore,
              pctAfter: entry.pctAfter,
              deltaAt: entry.practiceAt,
            });
          }
        }
      }
    } catch {
      // ignore localStorage parse errors
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable per hook mount; re-reads when M5 view re-mounts after practice

  const result = useMemo<UseMaturaStatsResult>(() => {
    const base: UseMaturaStatsResult = {
      loading: examsLoading || questionsLoading || cloudLoading,
      hasAttempts: results.length > 0,
      attempts: results.length,
      avgPct: 0,
      bestPct: 0,
      passRatePct: 0,
      avgDurationMin: 0,
      lastAttemptAt: null,
      partStats: {
        1: { correct: 0, max: 0, questions: 0, pct: 0 },
        2: { correct: 0, max: 0, questions: 0, pct: 0 },
        3: { correct: 0, max: 0, questions: 0, pct: 0 },
      },
      topicStats: [],
      dokStats: [],
      weakConcepts: [],
    };

    if (results.length === 0) return base;

    const questionByKey = new Map<string, typeof questions[number]>();
    for (const question of questions) {
      questionByKey.set(`${question.examId}:${question.questionNumber}`, question);
    }

    const alignmentByQuestionKey = new Map<string, (typeof alignedQuestions)[number]['alignment']>();
    for (const entry of alignedQuestions) {
      const q = entry.question;
      const key = q.id ?? `${q.examId ?? 'unknown'}:${q.questionNumber ?? -1}`;
      alignmentByQuestionKey.set(key, entry.alignment);
    }

    const partAgg = {
      1: { correct: 0, max: 0, questions: 0 },
      2: { correct: 0, max: 0, questions: 0 },
      3: { correct: 0, max: 0, questions: 0 },
    } as Record<number, { correct: number; max: number; questions: number }>;

    const topicAgg = new Map<string, { correct: number; max: number; questions: number }>();
    const dokAgg = new Map<number, { correct: number; max: number; questions: number }>();
    const conceptAgg = new Map<string, {
      concept: UseMaturaStatsResult['weakConcepts'][number]['concept'];
      correct: number;
      max: number;
      questions: number;
      topicAreaCounts: Map<string, number>;
      dokCounts: Map<number, number>;
    }>();

    let passCount = 0;
    let totalPct = 0;
    let bestPct = 0;
    let totalDuration = 0;

    for (const attempt of results) {
      const attemptPct = pct(attempt.totalScore, attempt.maxScore);
      totalPct += attemptPct;
      bestPct = Math.max(bestPct, attemptPct);
      totalDuration += attempt.durationSeconds;
      if (attempt.totalScore >= 35) passCount += 1;

      for (const [questionNumberRaw, grade] of Object.entries(attempt.grades)) {
        const questionNumber = Number(questionNumberRaw);
        const question = questionByKey.get(`${attempt.examId}:${questionNumber}`);
        if (!question) continue;

        const part = question.part ?? 1;
        if (!partAgg[part]) partAgg[part] = { correct: 0, max: 0, questions: 0 };
        partAgg[part].correct += grade.score;
        partAgg[part].max += grade.maxPoints;
        partAgg[part].questions += 1;

        const topicKey = question.topicArea ?? question.topic ?? 'other';
        const topicState = topicAgg.get(topicKey) ?? { correct: 0, max: 0, questions: 0 };
        topicState.correct += grade.score;
        topicState.max += grade.maxPoints;
        topicState.questions += 1;
        topicAgg.set(topicKey, topicState);

        const dokLevel = question.dokLevel ?? 1;
        const dokState = dokAgg.get(dokLevel) ?? { correct: 0, max: 0, questions: 0 };
        dokState.correct += grade.score;
        dokState.max += grade.maxPoints;
        dokState.questions += 1;
        dokAgg.set(dokLevel, dokState);

        const alignmentKey = `${question.examId}:${question.questionNumber}`;
        const alignment = alignmentByQuestionKey.get(alignmentKey);
        if (alignment) {
          for (const concept of alignment.concepts) {
            const conceptState = conceptAgg.get(concept.id) ?? {
              concept,
              correct: 0,
              max: 0,
              questions: 0,
              topicAreaCounts: new Map<string, number>(),
              dokCounts: new Map<number, number>(),
            };
            conceptState.correct += grade.score;
            conceptState.max += grade.maxPoints;
            conceptState.questions += 1;
            if (question.topicArea) {
              conceptState.topicAreaCounts.set(
                question.topicArea,
                (conceptState.topicAreaCounts.get(question.topicArea) ?? 0) + 1,
              );
            }
            const level = question.dokLevel ?? 1;
            conceptState.dokCounts.set(level, (conceptState.dokCounts.get(level) ?? 0) + 1);
            conceptAgg.set(concept.id, conceptState);
          }
        }
      }
    }

    const topicStats = Array.from(topicAgg.entries())
      .map(([key, value]) => ({
        key,
        label: key,
        pct: pct(value.correct, value.max),
        questions: value.questions,
      }))
      .sort((a, b) => b.questions - a.questions || b.pct - a.pct);

    const dokStats = Array.from(dokAgg.entries())
      .map(([level, value]) => ({
        level,
        pct: pct(value.correct, value.max),
        questions: value.questions,
      }))
      .sort((a, b) => a.level - b.level);

    const weakConcepts = Array.from(conceptAgg.values())
      .map((value) => ({
        concept: value.concept,
        pct: pct(value.correct, value.max),
        questions: value.questions,
        topicArea: Array.from(value.topicAreaCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
        dokLevel: Array.from(value.dokCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
        delta: conceptDeltas.get(value.concept.id),
      }))
      .filter((item) => item.questions > 0)
      .sort((a, b) => a.pct - b.pct || b.questions - a.questions)
      .slice(0, 8);

    return {
      ...base,
      loading: examsLoading || questionsLoading || cloudLoading,
      hasAttempts: true,
      attempts: results.length,
      avgPct: Math.round((totalPct / results.length) * 10) / 10,
      bestPct: Math.round(bestPct * 10) / 10,
      passRatePct: Math.round((passCount / results.length) * 1000) / 10,
      avgDurationMin: Math.round((totalDuration / results.length) / 60),
      lastAttemptAt: results[0]?.completedAt ?? null,
      partStats: {
        1: { ...partAgg[1], pct: pct(partAgg[1].correct, partAgg[1].max) },
        2: { ...partAgg[2], pct: pct(partAgg[2].correct, partAgg[2].max) },
        3: { ...partAgg[3], pct: pct(partAgg[3].correct, partAgg[3].max) },
      },
      topicStats,
      dokStats,
      weakConcepts,
    };
  }, [results, questions, alignedQuestions, examsLoading, questionsLoading, cloudLoading, conceptDeltas]);

  return result;
}
