import { useMemo } from 'react';
import type { MaturaCurriculumRefs, MaturaQuestion, SecondaryTrack } from '../types';
import { useCurriculum } from './useCurriculum';
import { alignMaturaQuestionToCurriculum, type MaturaCurriculumAlignment } from '../utils/maturaCurriculum';

type AlignableQuestion = Pick<MaturaQuestion, 'conceptIds' | 'curriculumRefs'> & {
  id?: string;
  examId?: string;
  questionNumber?: number;
};

export interface UseMaturaCurriculumAlignmentResult {
  byQuestionId: Map<string, MaturaCurriculumAlignment>;
  alignedQuestions: Array<{
    question: AlignableQuestion;
    alignment: MaturaCurriculumAlignment;
  }>;
}

export function useMaturaCurriculumAlignment(
  questions: AlignableQuestion[],
  track: SecondaryTrack = 'gymnasium',
): UseMaturaCurriculumAlignmentResult {
  const { allConcepts, getTopic, getGrade } = useCurriculum();

  return useMemo(() => {
    const alignedQuestions = questions.map((question) => ({
      question,
      alignment: alignMaturaQuestionToCurriculum(question, allConcepts, getTopic, getGrade, track),
    }));

    return {
      alignedQuestions,
      byQuestionId: new Map(alignedQuestions.map((entry) => {
        const q = entry.question;
        const key = q.id ?? `${q.examId ?? 'unknown'}:${q.questionNumber ?? -1}`;
        return [key, entry.alignment] as const;
      })),
    };
  }, [questions, allConcepts, getTopic, getGrade, track]);
}