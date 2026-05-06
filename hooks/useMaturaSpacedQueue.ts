/**
 * useMaturaSpacedQueue (T3.1)
 *
 * Returns the user's "due today" matura spaced-repetition queue, joined
 * against the live `MaturaQuestion` metadata for the relevant exams.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMaturaQuestions } from './useMatura';
import {
  dueRecords,
  fetchMaturaSpacedRecords,
  type MaturaSpacedRecord,
} from '../services/firestoreService.maturaSpacedRep';
import type { MaturaQuestion } from '../services/firestoreService.matura';

export interface MaturaSpacedQueueItem {
  record: MaturaSpacedRecord;
  question: MaturaQuestion | null;
}

export interface UseMaturaSpacedQueueResult {
  loading: boolean;
  records: MaturaSpacedRecord[];
  due: MaturaSpacedQueueItem[];
  count: number;
  refresh: () => void;
}

export function useMaturaSpacedQueue(): UseMaturaSpacedQueueResult {
  const { firebaseUser } = useAuth();
  const [records, setRecords] = useState<MaturaSpacedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let canceled = false;
    if (!firebaseUser?.uid) {
      setRecords([]);
      return;
    }
    setLoading(true);
    void fetchMaturaSpacedRecords(firebaseUser.uid)
      .then((rows) => {
        if (!canceled) setRecords(rows);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [firebaseUser?.uid, tick]);

  const dueList = useMemo(() => dueRecords(records), [records]);
  const examIds = useMemo(
    () => Array.from(new Set(dueList.map((d) => d.examId))).sort(),
    [dueList],
  );
  const { questions, loading: qLoading } = useMaturaQuestions(
    examIds,
    undefined,
    examIds.length > 0,
  );

  const due = useMemo<MaturaSpacedQueueItem[]>(() => {
    const map = new Map<string, MaturaQuestion>();
    for (const q of questions) {
      map.set(`${q.examId}:${q.questionNumber}`, q);
    }
    return dueList.map((record) => ({
      record,
      question: map.get(`${record.examId}:${record.questionNumber}`) ?? null,
    }));
  }, [dueList, questions]);

  return {
    loading: loading || qLoading,
    records,
    due,
    count: due.length,
    refresh: () => setTick((n) => n + 1),
  };
}
