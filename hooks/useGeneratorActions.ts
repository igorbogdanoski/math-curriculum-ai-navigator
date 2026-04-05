import { useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { AI_COSTS, sanitizePromptInput } from '../services/gemini/core';
import { RateLimitError } from '../services/apiErrors';
import { ValidationError } from '../utils/errors';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  AIGeneratedAssessment, AIGeneratedRubric, AIGeneratedIdeas,
  Topic, Concept, Grade, NationalStandard,
  TeachingProfile, PlannerItem, Curriculum, ConceptProgression,
} from '../types';
import { ModalType, QuestionType } from '../types';
import type { GeneratorState, GeneratorAction } from './useGeneratorState';
import { getInitialState } from './useGeneratorState';
import { useVerifiedQuestions } from './useGeneratorQueries';
import { useQuotaManager } from './useQuotaManager';
import { useVariantGenerate } from './useVariantGenerate';
import {
  useGeneratorContext,
  useGeneratorTeacherNote,
  useGeneratorSave,
  type GeneratedMaterial,
} from './generator';

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

interface UseGeneratorActionsParams {
  state: GeneratorState;
  dispatch: React.Dispatch<GeneratorAction>;
  curriculum: Curriculum;
  allConcepts: Concept[];
  allNationalStandards: NationalStandard[] | undefined;
  user: TeachingProfile | null;
  firebaseUser: User | null;
  isOnline: boolean;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  addItem: (item: Omit<PlannerItem, 'id'>) => Promise<void>;
  showModal: (type: ModalType, props?: Record<string, unknown>) => void;
  hideModal: () => void;
  getConceptDetails: (id: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
  findConceptAcrossGrades: (id: string) => ConceptProgression | undefined;
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

  // ── Generation state ──────────────────────────────────────────────────────
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

  // ── Bulk generation state ─────────────────────────────────────────────────
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkStep, setBulkStep] = useState<'SCENARIO' | 'QUIZ' | 'ASSESSMENT' | 'RUBRIC' | null>(null);
  const [bulkResults, setBulkResults] = useState<{
    scenario?: AIGeneratedIdeas;
    quiz?: AIGeneratedAssessment;
    assessment?: AIGeneratedAssessment;
    rubric?: AIGeneratedRubric;
  } | null>(null);

  // ── Sub-hooks ─────────────────────────────────────────────────────────────
  const firstConceptId = state.selectedConcepts[0];
  const { data: verifiedQs = [] } = useVerifiedQuestions(firebaseUser?.uid, firstConceptId);

  const { teacherNote, setTeacherNote, teacherNoteSaved, diffRec, handleSaveTeacherNote } =
    useGeneratorTeacherNote({ state, firebaseUser, dispatch });

  // Note: isGeneratingVariants not included in context (matches original isGenerateDisabled logic)
  const { filteredTopics, filteredConcepts, buildContext, isGenerateDisabled } =
    useGeneratorContext({
      state,
      curriculum,
      allConcepts,
      allNationalStandards,
      user,
      isGenerating,
      isGeneratingBulk,
      isGeneratingVariants: false,
      isOnline,
      getConceptDetails,
      findConceptAcrossGrades,
    });

  const variantHook = useVariantGenerate({
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

  const {
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
  } = useGeneratorSave({
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
    setVariants: variantHook.setVariants,
    setBulkResults,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  const buildEffectiveInstruction = () => {
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    return [
      state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '',
      buildAiPersonalizationSnippet(state),
      teacherNoteInstruction,
      sanitizePromptInput(state.customInstruction),
    ].filter(Boolean).join(' ');
  };

  const handleBulkGenerate = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const cost = AI_COSTS.BULK;
    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Пакетот чини ${cost} кредити. Надградете на Pro за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context, tempActivityTitle } = built;
    const effectiveInstruction = buildEffectiveInstruction();

    setIsGeneratingBulk(true);
    setBulkResults(null);
    setGeneratedMaterial(null);
    const acc: {
      scenario?: AIGeneratedIdeas;
      quiz?: AIGeneratedAssessment;
      assessment?: AIGeneratedAssessment;
      rubric?: AIGeneratedRubric;
    } = {};

    const steps: Array<{ key: 'SCENARIO' | 'QUIZ' | 'ASSESSMENT' | 'RUBRIC'; fn: () => Promise<void> }> = [
      { key: 'SCENARIO', fn: async () => {
        const ideas = await geminiService.generateLessonPlanIdeas(
          context.concepts || [], context.topic!, context.grade.level,
          user ?? undefined,
          { focus: state.activityFocus, tone: state.scenarioTone, learningDesign: state.learningDesignModel },
          effectiveInstruction,
        );
        ideas.generationContext = context;
        acc.scenario = ideas;
      } },
      { key: 'QUIZ', fn: async () => {
        acc.quiz = await geminiService.generateAssessment(
          'QUIZ', [QuestionType.MULTIPLE_CHOICE], 5, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false,
        );
      } },
      { key: 'ASSESSMENT', fn: async () => {
        acc.assessment = await geminiService.generateAssessment(
          'ASSESSMENT',
          state.questionTypes.length ? state.questionTypes : [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
          10, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false,
        );
      } },
      { key: 'RUBRIC', fn: async () => {
        acc.rubric = await geminiService.generateRubric(
          context.grade.level,
          tempActivityTitle || `Активност за ${context.topic?.title ?? ''}`,
          state.activityType, '', user ?? undefined, effectiveInstruction,
        );
      } },
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

    if (typeof deductCredits === 'function' && Object.keys(acc).length > 0) {
      await deductCredits(cost);
    }
  };

  const handleGenerate = async () => {
    if (isGenerating || isGeneratingBulk || variantHook.isGeneratingVariants) return;
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const { materialType, includeIllustration } = state;
    let cost = AI_COSTS.TEXT_BASIC;
    if (materialType === 'ILLUSTRATION') cost = AI_COSTS.ILLUSTRATION;
    else if (materialType === 'PRESENTATION') cost = AI_COSTS.PRESENTATION;
    else if (materialType === 'LEARNING_PATH') cost = AI_COSTS.LEARNING_PATH;
    if (includeIllustration && materialType !== 'ILLUSTRATION') cost += AI_COSTS.ILLUSTRATION;

    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Оваа опција чини ${cost} кредити. Надградете на Pro пакет за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext, imageParam, studentProfilesToPass, tempActivityTitle } = built;
    const effectiveInstruction = buildEffectiveInstruction();
    const { questionTypes, numQuestions, differentiationLevel, generateAllLevels, exitTicketQuestions, exitTicketFocus, activityType, criteriaHints, activityFocus, scenarioTone, learningDesignModel } = state;

    setIsLoading(true);
    setGeneratedMaterial(null);
    variantHook.setVariants(null);

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
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за генерирање на сценарио');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за генерирање на сценарио');
            result = await geminiService.generateLessonPlanIdeas(
              finalContext.concepts || [], finalContext.topic, finalContext.grade.level,
              user ?? undefined, { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel }, effectiveInstruction,
            );
            (result as import('../types').AIGeneratedIdeas).generationContext = finalContext;
            break;
          case 'ASSESSMENT':
          case 'FLASHCARDS':
          case 'QUIZ':
            if (generateAllLevels && (materialType === 'ASSESSMENT' || materialType === 'QUIZ') && !studentProfilesToPass?.length) {
              const [standard, support, advanced] = await Promise.all([
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'standard', undefined, imageParam, effectiveInstruction, state.includeSelfAssessment, state.includeWorkedExamples),
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'support', undefined, imageParam, effectiveInstruction, false, false),
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'advanced', undefined, imageParam, effectiveInstruction, false, false),
              ]);
              result = {
                ...standard,
                differentiatedVersions: [
                  { profileName: 'Поддршка', questions: support.questions },
                  { profileName: 'Предизвик', questions: advanced.questions },
                ],
              };
            } else {
              result = await geminiService.generateAssessment(
                materialType, questionTypes, numQuestions, finalContext,
                user ?? undefined, differentiationLevel, studentProfilesToPass, imageParam, effectiveInstruction, state.includeSelfAssessment, state.includeWorkedExamples, state.dokTarget,
              );
            }
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
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за генерирање на рубрика');
            result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, activityType, criteriaHints, user ?? undefined, effectiveInstruction);
            break;
          case 'PRESENTATION':
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за генерирање на презентација');
            result = await geminiService.generatePresentation(
              finalContext.topic.title,
              finalContext.grade?.level ?? 1,
              finalContext.concepts?.map(c => c.title) || [],
              effectiveInstruction,
              user ?? undefined,
            );
            break;
          case 'VIDEO_EXTRACTOR':
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за Video Extractor');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за Video Extractor');
            if (!state.videoUrl.trim()) throw new ValidationError('Видео URL', 'внесете валиден YouTube/Vimeo линк');
            {
              const safeVideoUrl   = sanitizePromptInput(state.videoUrl, 300);
              const preview        = state.videoPreview;
              const rawTranscript  = state.videoTranscript;

              // Truncate transcript to fit safely in context (~6000 chars → ~1500 tokens)
              const safeTranscript = rawTranscript
                ? sanitizePromptInput(rawTranscript.slice(0, 6000), 6000)
                : null;

              const videoContext = [
                '=== ВИДЕО ИЗВОР ===',
                `URL: ${safeVideoUrl}`,
                preview?.title     ? `Наслов: ${sanitizePromptInput(preview.title, 180)}`       : '',
                preview?.authorName? `Канал:  ${sanitizePromptInput(preview.authorName, 120)}`  : '',
                safeTranscript
                  ? `\n=== ВИСТИНСКИ ТРАНСКРИПТ (извлечен од субтитли) ===\n${safeTranscript}\n=== КРАЈ НА ТРАНСКРИПТ ===\n\nИнструкција: анализирај го транскриптот погоре и извлечи ги математичките концепти, примери и чекори. Креирај детален план за час базиран на ВИСТИНСКАТА содржина на видеото.`
                  : '\nИнструкција: нема достапен транскрипт — извлечи наставни идеи врз основа на наслов и тема.',
              ].filter(Boolean).join('\n');

              const combinedInstruction = [effectiveInstruction, videoContext].filter(Boolean).join('\n\n');
              result = await geminiService.generateLessonPlanIdeas(
                finalContext.concepts || [],
                finalContext.topic,
                finalContext.grade.level,
                user ?? undefined,
                { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel },
                combinedInstruction,
              );
            }
            break;
        }
      }

      if (deductCredits && result) await deductCredits(cost);

      if (includeIllustration && result && materialType !== 'ILLUSTRATION') {
        try {
          const contextTitle = finalContext.concepts?.[0]?.title || finalContext.topic?.title || 'Математика';
          const gradeLevel = finalContext.grade?.level || 1;
          let illustrationPrompt = `Визуелен приказ за ${contextTitle} (${gradeLevel}. одд).`;
          if (materialType === 'SCENARIO') {
            illustrationPrompt = `Креативен визуелен приказ за наставен час по математика на тема "${contextTitle}" за ${gradeLevel}. одделение.`;
          } else if (materialType === 'ASSESSMENT' || materialType === 'QUIZ') {
            illustrationPrompt = `Илустрација за работен лист или квиз по математика за "${contextTitle}" (${gradeLevel}. одд).`;
          }
          const illRes = await geminiService.generateIllustration(illustrationPrompt, undefined, user ?? undefined);
          if (illRes?.imageUrl) (result as { illustrationUrl?: string }).illustrationUrl = illRes.imageUrl;
        } catch (illErr) {
          console.warn('Failed to generate contextual illustration:', illErr);
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
    variants: variantHook.variants,
    setVariants: variantHook.setVariants,
    isGeneratingVariants: variantHook.isGeneratingVariants,
    activeVariantTab: variantHook.activeVariantTab,
    setActiveVariantTab: variantHook.setActiveVariantTab,
    assignTarget,
    setAssignTarget,
    savedToLibrary,
    isPro,
    saveIsPublic,
    setSaveIsPublic,
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
    handleGenerateVariants: variantHook.handleGenerateVariants,
    handleBulkGenerate,
    handleCancel,
    handleReset,
    handleSaveAsNote,
    handleSaveTeacherNote,
    handleSaveQuestion,
    handleSaveToLibrary,
    handleSavePackage,
    handleMaterialRate,
    handleGenerateFromBank,
    handleClearQuota,
  };
}
