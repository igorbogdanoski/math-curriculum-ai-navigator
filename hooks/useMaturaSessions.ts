import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMaturaExams, useMaturaQuestions } from './useMatura';
import {
  getUserMaturaResults,
  type MaturaQuestion,
  type MaturaStoredResult,
} from '../services/firestoreService.matura';

export interface MaturaSessionBucket {
  key: string;
  label: string;
  correct: number;
  max: number;
  questions: number;
  pct: number;
}

export interface MaturaSessionSummary {
  id: string;
  examId: string;
  examTitle: string;
  completedAt: string;
  completedAtTs: number;
  totalScore: number;
  maxScore: number;
  pct: number;
  durationSeconds: number;
  questionCount: number;
  avgSecPerQuestion: number;
  source: 'local' | 'firestore';
  perTopic: MaturaSessionBucket[];
  perPart: MaturaSessionBucket[];
  perDoK: MaturaSessionBucket[];
  questions: Array<{
    questionNumber: number;
    score: number;
    maxPoints: number;
    correct: boolean;
    topicArea?: string;
    part?: number;
    dokLevel?: number;
    questionText?: string;
  }>;
}

export interface UseMaturaSessionsResult {
  loading: boolean;
  sessions: MaturaSessionSummary[];
}

function pct(correct: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((correct / max) * 1000) / 10;
}

function resultLocalKey(examId: string): string {
  return `matura_sim_result_${examId}`;
}

function parseStoredResult(raw: string | null): MaturaStoredResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MaturaStoredResult;
    if (!parsed?.examId || !parsed?.grades) return null;
    return parsed;
  } catch {
    return null;
  }
}

function bucketize(
  rows: Array<{ key: string | number; correct: number; max: number; questions: number }>,
  labelOf: (k: string | number) => string,
): MaturaSessionBucket[] {
  return rows.map((r) => ({
    key: String(r.key),
    label: labelOf(r.key),
    correct: r.correct,
    max: r.max,
    questions: r.questions,
    pct: pct(r.correct, r.max),
  }));
}

function buildSummary(
  attempt: MaturaStoredResult,
  questionByKey: Map<string, MaturaQuestion>,
): MaturaSessionSummary {
  const topicAgg = new Map<string, { correct: number; max: number; questions: number }>();
  const partAgg = new Map<number, { correct: number; max: number; questions: number }>();
  const dokAgg = new Map<number, { correct: number; max: number; questions: number }>();
  const questions: MaturaSessionSummary['questions'] = [];

  for (const [qNumStr, grade] of Object.entries(attempt.grades)) {
    const questionNumber = Number(qNumStr);
    const q = questionByKey.get(`${attempt.examId}:${questionNumber}`);
    const topicArea = q?.topicArea ?? q?.topic ?? 'other';
    const part = q?.part ?? 1;
    const dok = q?.dokLevel ?? 1;

    const t = topicAgg.get(topicArea) ?? { correct: 0, max: 0, questions: 0 };
    t.correct += grade.score;
    t.max += grade.maxPoints;
    t.questions += 1;
    topicAgg.set(topicArea, t);

    const p = partAgg.get(part) ?? { correct: 0, max: 0, questions: 0 };
    p.correct += grade.score;
    p.max += grade.maxPoints;
    p.questions += 1;
    partAgg.set(part, p);

    const d = dokAgg.get(dok) ?? { correct: 0, max: 0, questions: 0 };
    d.correct += grade.score;
    d.max += grade.maxPoints;
    d.questions += 1;
    dokAgg.set(dok, d);

    questions.push({
      questionNumber,
      score: grade.score,
      maxPoints: grade.maxPoints,
      correct: grade.maxPoints > 0 && grade.score >= grade.maxPoints,
      topicArea,
      part,
      dokLevel: dok,
      questionText: q?.questionText,
    });
  }

  const questionCount = questions.length;
  const avgSecPerQuestion = questionCount > 0
    ? Math.round(attempt.durationSeconds / questionCount)
    : 0;

  return {
    id: `${attempt.examId}::${attempt.completedAt}`,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    completedAt: attempt.completedAt,
    completedAtTs: attempt.completedAtTs ?? new Date(attempt.completedAt).getTime() ?? 0,
    totalScore: attempt.totalScore,
    maxScore: attempt.maxScore,
    pct: pct(attempt.totalScore, attempt.maxScore),
    durationSeconds: attempt.durationSeconds,
    questionCount,
    avgSecPerQuestion,
    source: attempt.source ?? 'firestore',
    perTopic: bucketize(
      Array.from(topicAgg.entries()).map(([k, v]) => ({ key: k, ...v })),
      (k) => String(k),
    ).sort((a, b) => b.questions - a.questions || a.pct - b.pct),
    perPart: bucketize(
      Array.from(partAgg.entries()).map(([k, v]) => ({ key: k, ...v })),
      (k) => `Дел ${k}`,
    ).sort((a, b) => Number(a.key) - Number(b.key)),
    perDoK: bucketize(
      Array.from(dokAgg.entries()).map(([k, v]) => ({ key: k, ...v })),
      (k) => `DoK ${k}`,
    ).sort((a, b) => Number(a.key) - Number(b.key)),
    questions: questions.sort((a, b) => a.questionNumber - b.questionNumber),
  };
}

export function buildSessionSummaries(
  attempts: MaturaStoredResult[],
  questions: MaturaQuestion[],
): MaturaSessionSummary[] {
  const map = new Map<string, MaturaQuestion>();
  for (const q of questions) {
    map.set(`${q.examId}:${q.questionNumber}`, q);
  }
  return attempts
    .map((a) => buildSummary(a, map))
    .sort((a, b) => b.completedAtTs - a.completedAtTs);
}

export function useMaturaSessions(): UseMaturaSessionsResult {
  const { firebaseUser } = useAuth();
  const { exams } = useMaturaExams();
  const [cloud, setCloud] = useState<MaturaStoredResult[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    if (!firebaseUser?.uid) {
      setCloud([]);
      return;
    }
    setCloudLoading(true);
    void getUserMaturaResults(firebaseUser.uid)
      .then((rows) => {
        if (!canceled) setCloud(rows);
      })
      .finally(() => {
        if (!canceled) setCloudLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [firebaseUser?.uid]);

  const local = useMemo<MaturaStoredResult[]>(() => {
    if (typeof window === 'undefined' || exams.length === 0) return [];
    return exams
      .map((exam) => parseStoredResult(window.localStorage.getItem(resultLocalKey(exam.id))))
      .filter((row): row is MaturaStoredResult => Boolean(row))
      .map((row) => ({ ...row, source: 'local' as const }));
  }, [exams]);

  const merged = useMemo<MaturaStoredResult[]>(() => {
    const dedup = new Map<string, MaturaStoredResult>();
    for (const row of cloud) dedup.set(`${row.examId}:${row.completedAt}`, row);
    for (const row of local) {
      const k = `${row.examId}:${row.completedAt}`;
      if (!dedup.has(k)) dedup.set(k, row);
    }
    return Array.from(dedup.values());
  }, [cloud, local]);

  const examIds = useMemo(
    () => Array.from(new Set(merged.map((r) => r.examId))).sort(),
    [merged],
  );
  const { questions, loading: questionsLoading } = useMaturaQuestions(
    examIds,
    undefined,
    examIds.length > 0,
  );

  const sessions = useMemo(
    () => buildSessionSummaries(merged, questions),
    [merged, questions],
  );

  return {
    loading: cloudLoading || questionsLoading,
    sessions,
  };
}
