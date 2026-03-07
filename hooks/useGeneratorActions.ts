import { useState, useRef, useEffect, useMemo } from 'react';
import { geminiService, isDailyQuotaKnownExhausted, clearDailyQuotaFlag } from '../services/geminiService';
import { RateLimitError } from '../services/apiErrors';
import { firestoreService } from '../services/firestoreService';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric,
  GenerationContext, Topic, Concept, Grade, NationalStandard, StudentProfile,
  AIGeneratedIllustration, AIGeneratedLearningPaths, DifferentiationLevel,
  AssessmentQuestion, TeachingProfile, SavedQuestion,
} from '../types';
import { ModalType, PlannerItemType, QuestionType } from '../types';
import type { GeneratorState, GeneratorAction } from './useGeneratorState';
import { getInitialState } from './useGeneratorState';
import { useVerifiedQuestions, useTeacherNoteQuery, useDifficultyRecommendation, useSaveTeacherNote } from './useGeneratorQueries';

const MACEDONIAN_CONTEXT_HINT =
  'Користи македонски примери: цени во денари (МКД), градови (Скопје, Битола, Охрид), реки (Вардар, Брегалница), ситуации од македонскиот секојдневен живот.';

type GeneratedMaterial =
  | AIGeneratedIdeas
  | AIGeneratedAssessment
  | AIGeneratedRubric
  | AIGeneratedIllustration
  | AIGeneratedLearningPaths
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
  const [isThrottled, setIsThrottled] = useState(false);
  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);
  const [quotaError, setQuotaError] = useState<{ resetTime: string; resetMs: number; exhaustedAt?: string } | null>(null);
  const [quotaCountdown, setQuotaCountdown] = useState('');
  const cancelRef = useRef(false);

  // Variants state
  const [variants, setVariants] = useState<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment> | null>(null);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [activeVariantTab, setActiveVariantTab] = useState<'support' | 'standard' | 'advanced'>('standard');

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

  // Live countdown for quota reset banner
  useEffect(() => {
    if (!quotaError?.resetMs) { setQuotaCountdown(''); return; }
    const update = () => {
      const diff = quotaError.resetMs - Date.now();
      if (diff <= 0) { setQuotaCountdown(''); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setQuotaCountdown(h > 0 ? `${h}ч ${m}мин` : `${m}мин`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [quotaError]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setQuotaBannerFromStorage = () => {
    try {
      const cookieMatch = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
      const stored = cookieMatch
        ? decodeURIComponent(cookieMatch.slice('ai_quota='.length))
        : localStorage.getItem('ai_daily_quota_exhausted');
      const { nextResetMs, exhaustedAt }: { nextResetMs?: number, exhaustedAt?: number | string } = stored ? JSON.parse(stored) : {};
      const resetTime = nextResetMs
        ? new Date(nextResetMs).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })
        : '09:00';
      const exhaustedAtStr = exhaustedAt
        ? new Date(exhaustedAt).toLocaleString('mk-MK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : undefined;
      setQuotaError({ resetTime, resetMs: nextResetMs ?? 0, exhaustedAt: exhaustedAtStr });
    } catch {
      setQuotaError({ resetTime: '09:00', resetMs: 0 });
    }
  };

  const handleClearQuota = () => {
    clearDailyQuotaFlag();
    setQuotaError(null);
    addNotification('Квота флагот е ресетиран. Обидете се со генерирање.', 'success');
  };

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
      materialType, questionTypes, useStudentProfiles, selectedStudentProfileIds, activityTitle, illustrationPrompt } = state;
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
      await firestoreService.saveToLibrary(material, {
        title: material.title || 'Генериран материјал',
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

  const handleGenerateVariants = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isGeneratingVariants || isGenerateDisabled) return;
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');

    setIsGeneratingVariants(true);
    setVariants(null);
    setGeneratedMaterial(null);

    const levels = ['support', 'standard', 'advanced'] as const;
    const newVariants: Partial<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment>> = {};
    let quotaHit = false;
    for (const level of levels) {
      if (quotaHit) break;
      try {
        newVariants[level] = await geminiService.generateAssessment(
          state.materialType as 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS',
          state.questionTypes, state.numQuestions, finalContext,
          user ?? undefined, level, undefined, undefined, effectiveInstruction, state.includeSelfAssessment
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          setQuotaBannerFromStorage();
          quotaHit = true;
        } else {
          console.warn(`Failed to generate ${level} variant:`, error);
        }
      }
    }
    if (!quotaHit && Object.keys(newVariants).length > 0) {
      setVariants(newVariants as Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment>);
    } else if (!quotaHit) {
      addNotification('Не можеше да се генерираат варијантите. Обидете се повторно.', 'error');
    }
    setIsGeneratingVariants(false);
  };

  const handleBulkGenerate = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context, tempActivityTitle } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');

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
  };

  const handleGenerate = async () => {
    if (isGenerating || isGeneratingBulk || isGeneratingVariants) return;
    if (!isOnline) { addNotification('Нема интернет конекција. Генераторот е недостапен.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }
    if (isThrottled) { addNotification('Ве молиме почекајте малку пред следното барање.', 'warning'); return; }
    if (!curriculum) { addNotification('Наставната програма се уште се вчитува.', 'warning'); return; }

    setIsThrottled(true);
    setTimeout(() => setIsThrottled(false), 3000);

    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext, imageParam, studentProfilesToPass, tempActivityTitle } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');
    const { materialType, questionTypes, numQuestions, differentiationLevel, exitTicketQuestions, exitTicketFocus, activityType, criteriaHints, includeSelfAssessment, activityFocus, scenarioTone, learningDesignModel } = state;

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
        const res = await geminiService.generateIllustration(state.illustrationPrompt, imageParam);
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
              user ?? undefined, differentiationLevel, studentProfilesToPass, imageParam, effectiveInstruction, includeSelfAssessment
            );
            break;
          case 'EXIT_TICKET':
            result = await geminiService.generateExitTicket(exitTicketQuestions, exitTicketFocus, finalContext, user ?? undefined, effectiveInstruction);
            break;
          case 'RUBRIC':
            if (!finalContext.grade) throw new Error('Недостасува информација за одделение.');
            result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, activityType, criteriaHints, user ?? undefined, effectiveInstruction);
            break;
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
