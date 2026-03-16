import { useQuery } from '@tanstack/react-query';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import type { DocumentSnapshot } from 'firebase/firestore';

interface TeacherAnalyticsData {
  results: QuizResult[];
  mastery: ConceptMastery[];
  lastDoc: DocumentSnapshot | null;
}

export function useTeacherAnalytics(uid: string | undefined) {
  console.log('useTeacherAnalytics: Hook called with uid:', uid);
  return useQuery<TeacherAnalyticsData, Error>({
    queryKey: ['teacher-analytics', uid ?? 'anon'],
    queryFn: async () => {
      console.log('useTeacherAnalytics: queryFn EXECUTION started for uid:', uid);
      // Use smaller page size in E2E to test pagination without massive mocks
      const isE2E = typeof window !== 'undefined' && (window as any).__E2E_TEACHER_MODE__;
      const pageSize = isE2E ? 10 : 500;

      console.log('useTeacherAnalytics: fetching page...');
      const [page, mastery] = await Promise.all([
         firestoreService.fetchQuizResultsPage(uid, pageSize),
         firestoreService.fetchAllMastery(uid),
      ]);
      console.log('useTeacherAnalytics: fetch complete. results:', page.results.length);
      
      return {
        results: page.results,
        mastery: mastery,
        lastDoc: page.lastDoc
      };
    },
    // Temporarily disabled check to force execution during E2E debugging
    enabled: true, 
  });
}
