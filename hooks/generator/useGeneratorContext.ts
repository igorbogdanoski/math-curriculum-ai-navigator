/**
 * useGeneratorContext — derives filteredTopics/Concepts from curriculum state
 * and provides buildContext() + isGenerateDisabled for the generator.
 * Pure computation: no side-effects, no Firestore calls.
 */
import { useMemo } from 'react';
import type {
  AIGeneratedPresentation, AIGeneratedLearningPaths, AIGeneratedWorkedExample,
  GenerationContext, Topic, Concept, Grade, NationalStandard, StudentProfile,
  AIGeneratedIdeas, AIGeneratedAssessment, AIGeneratedRubric,
  AIGeneratedIllustration, TeachingProfile, ConceptProgression, Curriculum,
} from '../../types';
import type { GeneratorState } from '../useGeneratorState';

type GeneratedMaterial =
  | AIGeneratedIdeas
  | AIGeneratedAssessment
  | AIGeneratedRubric
  | AIGeneratedIllustration
  | AIGeneratedLearningPaths
  | AIGeneratedWorkedExample
  | AIGeneratedPresentation
  | null;

interface UseGeneratorContextParams {
  state: GeneratorState;
  curriculum: Curriculum;
  allConcepts: Concept[];
  allNationalStandards: NationalStandard[] | undefined;
  user: TeachingProfile | null;
  isGenerating: boolean;
  isGeneratingBulk: boolean;
  isGeneratingVariants: boolean;
  isOnline: boolean;
  getConceptDetails: (id: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
  findConceptAcrossGrades: (id: string) => ConceptProgression | undefined;
}

export type BuildContextResult = {
  context: GenerationContext;
  imageParam: { base64: string; mimeType: string } | undefined;
  studentProfilesToPass: StudentProfile[] | undefined;
  tempActivityTitle: string;
};

export function useGeneratorContext({
  state,
  curriculum,
  allConcepts,
  allNationalStandards,
  user,
  isGenerating,
  isGeneratingBulk,
  isGeneratingVariants,
  isOnline,
  getConceptDetails,
  findConceptAcrossGrades,
}: UseGeneratorContextParams) {
  const filteredTopics = useMemo(
    () => curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.topics || [],
    [curriculum, state.selectedGrade],
  );

  const filteredConcepts = useMemo(
    () => filteredTopics.find((topic: Topic) => topic.id === state.selectedTopic)?.concepts || [],
    [filteredTopics, state.selectedTopic],
  );

  const buildContext = (): BuildContextResult | null => {
    if (!curriculum) return null;
    const {
      selectedGrade, selectedTopic, selectedConcepts, selectedStandard,
      contextType, scenarioText, selectedActivity, imageFile, activityTitle,
      useStudentProfiles, selectedStudentProfileIds, bloomDistribution, materialType,
    } = state;

    const gradeData = curriculum.grades.find((g: Grade) => g.id === selectedGrade)
      || curriculum.grades.find((g: Grade) => String(g.level) === selectedGrade);
    if (!gradeData && contextType !== 'STANDARD') return null;

    let context: GenerationContext | null = null;
    let tempActivityTitle = activityTitle;

    switch (contextType) {
      case 'CONCEPT': case 'TOPIC': case 'ACTIVITY': {
        const topic = gradeData?.topics.find((t: Topic) => t.id === selectedTopic);
        if (!topic) return null;
        const concepts = allConcepts.filter((c: Concept) => selectedConcepts.includes(c.id));
        if ((contextType === 'CONCEPT' || contextType === 'ACTIVITY') && concepts.length === 0) return null;
        const scenario = contextType === 'ACTIVITY'
          ? `Креирај материјал за учење базиран на следнава активност од наставната програма: "${selectedActivity}"`
          : undefined;
        const activeBlooms = Object.keys(bloomDistribution).length > 0 ? bloomDistribution : undefined;
        const prerequisitesByConceptId: Record<string, string[]> = {};
        concepts.forEach((c: Concept) => {
          if (c.priorKnowledgeIds?.length) {
            prerequisitesByConceptId[c.id] = c.priorKnowledgeIds
              .map((id: string) => getConceptDetails(id).concept?.title)
              .filter((t: string | undefined): t is string => !!t);
          }
        });
        const verticalProgression = concepts
          .map((c: Concept) => {
            const prog = findConceptAcrossGrades(c.id);
            if (!prog || prog.progression.length < 2) return null;
            return {
              conceptId: c.id,
              title: prog.title,
              progression: prog.progression.map((p: { grade: number; concept: Concept }) => ({ grade: p.grade, conceptTitle: p.concept.title })),
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        context = {
          type: contextType,
          grade: gradeData!,
          topic,
          concepts,
          scenario,
          bloomDistribution: activeBlooms,
          prerequisitesByConceptId,
          verticalProgression: verticalProgression.length ? verticalProgression : undefined,
        };
        if (!tempActivityTitle && materialType === 'RUBRIC') {
          tempActivityTitle = contextType === 'ACTIVITY'
            ? selectedActivity
            : `Активност за ${concepts[0]?.title || topic.title}`;
        }
        break;
      }
      case 'STANDARD': {
        const standard = allNationalStandards?.find((s: NationalStandard) => s.id === selectedStandard);
        if (!standard) return null;
        const standardGradeData = curriculum.grades.find((g: Grade) => g.level === standard.gradeLevel) || gradeData;
        if (!standardGradeData) return null;
        let topicForStandard: Topic | undefined;
        const concepts = standard.relatedConceptIds?.map((id: string) => {
          const details = getConceptDetails(id);
          if (!topicForStandard && details.topic) topicForStandard = details.topic;
          return details.concept;
        }).filter((c: Concept | undefined): c is Concept => !!c);
        if (!topicForStandard) {
          topicForStandard = {
            id: 'standard-topic',
            title: `Стандарди за ${standardGradeData.title}`,
            description: `Материјали генерирани врз основа на национален стандард.`,
            concepts: concepts || [],
          };
        }
        context = { type: 'STANDARD', grade: standardGradeData, standard, concepts, topic: topicForStandard };
        if (!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = `Активност за стандард ${standard.code}`;
        break;
      }
      case 'SCENARIO': {
        if (!scenarioText.trim() && !imageFile) return null;
        if (!gradeData) return null;
        context = {
          type: 'SCENARIO',
          grade: gradeData,
          scenario: scenarioText,
          topic: { id: 'scenario-topic', title: 'Генерирање од идеја', description: scenarioText.substring(0, 100), concepts: [] },
        };
        if (!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = `Активност според идеја`;
        break;
      }
    }
    if (!context) return null;
    return {
      context,
      imageParam: imageFile ? { base64: imageFile.base64, mimeType: imageFile.file.type } : undefined,
      studentProfilesToPass: (useStudentProfiles || materialType === 'LEARNING_PATH')
        ? user?.studentProfiles?.filter((p: StudentProfile) => selectedStudentProfileIds.includes(p.id))
        : undefined,
      tempActivityTitle,
    };
  };

  const isGenerateDisabled = useMemo(() => {
    const { contextType, selectedConcepts, selectedStandard, scenarioText, selectedActivity, imageFile,
      materialType, questionTypes, useStudentProfiles, selectedStudentProfileIds, activityTitle, illustrationPrompt, videoUrl,
      webpageUrl, bloomDistribution } = state;
    if (isGenerating || isGeneratingBulk || isGeneratingVariants || !isOnline) return true;

    // Extractor types (VIDEO/IMAGE/WEB) only need grade+topic, not selectedConcepts
    const EXTRACTOR_TYPES = ['VIDEO_EXTRACTOR', 'IMAGE_EXTRACTOR', 'WEB_EXTRACTOR'] as const;
    const isExtractorType = EXTRACTOR_TYPES.includes(materialType as typeof EXTRACTOR_TYPES[number]);

    if (!isExtractorType) {
      let contextIsValid = false;
      switch (contextType) {
        case 'CONCEPT': case 'TOPIC': contextIsValid = selectedConcepts.length > 0; break;
        case 'STANDARD': contextIsValid = !!selectedStandard; break;
        case 'SCENARIO': contextIsValid = scenarioText.trim().length > 0 || !!imageFile; break;
        case 'ACTIVITY': contextIsValid = selectedConcepts.length > 0 && !!selectedActivity; break;
        default: contextIsValid = false;
      }
      if (!contextIsValid) return true;
    }

    if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType || '')) {
      if (questionTypes.length === 0) return true;
      if (useStudentProfiles && selectedStudentProfileIds.length === 0) return true;
      if (bloomDistribution && Object.keys(bloomDistribution).length > 0) {
        const bloomTotal = Object.values(bloomDistribution).reduce((s, v) => s + (v ?? 0), 0);
        if (bloomTotal !== 100) return true;
      }
    }
    if (materialType === 'LEARNING_PATH' && selectedStudentProfileIds.length === 0) return true;
    if (materialType === 'RUBRIC' && !activityTitle) return true;
    if (materialType === 'ILLUSTRATION' && !illustrationPrompt.trim() && !imageFile) return true;
    if (materialType === 'VIDEO_EXTRACTOR' && !videoUrl.trim()) return true;
    if (materialType === 'IMAGE_EXTRACTOR' && !imageFile) return true;
    if (materialType === 'WEB_EXTRACTOR' && !webpageUrl.trim()) return true;
    return false;
  }, [isGenerating, isGeneratingBulk, isGeneratingVariants, isOnline, state]);

  return { filteredTopics, filteredConcepts, buildContext, isGenerateDisabled };
}

export type { GeneratedMaterial };
