/**
 * useAdaptiveDifficulty — Ж1.2
 *
 * Fetches and aggregates ZPD difficulty targets for all students of a teacher.
 * Provides per-concept recommendations for what difficulty level to use
 * in the next quiz generation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  adaptiveDifficultyService,
  type DifficultyLevel,
} from '../services/firestoreService.adaptiveDifficulty';

export interface StudentZPDSummary {
  studentKey: string;        // safe key (lowercase, sanitized)
  displayName: string;       // original name if known
  conceptId: string;
  conceptLabel?: string;
  level: DifficultyLevel;
  recentPcts: number[];
  avgPct: number;
}

export interface ConceptDifficultyGroup {
  conceptId: string;
  conceptLabel?: string;
  easy: string[];            // student keys at easy level
  medium: string[];
  hard: string[];
}

interface UseAdaptiveDifficultyResult {
  isLoading: boolean;
  studentSummaries: StudentZPDSummary[];
  conceptGroups: ConceptDifficultyGroup[];
  /** Students who are ready to move up (avg ≥ 85%, currently on easy/medium) */
  readyToAdvance: StudentZPDSummary[];
  /** Students struggling (avg < 60%, currently on medium/hard) */
  needingSupport: StudentZPDSummary[];
  refetch: () => void;
}

export function useAdaptiveDifficulty(
  teacherUid: string | undefined,
  conceptLabels?: Record<string, string>,
): UseAdaptiveDifficultyResult {
  const [isLoading, setIsLoading] = useState(false);
  const [studentSummaries, setStudentSummaries] = useState<StudentZPDSummary[]>([]);

  const load = useCallback(async () => {
    if (!teacherUid) return;
    setIsLoading(true);
    try {
      const allTargets = await adaptiveDifficultyService.fetchAllTargets(teacherUid);
      const summaries: StudentZPDSummary[] = [];

      for (const [studentKey, doc] of Object.entries(allTargets)) {
        for (const [conceptId, target] of Object.entries(doc.targets)) {
          const avgPct = target.recentPcts.length > 0
            ? target.recentPcts.reduce((s, p) => s + p, 0) / target.recentPcts.length
            : 0;
          summaries.push({
            studentKey,
            displayName: studentKey,
            conceptId,
            conceptLabel: conceptLabels?.[conceptId],
            level: target.level,
            recentPcts: target.recentPcts,
            avgPct: Math.round(avgPct),
          });
        }
      }

      setStudentSummaries(summaries);
    } finally {
      setIsLoading(false);
    }
  }, [teacherUid, conceptLabels]);

  useEffect(() => { load(); }, [load]);

  // ── Derived aggregations ──────────────────────────────────────────────────

  const conceptGroups: ConceptDifficultyGroup[] = (() => {
    const map = new Map<string, ConceptDifficultyGroup>();
    for (const s of studentSummaries) {
      if (!map.has(s.conceptId)) {
        map.set(s.conceptId, {
          conceptId: s.conceptId,
          conceptLabel: s.conceptLabel,
          easy: [],
          medium: [],
          hard: [],
        });
      }
      map.get(s.conceptId)![s.level].push(s.studentKey);
    }
    return Array.from(map.values())
      .filter(g => g.easy.length + g.medium.length + g.hard.length > 0)
      .sort((a, b) => b.easy.length - a.easy.length); // most-struggling first
  })();

  const readyToAdvance = studentSummaries.filter(
    s => s.avgPct >= 85 && s.level !== 'hard',
  );

  const needingSupport = studentSummaries.filter(
    s => s.avgPct < 60 && s.level !== 'easy',
  );

  return { isLoading, studentSummaries, conceptGroups, readyToAdvance, needingSupport, refetch: load };
}
