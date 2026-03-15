import { useState, useRef, useEffect, useMemo } from 'react';
import { geminiService, isDailyQuotaKnownExhausted, clearDailyQuotaFlag } from '../services/geminiService';
import { AI_COSTS } from '../services/gemini/core';
import { RateLimitError } from '../services/apiErrors';
import { firestoreService } from '../services/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric,
  GenerationContext, Topic, Concept, Grade, NationalStandard, StudentProfile,
  AIGeneratedIllustration, AIGeneratedLearningPaths, DifferentiationLevel,
  AssessmentQuestion, TeachingProfile, SavedQuestion, AIGeneratedWorkedExample,
  AIGeneratedPresentation
} from '../types';
import { ModalType, PlannerItemType, QuestionType } from '../types';
import type { GeneratorState, GeneratorAction } from './useGeneratorState';
import { getInitialState } from './useGeneratorState';
import { useVerifiedQuestions, useTeacherNoteQuery, useDifficultyRecommendation, useSaveTeacherNote } from './useGeneratorQueries';
import { useQuotaManager } from './useQuotaManager';
import { useVariantGenerate } from './useVariantGenerate';

const MACEDONIAN_CONTEXT_HINT =
  'Користи македонски примери: цени во денари (МКД), градови (Скопје, Битола, Охрид), реки (Вардар, Брегалница), ситуации од македонскиот секојдневен живот.';

const AI_TONE_MAP: Record<string, string> = {
  creative: 'Тонот нека биде креативен и ангажирачки — живописни приказни, интересни ликови, изненадувачки контексти.',
  formal: 'Тонот нека биде формален и академски — прецизни дефиниции, строга терминологија, без разговорни изрази.',
  friendly: 'Тонот нека биде пријателски и поддржувачки — охрабрувачки зборови, топол јазик, директно обраќање до ученикот.',
  expert: 'Тонот нека биде стручен и предизвикувачки — апстрактни поими, повеќестепено размислување, засилена когнитивна побарувачка.',
  playful: 'Тонот нека биде игровен и хумористичен — смешни ситуации, ликови со имиња, приказни со изненадувања.',
};
const AI_VOCAB_MAP: Record<string, string> = {
  simplified: 'НИВО НА РЕЧНИК: Поедноставен — употребувај само основни зборови и кратки реченици. Избегнувај технички жаргон.',
  standard: '',
  advanced: 'НИВО НА РЕЧНИК: Напреден — употребувај стручна терминологија, сложени реченици и прецизни математички поими.',
};
const AI_STYLE_MAP: Record<string, string> = {
  standard: '',
  socratic: 'ОБРАЗОВЕН СТИЛ — Сократски: водечки прашања наместо директни одговори. Учениците сами да ги откријат законитостите.',
  direct: 'ОБРАЗОВЕН СТИЛ — Директно-инструктивен: јасни чекор-по-чекор инструкции, примери пред задачи, без двосмисленост.',
  inquiry: 'ОБРАЗОВЕН СТИЛ — Истражувачки: почни со проблем или загатка, наведи го ученикот да истражува и формулира хипотеза.',
  problem: 'ОБРАЗОВЕН СТИЛ — Проблемски: реален животен контекст пред теоријата, ученикот го решава проблемот со математиката.',
};

function buildAiPersonalizationSnippet(state: { aiTone: string; aiVocabLevel: string; aiStyle: string }): string {
  return [
    state.aiTone !== 'creative' ? AI_TONE_MAP[state.aiTone] : '',
    AI_VOCAB_MAP[state.aiVocabLevel] ?? '',
    AI_STYLE_MAP[state.aiStyle] ?? '',
  ].filter(Boolean).join(' ');
}

type GeneratedMaterial =
  | AIGeneratedIdeas
  | AIGeneratedAssessment
  | AIGeneratedRubric
  | AIGeneratedIllustration
  | AIGeneratedLearningPaths
  | AIGeneratedWorkedExample
  | AIGeneratedPresentation
  | null;

interface UseGeneratorActionsParams {
  state: GeneratorState;
  dispatch: React.Dispatch<GeneratorAction>;
  curriculum: any;
  allConcepts: Concept[];
  allNationalStandards: NationalStandard[] | undefined;
  user: TeachingProfile | null;
  firebaseUser: any; // Firebase User
  isOnline: boolean;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  addItem: (item: any) => Promise<void>;
  showModal: (type: ModalType, payload: any) => void;
  hideModal: () => void;
  getConceptDetails: (id: string) => any;
  findConceptAcrossGrades: (id: string) => any;
  deductCredits?: (amount?: number) => Promise<void>;
  openUpgradeModal?: (reason: string) => void;
}

export function useGeneratorActions({
  state,
  dispatch,
  curriculum,
  allConcepts,
  allNationalStandards,
  user,
  firebaseUser,
  isOnline,
  addNotification,
  addItem,
  showModal,
  hideModal,
  getConceptDetails,
  findConceptAcrossGrades,
  deductCredits,
  openUpgradeModal,
}: UseGeneratorActionsParams) {
  const { t } = useLanguage();

  // Derived lists from curriculum + state
  const filteredTopics = useMemo(
    () => curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.topics || [],
    [curriculum, state.selectedGrade]
  );
  const filteredConcepts = useMemo(
    () => filteredTopics.find((topic: Topic) => topic.id === state.selectedTopic)?.concepts || [],
    [filteredTopics, state.selectedTopic]
  );

  // Generation state
  const [isGenerating, setIsLoading] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<GeneratedMaterial>(null);
  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);
  const cancelRef = useRef(false);

  const {
    quotaError,
    setQuotaError,
    quotaCountdown,
    isThrottled,
    setIsThrottled,
    setQuotaBannerFromStorage,
    handleClearQuota,
  } = useQuotaManager(addNotification);

  // Assignment + library state
  const [assignTarget, setAssignTarget] = useState<AIGeneratedAssessment | null>(null);
  const [savedToLibrary, setSavedToLibrary] = useState<Set<string>>(new Set());

  // Teacher note state
  const [teacherNote, setTeacherNote] = useState('');
  const [teacherNoteSaved, setTeacherNoteSaved] = useState(false);

  // Bulk generation state
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkStep, setBulkStep] = useState<'QUIZ' | 'ASSESSMENT' | 'RUBRIC' | null>(null);
  const [bulkResults, setBulkResults] = useState<{
    quiz?: AIGeneratedAssessment;
    assessment?: AIGeneratedAssessment;
    rubric?: AIGeneratedRubric;
  } | null>(null);

  // Verified question bank and queries
  const firstConceptId = state.selectedConcepts[0];
  const { data: verifiedQs = [] } = useVerifiedQuestions(firebaseUser?.uid, firstConceptId);

  // Teacher note loader — reloads when concept changes
  const { data: fetchedTeacherNote = '' } = useTeacherNoteQuery(firebaseUser?.uid, firstConceptId, state.contextType);
  useEffect(() => {
    setTeacherNote(fetchedTeacherNote);
    setTeacherNoteSaved(false);
  }, [fetchedTeacherNote]);

  // Adaptive difficulty recommendation
  const { data: recommendedDiff } = useDifficultyRecommendation(firebaseUser?.uid, firstConceptId);
  const [diffRec, setDiffRec] = useState<DifferentiationLevel | null>(null);

  useEffect(() => {
    if (recommendedDiff) {
      setDiffRec(recommendedDiff);
      if (state.differentiationLevel === 'standard') {
        dispatch({ type: 'SET_FIELD', payload: { field: 'differentiationLevel', value: recommendedDiff } });
      }
    } else {
      setDiffRec(null);
    }
  }, [recommendedDiff, state.differentiationLevel, dispatch]);

  const saveTeacherNoteMutation = useSaveTeacherNote();

  // Auto-populate illustration prompt when material type or context changes
  useEffect(() => {
    if (state.materialType !== 'ILLUSTRATION') return;
    let newPrompt = '';
    if (state.contextType === 'CONCEPT' && state.selectedConcepts.length > 0) {
      const concept = filteredConcepts.find((c: Concept) => c.id === state.selectedConcepts[0]);
      newPrompt = concept ? `Визуелен приказ на ${concept.title}` : '';
    } else if (state.contextType === 'STANDARD' && state.selectedStandard) {
      const standard = allNationalStandards?.find((s: NationalStandard) => s.id === state.selectedStandard);
      newPrompt = standard ? `Илустрација за: ${standard.description}` : '';
    } else if (state.contextType === 'SCENARIO' && state.scenarioText) {
      newPrompt = `Илустрација за идејата: ${state.scenarioText}`;
    } else if (state.contextType === 'ACTIVITY' && state.selectedActivity) {
      newPrompt = `Илустрација за активноста: ${state.selectedActivity}`;
    }
    dispatch({ type: 'SET_FIELD', payload: { field: 'illustrationPrompt', value: newPrompt } });
  }, [state.materialType, state.contextType, state.selectedConcepts, state.selectedStandard, state.scenarioText, state.selectedActivity, filteredConcepts, allNationalStandards]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const buildContext = (): {
    context: GenerationContext;
    imageParam: any;
    studentProfilesToPass: StudentProfile[] | undefined;
    tempActivityTitle: string;
  } | null => {
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
              progression: prog.progression.map((p: any) => ({ grade: p.grade, conceptTitle: p.concept.title })),
            };
          })
          .filter((p: any): p is NonNullable<typeof p> => p !== null);
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

  // ── isGenerateDisabled ────────────────────────────────────────────────────

  const isGenerateDisabled = useMemo(() => {
    const { contextType, selectedConcepts, selectedStandard, scenarioText, selectedActivity, imageFile,
      materialType, questionTypes, useStudentProfiles, selectedStudentProfileIds, activityTitle, illustrationPrompt,
      bloomDistribution } = state;
    if (isGenerating || isGeneratingBulk || !isOnline) return true;
    let contextIsValid = false;
    switch (contextType) {
      case 'CONCEPT': case 'TOPIC': contextIsValid = selectedConcepts.length > 0; break;
      case 'STANDARD': contextIsValid = !!selectedStandard; break;
      case 'SCENARIO': contextIsValid = scenarioText.trim().length > 0 || !!imageFile; break;
      case 'ACTIVITY': contextIsValid = selectedConcepts.length > 0 && !!selectedActivity; break;
      default: contextIsValid = false;
    }
    if (!contextIsValid) return true;
    if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType || '')) {
      if (questionTypes.length === 0) return true;
      if (useStudentProfiles && selectedStudentProfileIds.length === 0) return true;
      // Bloom sliders must sum to exactly 100% when set
      if (bloomDistribution && Object.keys(bloomDistribution).length > 0) {
        const bloomTotal = Object.values(bloomDistribution).reduce((s, v) => s + (v ?? 0), 0);
        if (bloomTotal !== 100) return true;
      }
    }
    if (materialType === 'LEARNING_PATH' && selectedStudentProfileIds.length === 0) return true;
    if (materialType === 'RUBRIC' && !activityTitle) return true;
    if (materialType === 'ILLUSTRATION' && !illustrationPrompt.trim() && !imageFile) return true;
    return false;
  }, [isGenerating, isGeneratingBulk, isOnline, state]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveTeacherNote = async () => {
    const conceptId = state.selectedConcepts[0];
    if (!firebaseUser?.uid || !conceptId) return;
    saveTeacherNoteMutation.mutate({ teacherUid: firebaseUser.uid, conceptId, note: teacherNote }, {
      onSuccess: () => {
        setTeacherNoteSaved(true);
        setTimeout(() => setTeacherNoteSaved(false), 2000);
      }
    });
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

  const handleReset = () => {
    showModal(ModalType.Confirm, {
      title: t('generator.resetTitle'),
      message: t('generator.resetConfirm'),
      variant: 'warning',
      confirmLabel: t('generator.resetBtn'),
      onConfirm: () => {
        hideModal();
        if (curriculum && allNationalStandards) {
          dispatch({ type: 'INITIALIZE', payload: getInitialState(curriculum, allNationalStandards) });
        }
        setGeneratedMaterial(null);
        addNotification(t('generator.notifications.reset'), 'info');
      },
      onCancel: hideModal,
    });
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setIsLoading(false);
  };

  const handleMaterialRate = (rating: 'up' | 'down', reportText?: string) => {
    if (!firebaseUser?.uid || !generatedMaterial) return;
    const title = ('title' in generatedMaterial ? (generatedMaterial as any).title : '') ?? '';
    const type = state.materialType ?? 'UNKNOWN';
    firestoreService.saveMaterialFeedback(
      rating, title, type, firebaseUser.uid, reportText,
      state.selectedConcepts[0] ?? undefined,
      state.selectedGrade ? Number(state.selectedGrade) || undefined : undefined,
    ).catch(err => console.warn('[Feedback] save failed:', err));
  };

  const handleSaveToLibrary = async (material: any, keyHint: string) => {
    if (!firebaseUser?.uid) { addNotification('Мора да бидете логирани.', 'error'); return; }
    if (savedToLibrary.has(keyHint)) return;
    try {
      const conceptId = state.selectedConcepts[0];
      const gradeLevel = curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level;
      const materialTypeToLibType: Record<string, 'quiz' | 'assessment' | 'rubric' | 'ideas' | 'analogy'> = {
        QUIZ: 'quiz', ASSESSMENT: 'assessment', RUBRIC: 'rubric', SCENARIO: 'ideas',
      };
      const libType = materialTypeToLibType[state.materialType ?? ''] ?? 'quiz';

      // П-Ј: generate smart title for quiz/assessment materials
      let title = material.title || '';
      if (!title && (libType === 'quiz' || libType === 'assessment')) {
        title = await geminiService.generateSmartQuizTitle(material).catch(() => '');
      }
      if (!title) title = 'Генериран материјал';

      await firestoreService.saveToLibrary(material, {
        title,
        type: libType,
        teacherUid: firebaseUser.uid,
        conceptId,
        topicId: state.selectedTopic,
        gradeLevel,
      });
      setSavedToLibrary(prev => new Set(prev).add(keyHint));
      addNotification('Зачувано во библиотека! Прегледај и публикувај во „Библиотека". 📚', 'success');
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

  const handleGenerateFromBank = () => {
    if (verifiedQs.length === 0) return;
    const conceptTitle = verifiedQs[0]?.conceptTitle ?? 'Верификуван квиз';
    const result: AIGeneratedAssessment = {
      title: `📚 ${conceptTitle} — од верификувана банка`,
      type: 'QUIZ',
      questions: verifiedQs.map(q => ({
        type: q.type as any,
        question: q.question,
        options: q.options ?? [],
        answer: q.answer,
        solution: q.solution ?? '',
        cognitiveLevel: (q.cognitiveLevel ?? 'Remembering') as any,
        difficulty_level: (q.difficulty_level ?? 'Medium') as any,
      })),
    };
    setGeneratedMaterial(result);
    setVariants(null);
    setBulkResults(null);
    addNotification(`Квиз создаден од ${verifiedQs.length} верификувани прашања.`, 'success');
  };

  const {
    variants,
    setVariants,
    isGeneratingVariants,
    activeVariantTab,
    setActiveVariantTab,
    handleGenerateVariants,
  } = useVariantGenerate({
    state,
    isOnline,
    isGenerateDisabled,
    teacherNote,
    user,
    addNotification,
    setQuotaBannerFromStorage,
    buildContext,
    buildAiPersonalizationSnippet,
    MACEDONIAN_CONTEXT_HINT,
    setGeneratedMaterial,
    deductCredits,
    openUpgradeModal,
  });

  const handleBulkGenerate = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const cost = AI_COSTS.BULK;
    // Upfront credit gate (cost: 5 credits for bulk)
    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Пакетот чини ${cost} кредити. Надградете на Pro за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context, tempActivityTitle } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', buildAiPersonalizationSnippet(state), teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');

    setIsGeneratingBulk(true);
    setBulkResults(null);
    setGeneratedMaterial(null);
    const acc: { quiz?: AIGeneratedAssessment; assessment?: AIGeneratedAssessment; rubric?: AIGeneratedRubric } = {};

    const steps: Array<{ key: 'QUIZ' | 'ASSESSMENT' | 'RUBRIC'; fn: () => Promise<void> }> = [
      { key: 'QUIZ', fn: async () => {
        acc.quiz = await geminiService.generateAssessment(
          'QUIZ', [QuestionType.MULTIPLE_CHOICE], 5, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false
        );
      }},
      { key: 'ASSESSMENT', fn: async () => {
        acc.assessment = await geminiService.generateAssessment(
          'ASSESSMENT',
          state.questionTypes.length ? state.questionTypes : [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
          10, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false
        );
      }},
      { key: 'RUBRIC', fn: async () => {
        acc.rubric = await geminiService.generateRubric(
          context.grade.level,
          tempActivityTitle || `Активност за ${context.topic?.title ?? ''}`,
          state.activityType, '', user ?? undefined, effectiveInstruction
        );
      }},
    ];

    for (const step of steps) {
      setBulkStep(step.key);
      try {
        await step.fn();
        setBulkResults({ ...acc });
      } catch (error) {
        if (error instanceof RateLimitError) { setQuotaBannerFromStorage(); break; }
        console.error(`[Bulk] ${step.key} failed:`, error);
      }
    }
    setBulkStep(null);
    setIsGeneratingBulk(false);
      
      // Deduct credits for bulk generation
      if (typeof deductCredits === 'function' && Object.keys(acc).length > 0) {
          await deductCredits(cost);
      }
  };

  const handleGenerate = async () => {
    if (isGenerating || isGeneratingBulk || isGeneratingVariants) return;
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const { materialType, includeIllustration } = state;
    let cost = AI_COSTS.TEXT_BASIC;
    if (materialType === 'ILLUSTRATION') cost = AI_COSTS.ILLUSTRATION;
    else if (materialType === 'PRESENTATION') cost = AI_COSTS.PRESENTATION;
    else if (materialType === 'LEARNING_PATH') cost = AI_COSTS.LEARNING_PATH;
    
    // If user wants an illustration with their material, add its cost
    if (includeIllustration && materialType !== 'ILLUSTRATION') {
        cost += AI_COSTS.ILLUSTRATION;
    }

    // Upfront credit gate — check before calling AI
    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Оваа опција чини ${cost} кредити. Надградете на Pro пакет за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext, imageParam, studentProfilesToPass, tempActivityTitle } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', buildAiPersonalizationSnippet(state), teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');
    const { questionTypes, numQuestions, differentiationLevel, exitTicketQuestions, exitTicketFocus, activityType, criteriaHints, includeSelfAssessment, activityFocus, scenarioTone, learningDesignModel } = state;

    setIsLoading(true);
    setGeneratedMaterial(null);
    setVariants(null);

    try {
      let result: GeneratedMaterial = null;
      if (materialType === 'ILLUSTRATION') {
        if (!state.illustrationPrompt && !state.imageFile) {
          addNotification('Ве молиме внесете опис или прикачете слика за илустрацијата.', 'error');
          setIsLoading(false);
          return;
        }
        const res = await geminiService.generateIllustration(state.illustrationPrompt, imageParam, user ?? undefined);
        result = { ...res, prompt: state.illustrationPrompt };
      } else if (materialType === 'LEARNING_PATH') {
        if (!studentProfilesToPass || studentProfilesToPass.length === 0) {
          addNotification('Ве молиме изберете барем еден профил на ученик.', 'error');
          setIsLoading(false);
          return;
        }
        result = await geminiService.generateLearningPaths(finalContext, studentProfilesToPass, user ?? undefined, effectiveInstruction);
      } else if (materialType) {
        switch (materialType) {
          case 'SCENARIO':
            if (!finalContext.grade) throw new Error('Недостасува информација за одделение.');
            if (!finalContext.topic) throw new Error('Недостасува информација за тема.');
            result = await geminiService.generateLessonPlanIdeas(
              finalContext.concepts || [], finalContext.topic, finalContext.grade.level,
              user ?? undefined, { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel }, effectiveInstruction
            );
            (result as any).generationContext = finalContext;
            break;
          case 'ASSESSMENT':
          case 'FLASHCARDS':
          case 'QUIZ':
            result = await geminiService.generateAssessment(
              materialType, questionTypes, numQuestions, finalContext,
              user ?? undefined, differentiationLevel, studentProfilesToPass, imageParam, effectiveInstruction, state.includeSelfAssessment, state.includeWorkedExamples
            );
            break;
          case 'WORKED_EXAMPLE': {
            const conceptObj = finalContext.concepts?.[0];
            const conceptTitle = conceptObj?.title ?? finalContext.topic?.title ?? 'Математика';
            const gradeLevel = finalContext.grade?.level ?? 1;
            result = await geminiService.generateWorkedExample(conceptTitle, gradeLevel);
            break;
          }
          case 'EXIT_TICKET':
            result = await geminiService.generateExitTicket(exitTicketQuestions, exitTicketFocus, finalContext, user ?? undefined, effectiveInstruction);
            break;
          case 'RUBRIC':
            if (!finalContext.grade) throw new Error('Недостасува информација за одделение.');
            result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, activityType, criteriaHints, user ?? undefined, effectiveInstruction);
            break;
          case 'PRESENTATION':
            if (!finalContext.topic) throw new Error('Недостасува информација за тема.');
            result = await geminiService.generatePresentation(
              finalContext.topic.title, 
              finalContext.grade?.level ?? 1, 
              finalContext.concepts?.map(c => c.title) || [], 
              effectiveInstruction,
              user ?? undefined
            );
            break;
        }
      }

      if (deductCredits && result) {
          await deductCredits(cost);
      }

      // If user requested an illustration to be included with the material
      if (includeIllustration && result && materialType !== 'ILLUSTRATION') {
          try {
              let illustrationPrompt = "";
              const contextTitle = finalContext.concepts?.[0]?.title || finalContext.topic?.title || "Математика";
              const gradeLevel = finalContext.grade?.level || 1;
              
              if (materialType === 'SCENARIO') {
                  illustrationPrompt = `Креативен визуелен приказ за наставен час по математика на тема "${contextTitle}" за ${gradeLevel}. одделение.`;
              } else if (materialType === 'ASSESSMENT' || materialType === 'QUIZ') {
                  illustrationPrompt = `Илустрација за работен лист или квиз по математика за "${contextTitle}" (${gradeLevel}. одд).`;
              } else {
                  illustrationPrompt = `Визуелен приказ за ${contextTitle} (${gradeLevel}. одд).`;
              }

              const illRes = await geminiService.generateIllustration(illustrationPrompt, undefined, user ?? undefined);
              if (illRes && illRes.imageUrl) {
                  (result as any).illustrationUrl = illRes.imageUrl;
              }
          } catch (illErr) {
              console.warn("Failed to generate contextual illustration:", illErr);
              // Non-fatal, we already have the main result
          }
      }

      setGeneratedMaterial(result);
    } catch (error) {
      if (cancelRef.current) { cancelRef.current = false; return; }
      console.error('[AI Generator]', error);
      if (error instanceof RateLimitError) {
        setQuotaBannerFromStorage();
      } else {
        const msg = (error instanceof Error && error.message) ? error.message : 'Грешка при генерирање. Обидете се повторно.';
        addNotification(msg, 'error');
      }
      setGeneratedMaterial(null);
    } finally {
      cancelRef.current = false;
      setIsLoading(false);
    }
  };

  return {
    // Derived lists
    filteredTopics,
    filteredConcepts,
    // Generation state
    isGenerating,
    generatedMaterial,
    setGeneratedMaterial,
    isThrottled,
    isPlayingQuiz,
    setIsPlayingQuiz,
    quotaError,
    setQuotaError,
    quotaCountdown,
    variants,
    setVariants,
    isGeneratingVariants,
    activeVariantTab,
    setActiveVariantTab,
    assignTarget,
    setAssignTarget,
    savedToLibrary,
    teacherNote,
    setTeacherNote,
    teacherNoteSaved,
    isGeneratingBulk,
    bulkStep,
    bulkResults,
    diffRec,
    verifiedQs,
    isGenerateDisabled,
    // Handlers
    handleGenerate,
    handleGenerateVariants,
    handleBulkGenerate,
    handleCancel,
    handleReset,
    handleSaveAsNote,
    handleSaveTeacherNote,
    handleSaveQuestion,
    handleSaveToLibrary,
    handleMaterialRate,
    handleGenerateFromBank,
    handleClearQuota,
  };
}
