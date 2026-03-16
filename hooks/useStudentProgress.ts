import { useQuery } from '@tanstack/react-query';
import { firestoreService, type QuizResult, type ConceptMastery, type Assignment, type StudentGamification, type Announcement } from '../services/firestoreService';
import { getDeviceId } from '../utils/studentIdentity';

interface StudentProgressData {
  results: QuizResult[];
  mastery: ConceptMastery[];
  assignments: Assignment[];
  gamification: StudentGamification | null;
  announcements: Announcement[];
  classRank: { rank: number; total: number } | null;
  nextQuizIds: Record<string, string>;
  teacherUid?: string;
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

      // Derive primary teacherUid from the most frequent teacher in quiz results
      const teacherUidCounts: Record<string, number> = {};
      quizData.forEach((r: QuizResult) => {
        if (r.teacherUid) teacherUidCounts[r.teacherUid] = (teacherUidCounts[r.teacherUid] ?? 0) + 1;
      });
      const topTeacherUid = Object.entries(teacherUidCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      // Failed concept IDs — pre-fetch quiz links for self-navigation
      const failedConceptIds = Array.from(
        new Set(quizData.filter((r: QuizResult) => r.percentage < 70 && r.conceptId).map((r: QuizResult) => r.conceptId!))
      );

      // Use individual .catch() so one failure doesn't block the others
      const [gamification, announcementsData, classBoard, nextQuizLookups] = await Promise.all([
        firestoreService.fetchStudentGamification(studentName.trim(), topTeacherUid, deviceId)
          .catch(() => null),
        (topTeacherUid ? firestoreService.fetchAnnouncements(topTeacherUid, 3) : Promise.resolve([] as Announcement[]))
          .catch(() => [] as Announcement[]),
        (topTeacherUid ? firestoreService.fetchClassLeaderboard(topTeacherUid) : Promise.resolve([] as { studentName: string }[]))
          .catch(() => [] as { studentName: string }[]),
        // Each concept quiz lookup is independent — one failure must not block the rest
        Promise.all(
          failedConceptIds.map((cid: string) =>
            firestoreService.fetchLatestQuizByConcept(cid)
              .then((q: { id?: string } | null) => ({ cid, id: q?.id }))
              .catch(() => ({ cid, id: undefined }))
          )
        ),
      ]);

      const idx = classBoard?.findIndex((g: { studentName: string }) => g.studentName === studentName.trim()) ?? -1;
      const classRank = idx >= 0 ? { rank: idx + 1, total: classBoard?.length ?? 0 } : null;

      const nextQuizIds: Record<string, string> = {};
      nextQuizLookups.forEach(({ cid, id }: { cid: string; id?: string }) => { if (id) nextQuizIds[cid] = id; });

      return {
        results: quizData,
        mastery: masteryData,
        assignments,
        gamification,
        announcements: announcementsData,
        classRank,
        nextQuizIds,
        teacherUid: topTeacherUid,
      };
    },
    enabled: !!studentName.trim() && studentName.trim().length >= 2,
    staleTime: 2 * 60 * 1000,  // 2 min — navigating back won't re-fetch
    gcTime:   10 * 60 * 1000,  // 10 min — keep in memory after unmount
  });
}
