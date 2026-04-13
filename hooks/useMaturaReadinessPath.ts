import { useMemo, useState, useCallback } from 'react';
import type { UseMaturaStatsResult } from './useMaturaStats';

export const MATURA_EXAM_DATE_KEY = 'matura_exam_date';
const DEFAULT_DAYS = 90;
const PASS_THRESHOLD_PCT = 55;

export interface PathStep {
  rank: number;
  conceptId: string;
  conceptTitle: string;
  pct: number;
  status: 'weak' | 'uncovered';
  priority: number;
  weekNumber: number;
  topicArea?: string;
}

export interface ReadinessPath {
  daysUntilExam: number;
  weeksUntilExam: number;
  examDate: Date | null;
  hasExamDate: boolean;
  examPassed: boolean;
  steps: PathStep[];
  onTrack: boolean;
  recommendedPerWeek: number;
}

/** Pure function — usable in tests without React */
export function computeReadinessPath(
  weakConcepts: UseMaturaStatsResult['weakConcepts'],
  daysUntilExam: number,
): Omit<ReadinessPath, 'examDate' | 'hasExamDate'> {
  const examPassed = daysUntilExam <= 0;
  const effectiveDays = Math.max(1, daysUntilExam);
  const weeksUntilExam = Math.max(1, Math.floor(effectiveDays / 7));

  // Uncovered (pct === 0) first, then ascending by pct
  const needWork = [...weakConcepts]
    .filter((c) => c.pct < PASS_THRESHOLD_PCT)
    .sort((a, b) => {
      if (a.pct === 0 && b.pct !== 0) return -1;
      if (b.pct === 0 && a.pct !== 0) return 1;
      return a.pct - b.pct;
    });

  const recommendedPerWeek = Math.max(1, Math.ceil(needWork.length / weeksUntilExam));

  const steps: PathStep[] = needWork.map((item, i) => ({
    rank: i + 1,
    conceptId: item.concept.id,
    conceptTitle: item.concept.title,
    pct: item.pct,
    status: item.pct === 0 ? 'uncovered' : 'weak',
    priority: i + 1,
    weekNumber: Math.floor(i / recommendedPerWeek) + 1,
    topicArea: item.topicArea,
  }));

  return {
    daysUntilExam: effectiveDays,
    weeksUntilExam,
    examPassed,
    steps: examPassed ? [] : steps,
    onTrack: !examPassed && needWork.length <= weeksUntilExam,
    recommendedPerWeek,
  };
}

export function useMaturaReadinessPath(
  weakConcepts: UseMaturaStatsResult['weakConcepts'],
): ReadinessPath & { setExamDate: (date: string) => void } {
  const [examDateStr, setExamDateStr] = useState<string>(() => {
    try { return localStorage.getItem(MATURA_EXAM_DATE_KEY) ?? ''; } catch { return ''; }
  });

  const setExamDate = useCallback((dateStr: string) => {
    setExamDateStr(dateStr);
    try {
      if (dateStr) localStorage.setItem(MATURA_EXAM_DATE_KEY, dateStr);
      else localStorage.removeItem(MATURA_EXAM_DATE_KEY);
    } catch { /* ignore */ }
  }, []);

  const { examDate, daysUntilExam, hasExamDate } = useMemo(() => {
    if (!examDateStr) return { examDate: null, daysUntilExam: DEFAULT_DAYS, hasExamDate: false };
    const d = new Date(examDateStr);
    if (isNaN(d.getTime())) return { examDate: null, daysUntilExam: DEFAULT_DAYS, hasExamDate: false };
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    return { examDate: d, daysUntilExam: days, hasExamDate: true };
  }, [examDateStr]);

  const path = useMemo(
    () => computeReadinessPath(weakConcepts, daysUntilExam),
    [weakConcepts, daysUntilExam],
  );

  return { ...path, examDate, hasExamDate, setExamDate, examPassed: path.examPassed };
}
