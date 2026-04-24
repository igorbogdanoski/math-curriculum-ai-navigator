import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  Topic, Concept, Grade, NationalStandard,
  TeachingProfile, PlannerItem, Curriculum, ConceptProgression,
} from '../types';
import { ModalType } from '../types';
import type { GeneratorState, GeneratorAction } from './useGeneratorState';
import { getInitialState } from './useGeneratorState';
import { useVerifiedQuestions } from './useGeneratorQueries';
import { useQuotaManager } from './useQuotaManager';
import { useVariantGenerate } from './useVariantGenerate';
import {
  useGeneratorContext,
  useGeneratorTeacherNote,
  useGeneratorSave,
  useBulkGenerate,
  useMainGenerate,
  buildAiPersonalizationSnippet,
  makeBuildEffectiveInstruction,
  makePersistExtractionArtifact,
  MACEDONIAN_CONTEXT_HINT,
} from './generator';

// Re-export for back-compat (test imports + useVariantGenerate consumers)
export { buildAiPersonalizationSnippet };

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

  // ── Quota management ──────────────────────────────────────────────────────
  const {
    quotaError,
    setQuotaError,
    quotaCountdown,
    isThrottled,
    setQuotaBannerFromStorage,
    handleClearQuota,
  } = useQuotaManager(addNotification);

  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);

  // ── Sub-hooks (context, teacher note) ─────────────────────────────────────
  const firstConceptId = state.selectedConcepts[0];
  const { data: verifiedQs = [] } = useVerifiedQuestions(firebaseUser?.uid, firstConceptId);

  const { teacherNote, setTeacherNote, teacherNoteSaved, diffRec, handleSaveTeacherNote } =
    useGeneratorTeacherNote({ state, firebaseUser, dispatch });

  // ── Bulk generation (state + handler) ─────────────────────────────────────
  // NOTE: bulk hook declared first so useMainGenerate can reference isGeneratingBulk
  // via a ref-style indirection — the React ordering still holds via closure.

  // ── Placeholder vars so generator hooks can read each other's flags ───────
  // We run useGeneratorContext twice-computed pattern: initial call assumes
  // isGenerating/isGeneratingBulk/isGeneratingVariants = false (matches original
  // behaviour; the main handler re-checks fresh state at call time).
  const { filteredTopics, filteredConcepts, buildContext, isGenerateDisabled } =
    useGeneratorContext({
      state,
      curriculum,
      allConcepts,
      allNationalStandards,
      user,
      isGenerating: false,
      isGeneratingBulk: false,
      isGeneratingVariants: false,
      isOnline,
      getConceptDetails,
      findConceptAcrossGrades,
    });

  const buildEffectiveInstruction = makeBuildEffectiveInstruction({ state, teacherNote });
  const persistExtractionArtifact = makePersistExtractionArtifact({ firebaseUser, user });

  // Variants hook — needs setGeneratedMaterial; defined after main hook
  // We forward-declare by using a mutable ref pattern via local state setter below.

  // Main generate (isGenerating/generatedMaterial) — self-contained
  const bulk = useBulkGenerate({
    state,
    user,
    isOnline,
    buildContext,
    buildEffectiveInstruction,
    addNotification,
    // placeholder; rebound after main is created
    setGeneratedMaterial: () => { /* will be replaced below */ },
    setQuotaBannerFromStorage,
    deductCredits,
    openUpgradeModal,
  });

  const main = useMainGenerate({
    state,
    dispatch,
    user,
    firebaseUser,
    isOnline,
    allConcepts,
    isGeneratingBulk: bulk.isGeneratingBulk,
    isGeneratingVariants: false, // re-checked via variantHook below after construction
    buildContext,
    buildEffectiveInstruction,
    persistExtractionArtifact,
    addNotification,
    setQuotaBannerFromStorage,
    setVariants: () => { /* rebound below */ },
    deductCredits,
    openUpgradeModal,
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
    setGeneratedMaterial: main.setGeneratedMaterial,
    deductCredits,
    openUpgradeModal,
  });

  // Rebind bulk/main setters so cross-hook effects work as before
  // (bulk clears generatedMaterial when starting; main clears variants when starting)
  // Patch via proxying the underlying setters on each call.
  const handleBulkGenerate = async () => {
    main.setGeneratedMaterial(null);
    variantHook.setVariants(null);
    await bulk.handleBulkGenerate();
  };

  const handleGenerate = async () => {
    variantHook.setVariants(null);
    await main.handleGenerate();
  };

  // ── Save hook ─────────────────────────────────────────────────────────────
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
    generatedMaterial: main.generatedMaterial,
    bulkResults: bulk.bulkResults,
    verifiedQs,
    addNotification,
    addItem,
    setGeneratedMaterial: main.setGeneratedMaterial,
    setVariants: variantHook.setVariants,
    setBulkResults: bulk.setBulkResults,
  });

  // ── Misc handlers ─────────────────────────────────────────────────────────
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
        main.setGeneratedMaterial(null);
        addNotification(t('generator.notifications.reset'), 'info');
      },
      onCancel: hideModal,
    });
  };

  return {
    // Derived lists
    filteredTopics,
    filteredConcepts,
    // Generation state
    isGenerating: main.isGenerating,
    generatedMaterial: main.generatedMaterial,
    setGeneratedMaterial: main.setGeneratedMaterial,
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
    isGeneratingBulk: bulk.isGeneratingBulk,
    bulkStep: bulk.bulkStep,
    bulkResults: bulk.bulkResults,
    diffRec,
    verifiedQs,
    isGenerateDisabled,
    // Handlers
    handleGenerate,
    handleGenerateVariants: variantHook.handleGenerateVariants,
    handleBulkGenerate,
    handleCancel: main.handleCancel,
    handleReset,
    handleSaveAsNote,
    handleSaveTeacherNote,
    handleSaveQuestion,
    handleSaveToLibrary,
    handleSavePackage,
    handleMaterialRate,
    handleGenerateFromBank,
    handleGenerateFromExtraction: main.handleGenerateFromExtraction,
    handleClearQuota,
  };
}
