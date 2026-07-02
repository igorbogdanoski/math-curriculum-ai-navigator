import { useState, useEffect, useMemo } from 'react';
import { useStudentProgress } from './useStudentProgress';
import { geminiService } from '../services/geminiService';
import { calcFibonacciLevel, getAvatar } from '../utils/gamification';
import { fetchStudentDuggaSubmissionsByName } from '../services/firestoreService.dugga';
import type { QuizResult, ConceptMastery } from '../services/firestoreService';
import type { DuggaSubmission } from '../services/firestoreService.dugga';

export interface StudentPortfolioData {
  studentName: string;
  isLoading: boolean;
  results: QuizResult[];
  mastery: ConceptMastery[];
  duggaSubs: DuggaSubmission[];
  avgPct: number;
  masteredConcepts: ConceptMastery[];
  bestResults: QuizResult[];
  metacognitiveNotes: QuizResult[];
  topConceptTitles: string[];
  weakConceptTitles: string[];
  level: number;
  avatar: { emoji: string; title: string };
  currentStreak: number;
  longestStreak: number;
  totalXP: number;
  labSessions: QuizResult[];
  labAvgPct: number;
  narrative: string;
  narrativeLoading: boolean;
  narrativeError: boolean;
}

export function useStudentPortfolio(studentName: string): StudentPortfolioData {
  const { data, isLoading } = useStudentProgress(studentName);
  const results: QuizResult[] = data?.results ?? [];
  const mastery: ConceptMastery[] = data?.mastery ?? [];
  const gamification = data?.gamification ?? null;

  const [duggaSubs, setDuggaSubs] = useState<DuggaSubmission[]>([]);
  useEffect(() => {
    if (!studentName.trim()) { setDuggaSubs([]); return; }
    fetchStudentDuggaSubmissionsByName(studentName).then(setDuggaSubs).catch(() => {});
  }, [studentName]);

  const [narrative, setNarrative] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState(false);

  const avgPct = useMemo(() =>
    results.length > 0 ? results.reduce((s, r) => s + r.percentage, 0) / results.length : 0,
  [results]);

  const masteredConcepts = useMemo(() =>
    mastery.filter(m => m.mastered).sort((a, b) => {
      const ta = a.updatedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.updatedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    }),
  [mastery]);

  const bestResults = useMemo(() => {
    const best = new Map<string, QuizResult>();
    for (const r of results) {
      const key = r.conceptId || r.quizId;
      const existing = best.get(key);
      if (!existing || r.percentage > existing.percentage) best.set(key, r);
    }
    return Array.from(best.values())
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 8);
  }, [results]);

  const metacognitiveNotes = useMemo(() =>
    results
      .filter(r => r.metacognitiveNote && r.metacognitiveNote.trim().length > 10)
      .sort((a, b) => {
        const ta = a.playedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.playedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, 6),
  [results]);

  const topConceptTitles = useMemo(() =>
    masteredConcepts.slice(0, 5).map(m => m.conceptTitle || m.conceptId),
  [masteredConcepts]);

  const weakConceptTitles = useMemo(() => {
    const failed = mastery
      .filter(m => !m.mastered && (m.attempts ?? 0) > 1)
      .sort((a, b) => (a.consecutiveHighScores ?? 0) - (b.consecutiveHighScores ?? 0));
    return failed.slice(0, 3).map(m => m.conceptTitle || m.conceptId);
  }, [mastery]);

  const labSessions = useMemo(() =>
    results
      .filter(r => r.quizType === 'lab')
      .sort((a, b) => (b.playedAt?.toDate?.()?.getTime() ?? 0) - (a.playedAt?.toDate?.()?.getTime() ?? 0))
      .slice(0, 10),
  [results]);

  const labAvgPct = useMemo(() =>
    labSessions.length > 0
      ? labSessions.reduce((s, r) => s + r.percentage, 0) / labSessions.length
      : 0,
  [labSessions]);

  // Generate AI narrative once we have enough data
  useEffect(() => {
    if (!studentName || results.length < 3 || narrative || narrativeLoading) return;
    setNarrativeLoading(true);
    setNarrativeError(false);
    geminiService.generateStudentNarrative(
      studentName,
      masteredConcepts.length,
      avgPct,
      results.length,
      topConceptTitles,
      weakConceptTitles,
      metacognitiveNotes.map(r => r.metacognitiveNote!),
    ).then(text => {
      setNarrative(text);
    }).catch(() => {
      setNarrativeError(true);
    }).finally(() => {
      setNarrativeLoading(false);
    });
  }, [studentName, results.length, masteredConcepts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const levelInfo = gamification ? calcFibonacciLevel(gamification.totalXP) : null;
  const level = levelInfo?.level ?? 1;

  return {
    studentName,
    isLoading,
    results,
    mastery,
    duggaSubs,
    avgPct,
    masteredConcepts,
    bestResults,
    metacognitiveNotes,
    topConceptTitles,
    weakConceptTitles,
    level,
    avatar: getAvatar(level),
    currentStreak: gamification?.currentStreak ?? 0,
    longestStreak: gamification?.longestStreak ?? 0,
    totalXP: gamification?.totalXP ?? 0,
    labSessions,
    labAvgPct,
    narrative,
    narrativeLoading,
    narrativeError,
  };
}
