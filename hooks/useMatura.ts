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

  // Stable key so we only refetch when the actual IDs change
  const prevKey = useRef<string>('');

  useEffect(() => {
    if (!enabled || !examIds.length) {
      setQuestions([]);
      return;
    }
    const key = [...examIds].sort().join(',');
    if (key === prevKey.current) return;
    prevKey.current = key;

    setLoading(true);
    setError(null);

    maturaService
      .getMultiExamQuestions(examIds, filters)
      .then(qs => {
        setQuestions(qs);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e.userMessage ?? e.message ?? 'Грешка при вчитување на прашањата.');
        setLoading(false);
      });
  // filters intentionally excluded — apply them client-side via useMemo after load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examIds, enabled]);

  return { questions, loading, error };
}
