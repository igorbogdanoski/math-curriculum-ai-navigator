import { useQuery } from '@tanstack/react-query';
import { firestoreService, type QuizResult, type ConceptMastery, type Assignment } from '../services/firestoreService';
import { getDeviceId } from '../utils/studentIdentity';

interface StudentProgressData {
  results: QuizResult[];
  mastery: ConceptMastery[];
  assignments: Assignment[];
}

export function useStudentProgress(studentName: string, isReadOnly: boolean = false) {
  return useQuery<StudentProgressData, Error>({
    queryKey: ['student-progress', studentName, isReadOnly],
    queryFn: async () => {
      const deviceId = isReadOnly ? undefined : getDeviceId() ?? undefined;
      
      const [quizData, masteryData, assignments] = await Promise.all([
        firestoreService.fetchQuizResultsByStudentName(studentName.trim(), deviceId),
        firestoreService.fetchMasteryByStudent(studentName.trim(), deviceId),
        firestoreService.fetchAssignmentsByStudent(studentName.trim()),
      ]);
      
      return {
        results: quizData,
        mastery: masteryData,
        assignments: assignments
      };
    },
    enabled: !!studentName.trim() && studentName.trim().length >= 2,
    staleTime: 2 * 60 * 1000 // 2 minutes cache for student side
  });
}
