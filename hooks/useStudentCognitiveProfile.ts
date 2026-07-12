import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ConceptMastery, QuizResult } from '../services/firestoreService.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopicMastery {
  topicId: string;
  topicTitle?: string;
  avgScore: number;
  attempts: number;
  masteredConcepts: number;
  totalConcepts: number;
}

export interface CognitiveProfile {
  studentName: string;
  overallMasteryPct: number;
  masteredConcepts: number;
  totalConcepts: number;
  topicBreakdown: TopicMastery[];
  weakTopics: string[];
  strongTopics: string[];
  dokDistribution: Record<1 | 2 | 3 | 4, number>;
}

interface UseStudentCognitiveProfileInput {
  studentName: string;
  teacherUid: string;
  grade: number;
}

interface UseStudentCognitiveProfileResult {
  profile: CognitiveProfile | null;
  isLoading: boolean;
  error: string | null;
}

// ── Pure aggregation (exported for testing) ───────────────────────────────────

export function aggregateCognitiveProfile(
  studentName: string,
  masteries: ConceptMastery[],
  quizResults: QuizResult[],
): CognitiveProfile {
  // Concept mastery aggregation
  const masteredConcepts = masteries.filter(m => m.mastered).length;
  const totalConcepts = masteries.length;

  // Topic breakdown from quiz_results
  const topicMap = new Map<string, { scores: number[]; titles: Set<string> }>();
  for (const r of quizResults) {
    const id = r.topicId ?? '__unknown__';
    const prev = topicMap.get(id) ?? { scores: [], titles: new Set<string>() };
    prev.scores.push(r.percentage);
    if (r.quizTitle) prev.titles.add(r.quizTitle);
    topicMap.set(id, prev);
  }

  // Merge with concept mastery topicId data
  for (const m of masteries) {
    const id = m.topicId ?? '__unknown__';
    if (!topicMap.has(id)) {
      topicMap.set(id, { scores: [], titles: new Set<string>() });
    }
  }

  const topicBreakdown: TopicMastery[] = [];
  for (const [topicId, data] of topicMap) {
    const avgScore = data.scores.length
      ? Math.round(data.scores.reduce((s, n) => s + n, 0) / data.scores.length)
      : 0;
    const conceptsForTopic = masteries.filter(m => (m.topicId ?? '__unknown__') === topicId);
    topicBreakdown.push({
      topicId,
      topicTitle: [...data.titles][0],
      avgScore,
      attempts: data.scores.length,
      masteredConcepts: conceptsForTopic.filter(m => m.mastered).length,
      totalConcepts: conceptsForTopic.length,
    });
  }
  topicBreakdown.sort((a, b) => b.attempts - a.attempts);

  // DoK distribution
  const dokDistribution: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of quizResults) {
    if (r.dokLevel && r.dokLevel >= 1 && r.dokLevel <= 4) {
      dokDistribution[r.dokLevel as 1 | 2 | 3 | 4]++;
    }
  }

  // Overall mastery
  const allScores = quizResults.map(r => r.percentage);
  const overallMasteryPct = allScores.length
    ? Math.round(allScores.reduce((s, n) => s + n, 0) / allScores.length)
    : 0;

  const weakTopics = topicBreakdown.filter(t => t.avgScore < 60 && t.attempts > 0).map(t => t.topicTitle ?? t.topicId);
  const strongTopics = topicBreakdown.filter(t => t.avgScore >= 80 && t.attempts > 0).map(t => t.topicTitle ?? t.topicId);

  return {
    studentName,
    overallMasteryPct,
    masteredConcepts,
    totalConcepts,
    topicBreakdown,
    weakTopics,
    strongTopics,
    dokDistribution,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStudentCognitiveProfile({
  studentName,
  teacherUid,
  grade,
}: UseStudentCognitiveProfileInput): UseStudentCognitiveProfileResult {
  const [profile, setProfile] = useState<CognitiveProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentName.trim() || !teacherUid) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [masterySnap, quizSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'concept_mastery'),
              where('studentName', '==', studentName),
              where('teacherUid', '==', teacherUid),
              limit(200),
            ),
          ),
          getDocs(
            query(
              collection(db, 'quiz_results'),
              where('studentName', '==', studentName),
              where('teacherUid', '==', teacherUid),
              where('gradeLevel', '==', grade),
              limit(200),
            ),
          ),
        ]);

        const masteries = masterySnap.docs.map(d => d.data() as ConceptMastery);
        const quizResults = quizSnap.docs.map(d => d.data() as QuizResult);

        if (!cancelled) {
          setProfile(aggregateCognitiveProfile(studentName, masteries, quizResults));
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Грешка при вчитување на когнитивниот профил.');
          setIsLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [studentName, teacherUid, grade]);

  return { profile, isLoading, error };
}
