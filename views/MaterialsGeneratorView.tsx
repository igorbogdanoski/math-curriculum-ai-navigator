import { logger } from '../utils/logger';
import { useTour } from '../hooks/useTour';
import { useGeneratorActions } from '../hooks/useGeneratorActions';

import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { MathToolsPanel } from '../components/common/MathToolsPanel';
import { ICONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { clearDailyQuotaFlag } from '../services/geminiService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { X } from 'lucide-react';
import { app } from '../firebaseConfig';
import type { MaterialType, NationalStandard, Concept, Grade } from '../types';
import { firestoreService } from '../services/firestoreService';
import { trackCreditConsumed } from '../services/telemetryService';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePlanner } from '../contexts/PlannerContext';
import { AssignDialog } from '../components/AssignDialog';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { generatorTourSteps } from '../tours/tour-steps';
import { useModal } from '../contexts/ModalContext';
import { useGeneratorState, type GeneratorState } from '../hooks/useGeneratorState';
import { GenerationContextForm } from '../components/generator/GenerationContextForm';
import { MaterialOptions } from '../components/generator/MaterialOptions';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import {
  MaterialTypeStep,
  loadRecentTypes,
  saveRecentType,
  type MaterialOption,
} from '../components/generator/MaterialTypeStep';
import { WizardAdvancedFields } from '../components/generator/WizardAdvancedFields';
import { GeneratorActionBar } from '../components/generator/GeneratorActionBar';
import { GeneratorResultPanel } from '../components/generator/GeneratorResultPanel';

export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props: Partial<GeneratorState>) => {
  const { t } = useLanguage();
  const materialOptions: MaterialOption[] = [
    { id: 'SCENARIO', label: t('generator.types.scenario'), icon: 'lightbulb' },
    { id: 'LEARNING_PATH', label: t('generator.types.path'), icon: 'mindmap' },
    { id: 'PRESENTATION', label: 'Презентација (PRO)', icon: 'gallery' },
    { id: 'ASSESSMENT', label: t('generator.types.assessment'), icon: 'generator' },
    { id: 'RUBRIC', label: t('generator.types.rubric'), icon: 'edit' },
    { id: 'FLASHCARDS', label: t('generator.types.flashcards'), icon: 'flashcards' },
    { id: 'QUIZ', label: t('generator.types.quiz'), icon: 'quiz' },
    { id: 'EXIT_TICKET', label: t('generator.types.exitTicket'), icon: 'quiz' },
    { id: 'ILLUSTRATION', label: t('generator.types.illustration'), icon: 'gallery' },
    { id: 'VIDEO_EXTRACTOR', label: 'Video Extractor (MVP)', icon: 'gallery' },
    { id: 'IMAGE_EXTRACTOR', label: 'Image Extractor (НОВО)', icon: 'gallery' },
    { id: 'WEB_EXTRACTOR', label: 'Web Extractor (НОВО)', icon: 'gallery' },
    { id: 'WORKED_EXAMPLE', label: 'Работен Пример', icon: 'lightbulb' },
  ];

    const { curriculum, allConcepts, allNationalStandards, isLoading: isCurriculumLoading, getConceptDetails, findConceptAcrossGrades } = useCurriculum();
    const { user, firebaseUser, updateLocalProfile } = useAuth();

    const requirePremiumOrCredits = (action: () => void, costMultiplier = 1, isPremiumOnly = false, featureName = "") => {
        if (user?.role === 'admin' || user?.isPremium || user?.hasUnlimitedCredits) {
            action();
            return;
        }

        if (isPremiumOnly) {
             window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { reason: `"${featureName}" е Premium функционалност. Надградете за да ја отклучите!` }}));
             return;
        }

        const currentCredits = user?.aiCreditsBalance || 0;
        if (currentCredits >= costMultiplier) {
            action();
        } else {
             window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { reason: 'Останавте без AI кредити! Надградете на Pro пакет за неограничено генерирање.' }}));
        }
    };

    const deductCredits = async (amount = 1) => {
        if (!user || user.role === 'admin' || user.isPremium || user.hasUnlimitedCredits) return;
        const originalBalance = user.aiCreditsBalance || 0;
        const newBalance = Math.max(0, originalBalance - amount);
        try {
            updateLocalProfile({ aiCreditsBalance: newBalance });

            const functions = getFunctions(app);
            const deductFn = httpsCallable(functions, 'deductCredits');
            await deductFn({ amount });

            trackCreditConsumed({
                uid: firebaseUser?.uid,
                amount,
                previousBalance: originalBalance,
                newBalance,
                reason: 'materials_generator',
            });
        } catch (err) {
            logger.error("Failed to deduct credits remotely", err);
            updateLocalProfile({ aiCreditsBalance: originalBalance });
        }
    };

    const { addNotification } = useNotification();
    const { addItem } = usePlanner();
    const handleTourStep = React.useCallback((el: HTMLElement) => {
        const step = el.getAttribute('data-tour');
        if (step === 'generator-step-1') setCurrentStep(1);
        else if (step === 'generator-step-2') setCurrentStep(2);
        else if (step === 'generator-step-3' || step === 'generator-generate-button') setCurrentStep(3);
    }, []);
    useTour('generator', generatorTourSteps, !!generatorTourSteps && !isCurriculumLoading, handleTourStep);
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const { isOnline } = useNetworkStatus();
    const { showModal, hideModal } = useModal();

    const [state, dispatch] = useGeneratorState(props);
    const { contextType, selectedConcepts, selectedStandard } = state;

    // Pre-fill from ExtractionHub: reads generator_extraction_context once on mount
    useEffect(() => {
      try {
        const raw = sessionStorage.getItem('generator_extraction_context');
        if (!raw) return;
        sessionStorage.removeItem('generator_extraction_context');
        const payload = JSON.parse(raw) as { contextType?: string; scenarioText?: string };
        if (payload.contextType === 'SCENARIO' && payload.scenarioText) {
          dispatch({ type: 'SET_FIELD', payload: { field: 'contextType', value: 'SCENARIO' } });
          dispatch({ type: 'SET_FIELD', payload: { field: 'scenarioText', value: payload.scenarioText } });
          setCurrentStep(2);
        }
      } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Wizard step state
    const [currentStep, setCurrentStep] = useState(1);
    const [showMathTools, setShowMathTools] = useState(false);
    const [recentTypes, setRecentTypes] = useState<MaterialType[]>(() => loadRecentTypes());

    const handleSelectMaterialType = React.useCallback((type: MaterialType) => {
      dispatch({ type: 'SET_FIELD', payload: { field: 'materialType', value: type } });
      saveRecentType(type);
      setRecentTypes(loadRecentTypes());
      setTimeout(() => setCurrentStep(2), 200);
    }, [dispatch]);

    const handleSmartStart = React.useCallback((result: { materialType: MaterialType; grade: number | null; topicHint: string | null }) => {
      handleSelectMaterialType(result.materialType);
    }, [handleSelectMaterialType]);

    const {
        filteredTopics,
        filteredConcepts,
        isGenerating,
        generatedMaterial,
        setGeneratedMaterial,
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
        handleGenerate,
        handleGenerateVariants,
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
        handleGenerateFromExtraction,
        handleClearQuota,
    } = useGeneratorActions({
        state,
        dispatch,
        curriculum: curriculum!,
        allConcepts,
        allNationalStandards,
        user,
        firebaseUser,
        isOnline,
        addNotification,
        addItem,
        deductCredits,

        showModal,
        hideModal,
        getConceptDetails,
        findConceptAcrossGrades,
        openUpgradeModal: (reason: string) => window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { reason } })),
    });

    // Collect relevant national standards for the current selection — shown below generated material
    const relevantStandards = useMemo((): NationalStandard[] => {
        if (!allNationalStandards) return [];
        if (contextType === 'STANDARD' && selectedStandard) {
            return allNationalStandards.filter((s: NationalStandard) => s.id === selectedStandard);
        }
        if (selectedConcepts.length === 0) return [];
        const conceptObjs = filteredConcepts.filter((c: Concept) => selectedConcepts.includes(c.id));
        const standardIds = new Set(conceptObjs.flatMap((c: Concept) => c.nationalStandardIds || []));
        return allNationalStandards.filter((s: NationalStandard) => standardIds.has(s.id));
    }, [allNationalStandards, contextType, selectedStandard, selectedConcepts, filteredConcepts]);


    if (isCurriculumLoading) {
         return (
            <div className="p-4 md:p-6">
                <SkeletonLoader type="paragraph" />
            </div>
        );
    }

    if (!curriculum || !allNationalStandards) {
        return <div className="p-4 md:p-6 text-center text-red-500">Податоците за наставната програма не можеа да се вчитаат.</div>
    }

    return (
        <>
        <div className="p-4 md:p-6 h-full flex flex-col xl:flex-row gap-6 relative xl:overflow-hidden bg-gray-50 overflow-y-auto">
            {/* LEFT SIDE: Generator Form */}
            <div className="w-full xl:w-[500px] 2xl:w-[560px] flex-shrink-0 flex flex-col xl:overflow-y-auto pb-12 xl:pr-4 custom-scrollbar">

            {/* Inline quota exhaustion banner — persistent, shows countdown */}
            {quotaError && (
                <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50">
                    <span className="text-xl flex-shrink-0">⛔</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-orange-800">AI квотата е исцрпена за денес</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                            {quotaError.exhaustedAt && <span>Исцрпена во <strong>{quotaError.exhaustedAt}</strong>. </span>}
                            Генерирањето ќе биде достапно во <strong>09:00 МК</strong>
                            {quotaCountdown ? ` — уште ${quotaCountdown}` : ''}.
                        </p>
                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                            <a
                                href="#/my-lessons"
                                className="text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1 rounded-lg transition"
                            >
                                📁 Прегледај Мои Подготовки →
                            </a>
                            <button
                                type="button"
                                onClick={() => { clearDailyQuotaFlag(); setQuotaError(null); addNotification('Квота флагот е ресетиран. Обидете се со генерирање.', 'success'); }}
                                className="text-xs text-orange-500 underline hover:text-orange-700 transition"
                            >
                                Ресетирај рачно ако е грешка
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setQuotaError(null)}
                        className="flex-shrink-0 text-orange-400 hover:text-orange-600 transition"
                        aria-label="Затвори"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            {/* Stepper UI */}
            <div className="mb-6 w-full px-2 relative flex items-center justify-between">
                <div className="absolute left-[15%] right-[15%] top-5 h-[2px] bg-gray-200 -z-10">
                    <div className="h-full bg-brand-primary transition-all duration-300 ease-in-out" style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>
                </div>

                {[
                    { step: 1, label: 'Тип материјал', icon: '📝' },
                    { step: 2, label: 'Наставна тема', icon: '🎯' },
                    { step: 3, label: 'Опции & Генерирање', icon: '⚙️' }
                ].map((s) => (
                    <div key={s.step} className="flex flex-col items-center gap-1.5 w-1/3 text-center">
                        <button
                            type="button"
                            onClick={() => setCurrentStep(s.step)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 z-10
                                ${currentStep === s.step
                                    ? 'bg-brand-primary border-brand-primary bg-white text-white shadow-[0_0_15px_rgba(43,108,176,0.3)] scale-110'
                                    : currentStep > s.step
                                        ? 'bg-brand-primary border-brand-primary text-white'
                                        : 'bg-white border-gray-200 text-gray-400'
                                }`}
                        >
                            {currentStep > s.step ? <ICONS.check className="w-5 h-5 text-white" /> : s.step}
                        </button>
                        <span className={`text-[10px] sm:text-xs font-bold transition-colors leading-tight ${currentStep === s.step ? 'text-brand-primary' : 'text-gray-500'}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            <Card className="min-h-[400px] flex flex-col">
                <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleGenerate(); }} className="flex-1 flex flex-col">
                    <fieldset disabled={isGenerating} className="flex-1">

                        {/* STEP 1: Material Type */}
                        <MaterialTypeStep
                            visible={currentStep === 1}
                            materialType={state.materialType}
                            materialOptions={materialOptions}
                            recentTypes={recentTypes}
                            onSelect={handleSelectMaterialType}
                            onSmartStartAccept={handleSmartStart}
                        />

                        {/* STEP 2: Context */}
                        <div className={`transition-opacity duration-300 ${currentStep === 2 ? 'block animate-fade-in' : 'hidden'}`}>
                            <div className="py-2 border-b border-gray-100 mb-6 flex items-center gap-3">
                                <span className="bg-brand-primary text-white text-xl w-8 h-8 rounded-full flex items-center justify-center font-bold">2</span>
                                <h2 className="text-xl font-bold text-gray-800">За што генерираме?</h2>
                            </div>
                            <GenerationContextForm state={state} dispatch={dispatch} />
                        </div>

                        {/* STEP 3: Options & Generate */}
                        <div data-tour="generator-step-3" className={`transition-opacity duration-300 ${currentStep === 3 ? 'block animate-fade-in' : 'hidden'}`}>
                            <div className="py-2 border-b border-gray-100 mb-6 flex items-center gap-3">
                                <span className="bg-brand-primary text-white text-xl w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
                                <h2 className="text-xl font-bold text-gray-800">Опции и Детали</h2>
                            </div>
                            <MaterialOptions state={state} dispatch={dispatch} user={user} />
                            <WizardAdvancedFields
                                state={state}
                                dispatch={dispatch}
                                teacherNote={teacherNote}
                                setTeacherNote={setTeacherNote}
                                teacherNoteSaved={teacherNoteSaved}
                                onSaveTeacherNote={handleSaveTeacherNote}
                            />
                        </div>
                    </fieldset>

                    {/* Navigation Buttons */}
                    <GeneratorActionBar
                        currentStep={currentStep}
                        setCurrentStep={setCurrentStep}
                        materialType={state.materialType}
                        isGenerateDisabled={isGenerateDisabled}
                        isGenerating={isGenerating}
                        isGeneratingVariants={isGeneratingVariants}
                        isGeneratingBulk={isGeneratingBulk}
                        isOnline={isOnline}
                        verifiedCount={verifiedQs.length}
                        requirePremiumOrCredits={requirePremiumOrCredits}
                        onGenerateVariants={handleGenerateVariants}
                        onBulkGenerate={handleBulkGenerate}
                        onGenerateFromBank={handleGenerateFromBank}
                    />
                </form>
            </Card>
            </div>

            {/* RIGHT SIDE: Preview Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 xl:overflow-y-auto min-h-[500px] xl:min-h-0 flex flex-col p-4 xl:p-8 custom-scrollbar">
                <GeneratorResultPanel
                    state={state}
                    curriculum={curriculum}
                    relevantStandards={relevantStandards}
                    isGenerating={isGenerating}
                    isGeneratingVariants={isGeneratingVariants}
                    isGeneratingBulk={isGeneratingBulk}
                    bulkStep={bulkStep}
                    bulkResults={bulkResults}
                    generatedMaterial={generatedMaterial}
                    setGeneratedMaterial={setGeneratedMaterial}
                    variants={variants}
                    activeVariantTab={activeVariantTab}
                    setActiveVariantTab={setActiveVariantTab}
                    savedToLibrary={savedToLibrary}
                    isPro={isPro}
                    saveIsPublic={saveIsPublic}
                    setSaveIsPublic={setSaveIsPublic}
                    setAssignTarget={setAssignTarget}
                    handleCancel={handleCancel}
                    handleSaveAsNote={handleSaveAsNote}
                    handleSaveQuestion={handleSaveQuestion}
                    handleSaveToLibrary={handleSaveToLibrary}
                    handleSavePackage={handleSavePackage}
                    handleMaterialRate={handleMaterialRate}
                    handleGenerateFromExtraction={handleGenerateFromExtraction}
                />
            </div>
        </div>

        {assignTarget && (
            <AssignDialog
                material={assignTarget}
                materialType={(state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') ? state.materialType : 'QUIZ'}
                conceptId={state.selectedConcepts[0]}
                gradeLevel={curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level}
                onClose={() => setAssignTarget(null)}
            />
        )}
        {showMathTools && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] md:h-[80vh] relative flex flex-col overflow-hidden border border-gray-200 mt-4 md:mt-0">
                    <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center justify-center gap-2"><ICONS.math className="w-5 h-5" />Математички Алатки</h3>
                        <button type="button" aria-label="Затвори математички алатки" onClick={() => setShowMathTools(false)} className="text-gray-500 hover:text-red-500 bg-white border p-1 rounded-md transition-colors"><ICONS.close className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 relative overflow-hidden bg-slate-50">
                        <MathToolsPanel onClose={() => setShowMathTools(false)} className="h-full" />
                    </div>
                </div>
            </div>
        )}
        <button onClick={() => setShowMathTools(true)} className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all z-40 flex items-center justify-center group no-print hover:scale-110 active:scale-95" title="Математички Алатки (GeoGebra, Desmos...)">
            <ICONS.math className="w-6 h-6 group-hover:animate-pulse" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap pl-0 group-hover:pl-2 font-black tracking-wide text-sm">Алатки</span>
        </button>
        </>
    );
};
