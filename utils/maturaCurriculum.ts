import type { Concept, Grade, MaturaCurriculumRefs, MaturaQuestion, SecondaryTrack, Topic } from '../types';

export interface MaturaCurriculumAlignment {
  refs: MaturaCurriculumRefs;
  gradeTitles: string[];
  topicTitles: string[];
  concepts: Array<Concept & { gradeLevel: number; topicId: string; topicTitle: string; gradeTitle: string }>;
  assessmentStandards: string[];
  activities: string[];
}

export function buildDerivedCurriculumRefs(
  question: Pick<MaturaQuestion, 'conceptIds' | 'curriculumRefs'>,
  track: SecondaryTrack = 'gymnasium',
): MaturaCurriculumRefs {
  const manual = question.curriculumRefs;
  if (manual) {
    return {
      secondaryTrack: manual.secondaryTrack ?? track,
      gradeIds: manual.gradeIds ?? [],
      topicIds: manual.topicIds ?? [],
      conceptIds: manual.conceptIds ?? question.conceptIds ?? [],
      standardIds: manual.standardIds ?? [],
      objectiveKeywords: manual.objectiveKeywords ?? [],
      activityKeywords: manual.activityKeywords ?? [],
      source: manual.source ?? 'manual',
      confidence: manual.confidence ?? 'high',
    };
  }

  return {
    secondaryTrack: track,
    gradeIds: [],
    topicIds: [],
    conceptIds: question.conceptIds ?? [],
    standardIds: [],
    objectiveKeywords: [],
    activityKeywords: [],
    source: 'derived',
    confidence: question.conceptIds?.length ? 'medium' : 'low',
  };
}

export function alignMaturaQuestionToCurriculum(
  question: Pick<MaturaQuestion, 'conceptIds' | 'curriculumRefs'>,
  allConcepts: Array<Concept & { gradeLevel: number; topicId: string }>,
  getTopic: (topicId: string) => { grade?: Grade; topic?: Topic },
  getGrade: (gradeId: string) => Grade | undefined,
  track: SecondaryTrack = 'gymnasium',
): MaturaCurriculumAlignment {
  const refs = buildDerivedCurriculumRefs(question, track);

  const concepts = (refs.conceptIds ?? [])
    .map((conceptId) => allConcepts.find((concept) => concept.id === conceptId))
    .filter((concept): concept is Concept & { gradeLevel: number; topicId: string } => Boolean(concept))
    .map((concept) => {
      const topicDetails = getTopic(concept.topicId);
      return {
        ...concept,
        topicTitle: topicDetails.topic?.title ?? concept.topicId,
        gradeTitle: topicDetails.grade?.title ?? `Grade ${concept.gradeLevel}`,
      };
    });

  const topicTitles = Array.from(new Set([
    ...concepts.map((concept) => concept.topicTitle),
    ...(refs.topicIds ?? []).map((topicId) => getTopic(topicId).topic?.title).filter(Boolean) as string[],
  ])).sort((a, b) => a.localeCompare(b));

  const gradeTitles = Array.from(new Set([
    ...concepts.map((concept) => concept.gradeTitle),
    ...(refs.gradeIds ?? []).map((gradeId) => getGrade(gradeId)?.title).filter(Boolean) as string[],
  ])).sort((a, b) => a.localeCompare(b));

  const assessmentStandards = Array.from(new Set(
    concepts.flatMap((concept) => concept.assessmentStandards ?? [])
  ));

  const activities = Array.from(new Set(
    concepts.flatMap((concept) => concept.activities ?? [])
  ));

  return {
    refs,
    gradeTitles,
    topicTitles,
    concepts,
    assessmentStandards,
    activities,
  };
}