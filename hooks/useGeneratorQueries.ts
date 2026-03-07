import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { firestoreService } from '../services/firestoreService';
import type { SavedQuestion } from '../types';

/**
 * Fetches verified questions for a specific concept
 */
export function useVerifiedQuestions(teacherUid: string | undefined, conceptId: string | undefined) {
  return useQuery({
    queryKey: ['verifiedQs', teacherUid, conceptId],
    queryFn: () => firestoreService.fetchVerifiedQuestions(teacherUid!, conceptId!),
    enabled: !!teacherUid && !!conceptId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Fetches the teacher's note for a specific concept
 */
export function useTeacherNoteQuery(teacherUid: string | undefined, conceptId: string | undefined, contextType: string) {
  return useQuery({
    queryKey: ['teacherNote', teacherUid, conceptId],
    queryFn: () => firestoreService.fetchTeacherNote(teacherUid!, conceptId!),
    enabled: !!teacherUid && !!conceptId && contextType === 'CONCEPT',
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetches quiz results to generate an adaptive difficulty recommendation
 */
export function useDifficultyRecommendation(teacherUid: string | undefined, conceptId: string | undefined) {
  return useQuery({
    queryKey: ['diffRec', teacherUid, conceptId],
    queryFn: async () => {
      const results = await firestoreService.fetchQuizResultsByConcept(conceptId!, teacherUid, 30);
      if (results.length === 0) return null;
      const avg = results.reduce((s: number, r: any) => s + r.percentage, 0) / results.length;
      return avg < 60 ? 'support' : avg < 85 ? 'standard' : 'advanced';
    },
    enabled: !!conceptId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Mutation to save teacher note
 */
export function useSaveTeacherNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teacherUid, conceptId, note }: { teacherUid: string; conceptId: string; note: string }) => 
      firestoreService.saveTeacherNote(teacherUid, conceptId, note),
    onSuccess: (_, variables) => {
      queryClient.setQueryData(['teacherNote', variables.teacherUid, variables.conceptId], variables.note);
    }
  });
}
