import { useQuery } from '@tanstack/react-query';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import type { DocumentSnapshot } from 'firebase/firestore';

interface TeacherAnalyticsData {
  results: QuizResult[];
  mastery: ConceptMastery[];
  lastDoc: DocumentSnapshot | null;
}

export function useTeacherAnalytics(uid: string | undefined) {
  return useQuery<TeacherAnalyticsData, Error>({
    queryKey: ['teacher-analytics', uid ?? 'anon'],
    queryFn: async () => {
      // Use smaller page size in E2E to test pagination without massive mocks
      const isE2E = typeof window !== 'undefined' && window.__E2E_TEACHER_MODE__;
      const pageSize = isE2E ? 10 : 500;

      const [page, mastery] = await Promise.all([
         firestoreService.fetchQuizResultsPage(uid, pageSize),
         firestoreService.fetchAllMastery(uid),
      ]);

      return {
        results: page.results,
        mastery: mastery,
        lastDoc: page.lastDoc
      };
    },
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,   // 5 min — navigating away+back won't re-fetch
    gcTime:   15 * 60 * 1000,   // 15 min — keep in memory after unmount
  });
}
