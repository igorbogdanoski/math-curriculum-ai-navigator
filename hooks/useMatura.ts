/**
 * hooks/useMatura.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hooks for the Matura module.
 *
 *  useMaturaExams()            — list of all exams from Firestore
 *  useMaturaQuestions(ids, f)  — questions for given examId(s), with filters
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  maturaService,
  type MaturaExamMeta,
  type MaturaQuestion,
  type MaturaQueryFilters,
} from '../services/firestoreService.matura';

// ─── useMaturaExams ───────────────────────────────────────────────────────────

export interface UseMaturaExamsResult {
  exams:   MaturaExamMeta[];
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export function useMaturaExams(): UseMaturaExamsResult {
  const [exams,   setExams]   = useState<MaturaExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await maturaService.listExams();
      setExams(data);
    } catch (e: any) {
      setError(e.userMessage ?? e.message ?? 'Грешка при вчитување на испитите.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { exams, loading, error, refetch: load };
}

// ─── useMaturaQuestions ───────────────────────────────────────────────────────

export interface UseMaturaQuestionsResult {
  questions: MaturaQuestion[];
  loading:   boolean;
  error:     string | null;
}

/**
 * Fetch questions for one or more exams.
 *
 * @param examIds  - stable array of exam IDs (memoize the array in caller!)
 * @param filters  - optional client-side filters (topicAreas, parts, dokLevels)
 * @param enabled  - set false to skip fetching (e.g. during setup phase)
 */
export function useMaturaQuestions(
  examIds: string[],
  filters?: MaturaQueryFilters,
  enabled = true,
): UseMaturaQuestionsResult {
  const [questions, setQuestions] = useState<MaturaQuestion[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const filterKey = useRef('');
  const examKey = [...new Set(examIds)].sort().join(',');

  // Build a stable key to avoid missing reloads when logical filters change.
  const nextFilterKey = JSON.stringify({
    topicAreas: [...(filters?.topicAreas ?? [])].sort(),
    parts: [...(filters?.parts ?? [])].sort(),
    dokLevels: [...(filters?.dokLevels ?? [])].sort(),
    questionType: filters?.questionType ?? null,
  });

  useEffect(() => {
    if (!enabled || !examKey) {
      setQuestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const shouldRefetch = filterKey.current !== `${examKey}::${nextFilterKey}`;
    filterKey.current = `${examKey}::${nextFilterKey}`;
    if (!shouldRefetch) return;

    setLoading(true);
    setError(null);

    const ids = examKey.split(',').filter(Boolean);

    maturaService
      .getMultiExamQuestions(ids, filters)
      .then(qs => {
        setQuestions(qs);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.userMessage ?? e.message ?? 'Грешка при вчитување на прашањата.');
        setLoading(false);
      });
  }, [enabled, examKey, filters, nextFilterKey]);

  return { questions, loading, error };
}
