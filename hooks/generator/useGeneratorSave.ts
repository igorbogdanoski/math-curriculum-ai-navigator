/**
 * useGeneratorSave — library/save operations for generated materials.
 * Handles: savedToLibrary, assignTarget, handleSaveToLibrary, handleSaveQuestion,
 *          handleSaveAsNote, handleMaterialRate, handleGenerateFromBank.
 */
import { useState } from 'react';
import type { User } from 'firebase/auth';
import { geminiService } from '../../services/geminiService';
import { firestoreService } from '../../services/firestoreService';
import { useAcademyProgress } from '../../contexts/AcademyProgressContext';
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

interface UseGeneratorSaveParams {
  state: GeneratorState;
  curriculum: Curriculum;
  filteredConcepts: Concept[];
  user: TeachingProfile | null;
  firebaseUser: User | null;
  generatedMaterial: GeneratedMaterial;
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

  const handleSaveToLibrary = async (material: GeneratedMaterial, keyHint: string) => {
    if (!firebaseUser?.uid) { addNotification('Мора да бидете логирани.', 'error'); return; }
    if (!material) return;
    if (savedToLibrary.has(keyHint)) return;
    try {
      const conceptId = state.selectedConcepts[0];
      const gradeLevel = curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level;
      const materialTypeToLibType: Record<string, 'quiz' | 'assessment' | 'rubric' | 'ideas' | 'analogy'> = {
        QUIZ: 'quiz', ASSESSMENT: 'assessment', RUBRIC: 'rubric', SCENARIO: 'ideas',
      };
      const libType = materialTypeToLibType[state.materialType ?? ''] ?? 'quiz';
      let title = (material as { title?: string })?.title || '';
      if (!title && (libType === 'quiz' || libType === 'assessment')) {
        title = await geminiService.generateSmartQuizTitle(material as unknown as Record<string, unknown>).catch(() => '');
      }
      if (!title) title = 'Генериран материјал';
      await firestoreService.saveToLibrary(material as unknown as Record<string, unknown>, {
        title,
        type: libType,
        teacherUid: firebaseUser.uid,
        conceptId,
        topicId: state.selectedTopic,
        gradeLevel,
      });
      setSavedToLibrary(prev => new Set(prev).add(keyHint));
      const newAchievements = trackMaterialSaved(libType);
      const achievementMsg = newAchievements.length ? ` Ново достигнување: ${newAchievements.join(', ')}` : '';
      addNotification(`Зачувано во библиотека! Прегледај и публикувај во „Библиотека". 📚${achievementMsg}`, 'success');
    } catch {
      addNotification('Грешка при зачувување.', 'error');
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
      console.error('Error saving question:', err);
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
    ).catch(err => console.warn('[Feedback] save failed:', err));
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
    handleSaveToLibrary,
    handleSaveQuestion,
    handleSaveAsNote,
    handleMaterialRate,
    handleGenerateFromBank,
  };
}
