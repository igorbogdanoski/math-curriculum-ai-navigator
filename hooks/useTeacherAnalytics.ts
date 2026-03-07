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
      const [page, mastery] = await Promise.all([
         firestoreService.fetchQuizResultsPage(uid, 500), // Increase initial page size since we cache it
         firestoreService.fetchAllMastery(uid),
      ]);
      
      return {
        results: page.results,
        mastery: mastery,
        lastDoc: page.lastDoc
      };
    },
    enabled: true, // Always run, we depend on anon user or real user
  });
}
