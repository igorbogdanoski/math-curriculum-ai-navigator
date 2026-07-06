import { logger } from '../../utils/logger';
/**
 * useGeneratorSave — library/save operations for generated materials.
 * Handles: savedToLibrary, assignTarget, handleSaveToLibrary, handleSaveQuestion,
 *          handleSaveAsNote, handleMaterialRate, handleGenerateFromBank.
 */
import { useState } from 'react';
import type { User } from 'firebase/auth';
import { geminiService } from '../../services/geminiService';
import { firestoreService } from '../../services/firestoreService';
import { publishMaterialFromGenerator } from '../../services/firestoreService.scenarioBank';
import { useAcademyProgress } from '../../contexts/AcademyProgressContext';
import { trackFirstTimeEvent, trackEvent } from '../../services/telemetryService';
import type {
  AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric,
  AIGeneratedIllustration, AIGeneratedLearningPaths, AIGeneratedWorkedExample,
  AIGeneratedPresentation, AssessmentQuestion, TeachingProfile, Concept,
  Grade, SavedQuestion, PlannerItem, Curriculum,
} from '../../types';
import { PlannerItemType, QuestionType } from '../../types';
import type { GeneratorState } from '../useGeneratorState';
import type { useVerifiedQuestions } from '../useGeneratorQueries';

type GeneratedMaterial =
  | AIGeneratedIdeas
  | AIGeneratedAssessment
  | AIGeneratedRubric
  | AIGeneratedIllustration
  | AIGeneratedLearningPaths
  | AIGeneratedWorkedExample
  | AIGeneratedPresentation
  | null;

type BulkResults = {
  scenario?: AIGeneratedIdeas;
  quiz?: AIGeneratedAssessment;
  assessment?: AIGeneratedAssessment;
  rubric?: AIGeneratedRubric;
} | null;

interface UseGeneratorSaveParams {
  state: GeneratorState;
  curriculum: Curriculum;
  filteredConcepts: Concept[];
  user: TeachingProfile | null;
  firebaseUser: User | null;
  generatedMaterial: GeneratedMaterial;
  bulkResults: BulkResults;
  verifiedQs: ReturnType<typeof useVerifiedQuestions>['data'] extends (infer T)[] ? T[] : SavedQuestion[];
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  addItem: (item: Omit<PlannerItem, 'id'>) => Promise<void>;
  setGeneratedMaterial: (m: GeneratedMaterial) => void;
  setVariants: (v: null) => void;
  setBulkResults: (v: null) => void;
}

export function useGeneratorSave({
  state,
  curriculum,
  filteredConcepts,
  user,
  firebaseUser,
  generatedMaterial,
  bulkResults,
  verifiedQs,
  addNotification,
  addItem,
  setGeneratedMaterial,
  setVariants,
  setBulkResults,
}: UseGeneratorSaveParams) {
  const { trackMaterialSaved } = useAcademyProgress();
  const [savedToLibrary, setSavedToLibrary] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState<AIGeneratedAssessment | null>(null);
  // PRO privacy: default public; PRO users may switch to private before saving
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'School' || user?.tier === 'Unlimited';
  const [saveIsPublic, setSaveIsPublic] = useState(true);

  const handleSaveToLibrary = async (material: GeneratedMaterial, keyHint: string) => {
    if (!firebaseUser?.uid) { addNotification('Мора да бидете логирани.', 'error'); return; }
    if (!material) return;
    if (savedToLibrary.has(keyHint)) return;
    try {
      const gradeLevel = curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level;
      const materialTypeToLibType: Record<string, 'quiz' | 'assessment' | 'rubric' | 'ideas' | 'analogy'> = {
        QUIZ: 'quiz', ASSESSMENT: 'assessment', RUBRIC: 'rubric',
        SCENARIO: 'ideas', VIDEO_EXTRACTOR: 'ideas', IMAGE_EXTRACTOR: 'ideas', WEB_EXTRACTOR: 'ideas', DOCUMENT_EXTRACTOR: 'ideas',
        LEARNING_PATH: 'ideas', WORKED_EXAMPLE: 'ideas',
      };
      const libType = materialTypeToLibType[state.materialType ?? ''] ?? 'assessment';
      let title = (material as { title?: string })?.title || '';
      if (!title && (libType === 'quiz' || libType === 'assessment')) {
        title = await geminiService.generateSmartQuizTitle(material as unknown as Record<string, unknown>).catch(() => '');
      }
      if (!title) title = 'Генериран материјал';
      await publishMaterialFromGenerator({
        title,
        materialType: libType,
        content: material as unknown as Record<string, unknown>,
        grade: gradeLevel,
        topicTitle: state.selectedTopic,
        authorUid: firebaseUser.uid,
        authorName: user?.name ?? 'Наставник',
        schoolName: user?.schoolName,
        isPublic: isPro ? saveIsPublic : true, // FREE always public; PRO chooses
      });
      setSavedToLibrary(prev => new Set(prev).add(keyHint));
      const newAchievements = trackMaterialSaved(libType);
      const achievementMsg = newAchievements.length ? ` Ново достигнување: ${newAchievements.join(', ')}` : '';
      addNotification(`Зачувано во Националната Банка! 📚${achievementMsg}`, 'success');
      // S39-F2: telemetry
      trackEvent('feature_open_save_to_library', { libType, materialType: state.materialType });
      if (libType === 'ideas' || libType === 'assessment' || libType === 'quiz') {
        trackFirstTimeEvent(firebaseUser.uid, 'first_lesson_saved', { libType });
      }
    } catch (err) {
      logger.error('[Save to library]', err);
      const msg = err instanceof Error ? err.message : '';
      addNotification(
        msg.includes('permission') || msg.includes('PERMISSION')
          ? 'Нема право за зачувување. Проверете дали сте логирани.'
          : 'Грешка при зачувување. Обидете се повторно.',
        'error',
      );
    }
  };

  const handleSaveQuestion = async (q: AssessmentQuestion) => {
    if (!firebaseUser?.uid) {
      addNotification('Мора да бидете логирани за да зачувате прашања.', 'error');
      return;
    }
    try {
      const conceptId = state.selectedConcepts[0];
      await firestoreService.saveQuestion({
        teacherUid: firebaseUser.uid,
        schoolId: user?.schoolId,
        question: q.question,
        type: q.type,
        options: q.options,
        answer: q.answer,
        solution: q.solution,
        cognitiveLevel: q.cognitiveLevel,
        difficulty_level: q.difficulty_level,
        conceptId,
        conceptTitle: filteredConcepts.find((c: Concept) => c.id === conceptId)?.title,
        topicId: state.selectedTopic,
        gradeLevel: curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level,
      });
      addNotification('Прашањето е зачувано во банката! 📌', 'success');
    } catch (err) {
      logger.error('Error saving question:', err);
      addNotification('Грешка при зачувување на прашањето.', 'error');
    }
  };

  const handleSaveAsNote = async () => {
    if (!generatedMaterial || !('openingActivity' in generatedMaterial)) {
      addNotification('Нема генерирани идеи за зачувување.', 'error');
      return;
    }
    const mat = generatedMaterial as AIGeneratedIdeas;
    const noteContent = `### ${mat.title}\n\n**Воведна активност:**\n${mat.openingActivity}\n\n**Главна активност:**\n${mat.mainActivity}\n\n**Диференцијација:**\n${mat.differentiation}\n\n**Идеја за оценување:**\n${mat.assessmentIdea}`.trim();
    try {
      await addItem({
        title: `Белешка: ${mat.title}`,
        date: new Date().toISOString().split('T')[0],
        type: PlannerItemType.EVENT,
        description: noteContent,
      });
      addNotification('Идејата е успешно зачувана како белешка во планерот!', 'success');
    } catch {
      addNotification('Грешка при зачувување на белешката.', 'error');
    }
  };

  const handleMaterialRate = (rating: 'up' | 'down', reportText?: string) => {
    if (!firebaseUser?.uid || !generatedMaterial) return;
    const title = ('title' in generatedMaterial ? (generatedMaterial as { title?: string }).title : '') ?? '';
    const type = state.materialType ?? 'UNKNOWN';
    firestoreService.saveMaterialFeedback(
      rating, title, type, firebaseUser.uid, reportText,
      state.selectedConcepts[0] ?? undefined,
      state.selectedGrade ? Number(state.selectedGrade) || undefined : undefined,
    ).catch(err => logger.warn('[Feedback] save failed:', err));
  };

  const handleSavePackage = async () => {
    if (!firebaseUser?.uid) { addNotification('Мора да бидете логирани.', 'error'); return; }
    if (!bulkResults || Object.keys(bulkResults).filter(k => bulkResults[k as keyof typeof bulkResults]).length === 0) {
      addNotification('Нема генериран пакет за зачувување.', 'error');
      return;
    }
    if (savedToLibrary.has('package')) return;
    try {
      const gradeLevel = curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level;
      const topicTitle = (bulkResults.scenario as { title?: string })?.title
        ?? (bulkResults.quiz as { title?: string })?.title
        ?? 'Пакет материјали';
      const title = `📦 ${topicTitle}`;
      await publishMaterialFromGenerator({
        title,
        materialType: 'package',
        content: bulkResults as unknown as Record<string, unknown>,
        grade: gradeLevel,
        topicTitle: state.selectedTopic,
        authorUid: firebaseUser.uid,
        authorName: user?.name ?? 'Наставник',
        schoolName: user?.schoolName,
        isPublic: isPro ? saveIsPublic : true,
      });
      setSavedToLibrary(prev => new Set(prev).add('package'));
      addNotification('Пакетот е зачуван во Националната Банка! 📦', 'success');
    } catch {
      addNotification('Грешка при зачувување на пакетот.', 'error');
    }
  };

  const handleGenerateFromBank = () => {
    if (!verifiedQs || verifiedQs.length === 0) return;
    const conceptTitle = (verifiedQs[0] as { conceptTitle?: string })?.conceptTitle ?? 'Верификуван квиз';
    const result: AIGeneratedAssessment = {
      title: `📚 ${conceptTitle} — од верификувана банка`,
      type: 'QUIZ',
      questions: verifiedQs.map((q: SavedQuestion) => ({
        type: (q.type ?? QuestionType.MULTIPLE_CHOICE) as AssessmentQuestion['type'],
        question: q.question,
        options: q.options ?? [],
        answer: q.answer,
        solution: q.solution ?? '',
        cognitiveLevel: (q.cognitiveLevel ?? 'Remembering') as AssessmentQuestion['cognitiveLevel'],
        difficulty_level: (q.difficulty_level ?? 'Medium') as AssessmentQuestion['difficulty_level'],
      })),
    };
    setGeneratedMaterial(result);
    setVariants(null);
    setBulkResults(null);
    addNotification(`Квиз создаден од ${verifiedQs.length} верификувани прашања.`, 'success');
  };

  return {
    savedToLibrary,
    assignTarget,
    setAssignTarget,
    isPro,
    saveIsPublic,
    setSaveIsPublic,
    handleSaveToLibrary,
    handleSaveQuestion,
    handleSaveAsNote,
    handleMaterialRate,
    handleGenerateFromBank,
    handleSavePackage,
  };
}
