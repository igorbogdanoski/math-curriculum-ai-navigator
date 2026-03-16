/**
 * useSecondaryCurriculum — access secondary curriculum data for a given track.
 *
 * Usage:
 *   const { curriculum, label, getGrade, allConcepts } = useSecondaryCurriculum('gymnasium');
 *
 * Returns null values when track is undefined (primary teacher).
 */

import { useMemo } from 'react';
import type { Curriculum, Concept, Grade, Topic, SecondaryTrack } from '../types';
import { secondaryCurriculumByTrack } from '../data/secondaryCurriculum';

interface UseSecondaryCurriculumResult {
  curriculum: Curriculum | null;
  label: string | null;
  isLoading: false; // Data is static — no async loading needed
  getGrade: (gradeId: string) => Grade | undefined;
  getTopic: (topicId: string) => { grade?: Grade; topic?: Topic };
  getConceptDetails: (conceptId: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
  allConcepts: (Concept & { gradeLevel: number; topicId: string })[];
}

export function useSecondaryCurriculum(
  track: SecondaryTrack | undefined
): UseSecondaryCurriculumResult {
  const module = track ? secondaryCurriculumByTrack[track] ?? null : null;
  const curriculum = module?.curriculum ?? null;

  const allConcepts = useMemo((): (Concept & { gradeLevel: number; topicId: string })[] => {
    if (!curriculum) return [];
    return curriculum.grades.flatMap((grade) =>
      grade.topics.flatMap((topic) =>
        topic.concepts.map((concept) => ({
          ...concept,
          gradeLevel: grade.level,
          topicId: topic.id,
        }))
      )
    );
  }, [curriculum]);

  const getGrade = useMemo(
    () =>
      (gradeId: string): Grade | undefined =>
        curriculum?.grades.find((g) => g.id === gradeId),
    [curriculum]
  );

  const getTopic = useMemo(
    () =>
      (topicId: string): { grade?: Grade; topic?: Topic } => {
        if (!curriculum) return {};
        for (const grade of curriculum.grades) {
          const topic = grade.topics.find((t) => t.id === topicId);
          if (topic) return { grade, topic };
        }
        return {};
      },
    [curriculum]
  );

  const getConceptDetails = useMemo(
    () =>
      (conceptId: string): { grade?: Grade; topic?: Topic; concept?: Concept } => {
        if (!curriculum) return {};
        for (const grade of curriculum.grades) {
          for (const topic of grade.topics) {
            const concept = topic.concepts.find((c) => c.id === conceptId);
            if (concept) return { grade, topic, concept };
          }
        }
        return {};
      },
    [curriculum]
  );

  return {
    curriculum,
    label: module?.label ?? null,
    isLoading: false,
    getGrade,
    getTopic,
    getConceptDetails,
    allConcepts,
  };
}
