import { logger } from '../utils/logger';
import { useTour } from '../hooks/useTour';
import { useGeneratorActions } from '../hooks/useGeneratorActions';

import React, { useState, useMemo, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';

// Local error boundary — catches render errors in result components without crashing the whole panel
class ResultErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidCatch(error: Error, info: ErrorInfo) { logger.error('[ResultErrorBoundary]', error, info); }
    render() {
        if (this.state.error) {
            return (
                <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <p className="font-bold mb-1">⚠️ Грешка при прикажување на резултатот</p>
                    <p className="text-xs text-red-500 mb-3">{(this.state.error as Error).message}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => this.setState({ error: null })}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                        >
                            ↺ Обиди се повторно
                        </button>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
                        >
                            ⟳ Освежи страна
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
import { X, ClipboardList, BookmarkPlus, CheckCircle, ShieldCheck, Globe, Lock } from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { MathToolsPanel } from '../components/common/MathToolsPanel';
import { ICONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { geminiService, isDailyQuotaKnownExhausted, clearDailyQuotaFlag } from '../services/geminiService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';
import { RateLimitError } from '../services/apiErrors';
import type { AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric, GenerationContext, Topic, Concept, Grade, NationalStandard, StudentProfile, AIGeneratedIllustration, AIGeneratedLearningPaths, MaterialType, DifferentiationLevel, AssessmentQuestion, AIGeneratedWorkedExample, DokLevel } from '../types';
import { DOK_META } from '../types';
import { ModalType, PlannerItemType, QuestionType } from '../types';
import { firestoreService } from '../services/firestoreService';
import { trackCreditConsumed, trackFirstTimeEvent, trackEvent } from '../services/telemetryService';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { AILoadingIndicator } from '../components/common/AILoadingIndicator';
import { useAuth } from '../contexts/AuthContext';
import { EmptyState } from '../components/common/EmptyState';
import { useNotification } from '../contexts/NotificationContext';
import { GeneratedIllustration } from '../components/ai/GeneratedIllustration';
import { GeneratedIdeas } from '../components/ai/GeneratedIdeas';
import { GeneratedAssessment } from '../components/ai/GeneratedAssessment';
import { GeneratedRubric } from '../components/ai/GeneratedRubric';
import { usePlanner } from '../contexts/PlannerContext';
import { GeneratedLearningPaths } from '../components/ai/GeneratedLearningPaths';
import { GeneratedPresentation } from '../components/ai/GeneratedPresentation';
import { WorkedExample } from '../components/materials/WorkedExample';
import { BloomSliders } from '../components/generator/BloomSliders';
import { DokDistributionBar } from '../components/common/DokBadge';
import { StatisticsWorkspace } from '../components/data/StatisticsWorkspace';
import { RefineGenerationChat } from '../components/generator/RefineGenerationChat';
import { AIFeedbackBar } from '../components/ai/AIFeedbackBar';
import { AssignDialog } from '../components/AssignDialog';
import { QuizShareButton } from '../components/common/QuizShareButton';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { generatorTourSteps } from '../tours/tour-steps';
import { useModal } from '../contexts/ModalContext';
import { useGeneratorState, type GeneratorState, getInitialState } from '../hooks/useGeneratorState';
import { GenerationContextForm } from '../components/generator/GenerationContextForm';
import { MaterialOptions } from '../components/generator/MaterialOptions';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { SmartStart } from '../components/generator/SmartStart';







// ── Material metadata: descriptions, tags, time estimates ───────────────────
const MATERIAL_META: Record<string, {
  emoji: string;
  description: string;
  timeEst: string;
  tags: string[];
  badge?: string;
  badgeColor?: string;
}> = {
  SCENARIO:      { emoji: '🎭', description: 'Целосен план за наставен час со активности, прашања и диференцијација по Блум', timeEst: '45 мин', tags: ['Подготовка', 'Целосен час'] },
  LEARNING_PATH: { emoji: '🗺️', description: 'Персонализирана патека низ концепти прилагодена на нивото на ученикот', timeEst: '1 недела', tags: ['Диференцирано', 'Патека'] },
  PRESENTATION:  { emoji: '📽️', description: 'Структурирани слајдови со содржина, активности и AI генерирани елементи', timeEst: '~10 мин', tags: ['Слајдови', 'Визуелно'], badge: 'PRO', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200' },
  ASSESSMENT:    { emoji: '📄', description: 'Формален тест или писмена работа за печатење или дигитална употреба', timeEst: '20–45 мин', tags: ['Формален', 'Печатење'] },
  RUBRIC:        { emoji: '📊', description: 'Критериуми за оценување со нивоа и дескриптори усогласени со МОН', timeEst: '~5 мин', tags: ['Оценување', 'МОН'] },
  FLASHCARDS:    { emoji: '🃏', description: 'Картички за меморирање — прашање на едната, одговор на другата страна', timeEst: '~15 мин', tags: ['Повторување', 'Домашно'] },
  QUIZ:          { emoji: '❓', description: 'Интерактивен квиз — учениците играат на нивните уреди во реално време', timeEst: '~10 мин', tags: ['Интерактивно', '📱 Ученици'], badge: 'ПОПУЛАРНО', badgeColor: 'bg-green-100 text-green-700 border-green-200' },
  EXIT_TICKET:   { emoji: '🎟️', description: '2–3 брзи прашања за проверка на разбирањето пред крај на часот', timeEst: '~3 мин', tags: ['⚡ Брзо', 'Крај на час'], badge: 'БРЗО', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200' },
  ILLUSTRATION:  { emoji: '🖼️', description: 'AI генерирана слика или дијаграм за визуелно претставување на концепт', timeEst: '~2 мин', tags: ['Визуелно', 'Презентација'] },
    VIDEO_EXTRACTOR:{ emoji: '🎬', description: 'Внеси видео URL, потврди preview и генерирај наставно сценарио од содржината', timeEst: '~3 мин', tags: ['URL', 'Preview', 'MVP'], badge: 'MVP', badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  IMAGE_EXTRACTOR:{ emoji: '📸', description: 'Прикачи слика од учебник, табла или ракопис — AI ги извлекува задачите и генерира наставен план', timeEst: '~2 мин', tags: ['Vision', 'Слика'], badge: 'НОВО', badgeColor: 'bg-violet-100 text-violet-700 border-violet-200' },
  WEB_EXTRACTOR:  { emoji: '🌐', description: 'Внеси URL на математичка страна — AI ја чита, анализира и генерира наставен материјал', timeEst: '~3 мин', tags: ['URL', 'Веб'], badge: 'НОВО', badgeColor: 'bg-teal-100 text-teal-700 border-teal-200' },
  WORKED_EXAMPLE:{ emoji: '✍️', description: 'Детален чекор-по-чекор решен пример со образложение за секој чекор', timeEst: '~5 мин', tags: ['Пример', 'Моделирање'], badge: 'НОВО', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const RECENT_TYPES_KEY = 'generator_recent_types';

function loadRecentTypes(): MaterialType[] {
  try {
    const raw = localStorage.getItem(RECENT_TYPES_KEY);
    return raw ? (JSON.parse(raw) as MaterialType[]) : [];
  } catch { return []; }
}

function saveRecentType(type: MaterialType): void {
  try {
    const existing = loadRecentTypes().filter(t => t !== type);
    localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify([type, ...existing].slice(0, 5)));
  } catch { /* ignore */ }
}
// ─────────────────────────────────────────────────────────────────────────────

export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props: Partial<GeneratorState>) => {
  const { t } = useLanguage();
  const materialOptions: { id: MaterialType; label: string; icon: keyof typeof ICONS }[] = [
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
    { id: 'WORKED_EXAMPLE', label: 'Работен Пример', icon: 'lightbulb' }
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
            // Optimistically update the UI so it doesn't block the user
            updateLocalProfile({ aiCreditsBalance: newBalance });

            // Securely deduct on the server using Cloud Function
            const functions = getFunctions(app);
            const deductFn = httpsCallable(functions, 'deductCredits');
            await deductFn({ amount });

            // S39-F2: telemetry — credit_consumed (+ quota_warning_seen on threshold cross)
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
    const { materialType, contextType, selectedGrade, selectedTopic, selectedConcepts, selectedStandard } = state;

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
                {/* Connecting Line */}
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
                        <div data-tour="generator-step-1" className={`transition-opacity duration-300 ${currentStep === 1 ? 'block animate-fade-in' : 'hidden'}`}>
                            <div className="py-2 border-b border-gray-100 mb-4 flex items-center gap-3">
                                <span className="bg-brand-primary text-white text-xl w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
                                <h2 className="text-xl font-bold text-gray-800">Изберете тип на материјал</h2>
                            </div>

                            {/* SmartStart — AI intent detection */}
                            <SmartStart onAccept={handleSmartStart} />

                            {/* Recently used — quick shortcuts */}
                            {recentTypes.length > 0 && (
                              <div className="mb-4">
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Последно користено</p>
                                <div className="flex flex-wrap gap-2">
                                  {recentTypes.slice(0, 3).map(typeId => {
                                    const meta = MATERIAL_META[typeId];
                                    const opt = materialOptions.find(o => o.id === typeId);
                                    if (!meta || !opt) return null;
                                    return (
                                      <button
                                        type="button"
                                        key={typeId}
                                        onClick={() => handleSelectMaterialType(typeId)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:border-brand-primary hover:text-brand-primary hover:bg-blue-50 transition-all shadow-sm"
                                      >
                                        <span>{meta.emoji}</span>
                                        <span>{opt.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Rich material type cards */}
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Сите типови</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {materialOptions.map(({ id, label }) => {
                                    const meta = MATERIAL_META[id];
                                    const isActive = materialType === id;
                                    return (
                                        <button
                                            type="button"
                                            key={id}
                                            onClick={() => handleSelectMaterialType(id)}
                                            className={`relative text-left p-3.5 rounded-xl border-2 transition-all focus:outline-none group
                                                ${isActive
                                                    ? 'bg-blue-50 border-brand-primary shadow-md scale-[1.01]'
                                                    : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm'
                                                }`}
                                        >
                                            {/* Badge */}
                                            {meta?.badge && (
                                              <span className={`absolute top-2.5 right-2.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${meta.badgeColor ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {meta.badge}
                                              </span>
                                            )}
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl flex-shrink-0 mt-0.5">{meta?.emoji ?? '📄'}</span>
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className={`font-bold text-sm leading-tight ${isActive ? 'text-brand-primary' : 'text-gray-800'}`}>{label}</p>
                                                    {meta?.description && (
                                                      <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{meta.description}</p>
                                                    )}
                                                    {/* Tags + time */}
                                                    <div className="flex flex-wrap items-center gap-1 mt-2">
                                                      {meta?.timeEst && (
                                                        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">⏱ {meta.timeEst}</span>
                                                      )}
                                                      {meta?.tags.slice(0, 2).map(tag => (
                                                        <span key={tag} className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">{tag}</span>
                                                      ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

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

                            {/* П7: Bloom's Taxonomy слајдери — само за QUIZ и ASSESSMENT */}
                            {(state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') && (
                              <BloomSliders
                                value={state.bloomDistribution}
                                onChange={(dist) => dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: dist } })}
                              />
                            )}

                            {/* Webb's DoK target — само за QUIZ и ASSESSMENT */}
                            {(state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') && (
                              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                                <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Webb's Depth of Knowledge (DoK)</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {/* Auto option */}
                                  <button
                                    type="button"
                                    onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: undefined } })}
                                    className={`col-span-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      state.dokTarget === undefined
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                    }`}
                                  >
                                    Авто (AI одлучува)
                                  </button>
                                  {/* Mixed option */}
                                  <button
                                    type="button"
                                    onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: 'mixed' } })}
                                    className={`col-span-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      state.dokTarget === 'mixed'
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                                    }`}
                                  >
                                    🎯 Мешана распределба (DoK 1→4)
                                  </button>
                                  {/* Specific DoK levels */}
                                  {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
                                    const m = DOK_META[lvl];
                                    const active = state.dokTarget === lvl;
                                    return (
                                      <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: lvl } })}
                                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-bold border transition-all ${
                                          active ? `${m.color} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                        }`}
                                      >
                                        <span className={`w-2.5 h-2.5 rounded-full ${active ? m.dot : 'bg-gray-300'}`} />
                                        {m.label}
                                        <span className="font-normal opacity-70 text-center leading-none">{m.mk}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Legacy Differentiation section removed as it's now inside MaterialOptions Advanced */}

                            {/* Г3-alt: Teacher note for selected concept */}
                            {state.contextType === 'CONCEPT' && state.selectedConcepts[0] && (
                                <div className="mt-6 border-t pt-6">
                                    <label htmlFor="teacherNote" className="block text-sm font-bold text-gray-700 mb-2">
                                        <div className="flex items-center gap-2">
                                            <ICONS.edit className="w-4 h-4 text-indigo-500" />
                                            Мои белешки за концептот
                                            <span className="text-xs font-normal text-gray-400">(се injection-ираат во AI при генерирање)</span>
                                        </div>
                                    </label>
                                    <textarea
                                        id="teacherNote"
                                        value={teacherNote}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTeacherNote(e.target.value)}
                                        rows={3}
                                        className="block w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white resize-none text-sm"
                                        placeholder="Пр. 'Учениците имаат тешкотии со именките во множина. Фокусирај се на практични примери со пари и мерки.'"
                                    />
                                    <div className="flex justify-end mt-1.5">
                                        <button
                                            type="button"
                                            onClick={handleSaveTeacherNote}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${teacherNoteSaved ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                                        >
                                            {teacherNoteSaved ? '✓ Зачувано' : 'Зачувај белешка'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* AI Персонализација */}
                            <div className="mt-6 border-t pt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <ICONS.sparkles className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm font-bold text-gray-700">AI Персонализација</span>
                                    <span className="text-xs text-gray-400">(прилагоди го стилот на генерирањето)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label htmlFor="aiTone" className="block text-xs font-semibold text-gray-600 mb-1.5">Тон</label>
                                        <select
                                            id="aiTone"
                                            value={state.aiTone}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiTone', value: e.target.value } })}
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
                                        >
                                            <option value="creative">🎨 Креативен</option>
                                            <option value="formal">📐 Формален</option>
                                            <option value="friendly">😊 Пријателски</option>
                                            <option value="expert">🔬 Стручен</option>
                                            <option value="playful">🎮 Игровен</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="aiVocabLevel" className="block text-xs font-semibold text-gray-600 mb-1.5">Ниво на речник</label>
                                        <select
                                            id="aiVocabLevel"
                                            value={state.aiVocabLevel}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiVocabLevel', value: e.target.value } })}
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
                                        >
                                            <option value="simplified">📗 Поедноставен</option>
                                            <option value="standard">📘 Стандарден</option>
                                            <option value="advanced">📙 Напреден</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="aiStyle" className="block text-xs font-semibold text-gray-600 mb-1.5">Образовен стил</label>
                                        <select
                                            id="aiStyle"
                                            value={state.aiStyle}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiStyle', value: e.target.value } })}
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
                                        >
                                            <option value="standard">📋 Стандарден</option>
                                            <option value="socratic">🤔 Сократски</option>
                                            <option value="direct">➡️ Директен</option>
                                            <option value="inquiry">🔍 Истражувачки</option>
                                            <option value="problem">🧩 Проблемски</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="customInstruction" className="block text-sm font-bold text-gray-700 mb-2">
                                        <div className="flex items-center gap-2"><ICONS.sparkles className="w-4 h-4 text-brand-primary" />Дополнителни инструкции до AI (опционално)</div>
                                    </label>
                                    <textarea id="customInstruction" value={state.customInstruction} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'customInstruction', value: e.target.value } })} rows={2} className="block w-full p-3 border-gray-300 rounded-xl bg-gray-50 focus:bg-white resize-none" placeholder="Пр. 'Направи го потешко', 'Додај повеќе визуелни примери'..."></textarea>
                                </div>

                                <div className="flex items-center">
                                    <label className="flex items-start cursor-pointer p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors w-full">
                                        <div className="flex items-center h-5 mt-0.5">
                                            <input type="checkbox" checked={state.useMacedonianContext} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'useMacedonianContext', value: e.target.checked } })} className="focus:ring-brand-secondary h-5 w-5 text-brand-primary border-gray-300 rounded" />
                                        </div>
                                        <div className="ml-3 text-sm">
                                            <span className="font-bold text-gray-800 block">Локален контекст</span>
                                            <span className="text-gray-500 block leading-tight mt-1">Користи примери од локалната средина (денари, македонски градови, имиња).</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                    {/* Navigation Buttons */}
                    <div data-tour="generator-generate-button" className="flex items-center justify-between pt-6 border-t mt-auto gap-3">
                        {currentStep > 1 ? (
                            <button type="button" onClick={() => setCurrentStep(prev => prev - 1)} className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-gray-900 font-bold transition-all flex items-center gap-2">
                                <ICONS.chevronDown className="w-5 h-5 rotate-90" /> Назад
                            </button>
                        ) : (
                            <div></div> // Empty div for flexbox spacing
                        )}
                        
                        {currentStep < 3 ? (
                            <button type="button" onClick={() => setCurrentStep(prev => prev + 1)} className="px-6 py-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary font-bold shadow-md transition-all flex items-center gap-2">
                                Следно <ICONS.chevronDown className="w-5 h-5 -rotate-90" />
                            </button>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Delete old reset button from footer, keep only powerful generate buttons */}
                                {state.materialType !== null && (['ASSESSMENT', 'QUIZ', 'FLASHCARDS'] as MaterialType[]).includes(state.materialType) && (
                                    <button type="button" onClick={() => requirePremiumOrCredits(() => handleGenerateVariants(), 3, false, '3x Варијанти')} disabled={isGenerateDisabled || isGeneratingVariants || isGenerating} title="3 варијанти: Поддршка, Основно и Збогатување" className="flex items-center gap-2 border-2 border-brand-primary text-brand-primary px-4 py-2.5 rounded-xl hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold">
                                        {isGeneratingVariants ? (
                                          <><ICONS.spinner className="w-4 h-4 animate-spin" />Пресметувам...</>
                                        ) : (
                                          <><ICONS.sparkles className="w-4 h-4" /><span className="hidden sm:inline">3× Варијанти</span><span className="sm:hidden">3×</span></>
                                        )}
                                    </button>
                                )}
                                <button type="button" onClick={() => requirePremiumOrCredits(() => handleBulkGenerate(), 5, false, 'Пакет материјали')} disabled={isGenerateDisabled || isGenerating || isGeneratingVariants || isGeneratingBulk} title="Квиз + Тест + Рубрика одеднаш" className="flex items-center gap-2 border-2 border-purple-500 text-purple-700 px-4 py-2.5 rounded-xl hover:bg-purple-50 disabled:opacity-40 transition-all font-bold">
                                    {isGeneratingBulk ? (
                                      <><ICONS.spinner className="w-4 h-4 animate-spin" />Пакет...</>
                                    ) : (
                                      <><ICONS.sparkles className="w-4 h-4" /><span className="hidden sm:inline">Пакет материјали</span><span className="sm:hidden">Пакет</span></>
                                    )}
                                </button>
                                {verifiedQs.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleGenerateFromBank}
                                        disabled={isGenerating || isGeneratingVariants || isGeneratingBulk}
                                        title={`Создај квиз од ${verifiedQs.length} верификувани прашања (без AI)`}
                                        className="flex items-center gap-2 border-2 border-green-500 text-green-700 px-4 py-2.5 rounded-xl hover:bg-green-50 disabled:opacity-40 transition-all font-bold"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        <span className="hidden sm:inline">Од банката ({verifiedQs.length})</span>
                                        <span className="sm:hidden">Банка ({verifiedQs.length})</span>
                                    </button>
                                )}
                                <button type="submit" disabled={isGenerateDisabled || isGeneratingVariants || isGeneratingBulk} title={!isOnline ? 'Нема интернет' : 'Генерирај'} className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-blue-700 text-white px-8 py-2.5 rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold transform hover:-translate-y-0.5">
                                    {isGenerating ? (
                                      <><ICONS.spinner className="w-5 h-5 animate-spin" /> Генерирам...</>
                                    ) : (
                                      <><ICONS.sparkles className="w-5 h-5" /> Генерирај AI</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            </Card>
            </div>

            {/* RIGHT SIDE: Preview Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 xl:overflow-y-auto min-h-[500px] xl:min-h-0 flex flex-col p-4 xl:p-8 custom-scrollbar">
            <ResultErrorBoundary>
                {/* Empty State */}
                {!isGenerating && !isGeneratingVariants && !isGeneratingBulk && !generatedMaterial && !variants && (!bulkResults || Object.keys(bulkResults).length === 0) && (
                    <div className="m-auto flex flex-col items-center justify-center text-gray-400 opacity-60 max-w-md text-center">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-gray-100">
                            <ICONS.generator className="w-12 h-12 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-600 mb-2">Тука ќе се појави материјалот</h3>
                        <p className="text-sm leading-relaxed">Пополнете ги опциите лево и кликнете <strong>Генерирај AI</strong>. Резултатот и сите алатки за уредување ќе бидат прикажани на овој широк простор.</p>
                    </div>
                )}

            {/* Smart Loading Indicator + Cancel button */}
            {isGenerating && !generatedMaterial && (
                <div className="mt-6 flex flex-col items-center gap-3">
                    <AILoadingIndicator />
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition"
                    >
                        <X className="w-3.5 h-3.5" />
                        Откажи генерирање
                    </button>
                </div>
            )}
            
            {isGeneratingBulk && (
                <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <p className="text-sm font-bold text-purple-800 mb-3">Генерирам пакет материјали...</p>
                    {(['QUIZ', 'ASSESSMENT', 'RUBRIC'] as const).map((step, i) => {
                        const labels = { QUIZ: 'Квиз', ASSESSMENT: 'Тест/Лист', RUBRIC: 'Рубрика' };
                        const done = !!bulkResults?.[step === 'QUIZ' ? 'quiz' : step === 'ASSESSMENT' ? 'assessment' : 'rubric'];
                        const active = bulkStep === step;
                        return (
                            <div key={step} className="flex items-center gap-2 py-1">
                                {done
                                    ? <ICONS.check className="w-4 h-4 text-green-500" />
                                    : active
                                        ? <ICONS.spinner className="w-4 h-4 animate-spin text-purple-600" />
                                        : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                }
                                <span className={`text-sm ${done ? 'text-green-700 font-semibold' : active ? 'text-purple-700 font-bold' : 'text-gray-400'}`}>
                                    {i + 1}. {labels[step]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {!isGenerating && generatedMaterial && (
                <div className="mt-6 flex flex-col gap-4">

                    {/* B5: Extraction → Generator pre-fill panel */}
                    {(state.materialType === 'VIDEO_EXTRACTOR' || state.materialType === 'IMAGE_EXTRACTOR' || state.materialType === 'WEB_EXTRACTOR') && (
                      <div className="p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-200 rounded-2xl">
                        <p className="text-xs font-black text-cyan-800 uppercase tracking-widest mb-1">Содржината е извлечена!</p>
                        <p className="text-sm text-cyan-700 mb-3">Избери тип на материјал за да генерираш врз основа на оваа содржина:</p>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { type: 'QUIZ' as MaterialType,        emoji: '❓', label: 'Квиз' },
                            { type: 'ASSESSMENT' as MaterialType,   emoji: '📄', label: 'Тест' },
                            { type: 'SCENARIO' as MaterialType,     emoji: '🎭', label: 'Сценарио' },
                            { type: 'FLASHCARDS' as MaterialType,   emoji: '🃏', label: 'Картички' },
                            { type: 'EXIT_TICKET' as MaterialType,  emoji: '🎟️', label: 'Exit Ticket' },
                          ] as const).map(({ type, emoji, label }) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleGenerateFromExtraction(type)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-cyan-300 text-cyan-800 rounded-xl text-sm font-bold hover:bg-cyan-100 hover:border-cyan-500 transition-all shadow-sm"
                            >
                              <span>{emoji}</span>{label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {'imageUrl' in generatedMaterial && <GeneratedIllustration material={generatedMaterial} />}
                    {'openingActivity' in generatedMaterial && (
                      <>
                        <GeneratedIdeas material={generatedMaterial} onSaveAsNote={handleSaveAsNote} />
                        <div className="flex justify-end gap-2">
                          <button type="button"
                            onClick={() => handleSaveToLibrary(generatedMaterial, 'main')}
                            disabled={savedToLibrary.has('main')}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has('main') ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                            {savedToLibrary.has('main') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                            {savedToLibrary.has('main') ? 'Зачувано' : 'Зачувај во библиотека'}
                          </button>
                        </div>
                      </>
                    )}
                    {'questions' in generatedMaterial && (state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') && (
                      <div className="bg-white border border-indigo-100 rounded-2xl p-4">
                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Webb's DoK — Распределба на генерираните прашања</p>
                        <DokDistributionBar questions={(generatedMaterial as AIGeneratedAssessment).questions} />
                      </div>
                    )}
                    {'questions' in generatedMaterial && (generatedMaterial as AIGeneratedAssessment).questions?.some(q => q.tableData) && (
                      <div className="flex flex-col gap-3">
                        {(generatedMaterial as AIGeneratedAssessment).questions
                          .filter(q => q.tableData)
                          .map((q) => (
                            <StatisticsWorkspace key={q.tableData?.caption ?? ''} initialData={q.tableData} title={q.tableData?.caption} />
                          ))}
                      </div>
                    )}
                    {'questions' in generatedMaterial && (
                        <div className="flex flex-col gap-2">
                            <GeneratedAssessment material={generatedMaterial} onSaveQuestion={handleSaveQuestion} />
                            <div className="flex justify-end gap-2 flex-wrap items-center">
                                {/* PRO privacy toggle — shown only for PRO users before first save */}
                                {isPro && !savedToLibrary.has('main') && (
                                  <button
                                    type="button"
                                    onClick={() => setSaveIsPublic(v => !v)}
                                    title={saveIsPublic ? 'Материјалот ќе биде јавен во Библиотеката' : 'Материјалот е приватен — само за тебе (PRO)'}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                      saveIsPublic
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно (PRO)</>}
                                  </button>
                                )}
                                <button type="button"
                                    onClick={() => handleSaveToLibrary(generatedMaterial, 'main')}
                                    disabled={savedToLibrary.has('main')}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has('main') ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                    {savedToLibrary.has('main') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                                    {savedToLibrary.has('main') ? 'Зачувано' : 'Зачувај'}
                                </button>
                                <QuizShareButton
                                    material={generatedMaterial as AIGeneratedAssessment}
                                    materialType={(state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') ? state.materialType : 'QUIZ'}
                                    conceptId={state.selectedConcepts[0]}
                                    gradeLevel={curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level}
                                />
                                <button type="button" onClick={() => setAssignTarget(generatedMaterial as AIGeneratedAssessment)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                                    <ClipboardList className="w-4 h-4" />Задај на одделение
                                </button>
                            </div>
                        </div>
                    )}
                    {'criteria' in generatedMaterial && <GeneratedRubric material={generatedMaterial} />}
                    {'slides' in generatedMaterial && <GeneratedPresentation data={generatedMaterial as import('../types').AIGeneratedPresentation} conceptId={state.selectedConcepts[0]} />}
                    {'paths' in generatedMaterial && <GeneratedLearningPaths material={generatedMaterial} />}
                    {'steps' in generatedMaterial && <WorkedExample example={generatedMaterial as AIGeneratedWorkedExample} />}
                    
                    <AIFeedbackBar
                        materialKey={('title' in generatedMaterial ? (generatedMaterial as { title?: string }).title ?? '' : '') + String(state.materialType)}
                        onRate={handleMaterialRate}
                    />
                    <RefineGenerationChat
                        material={generatedMaterial}
                        onUpdateMaterial={setGeneratedMaterial}
                        materialType={state.materialType || 'IDEAS'}
                    />
                </div>
            )}

            {/* 3× Variants loading indicator */}
            {isGeneratingVariants && (
                <div className="mt-6">
                    <AILoadingIndicator />
                    <p className="text-center text-sm text-gray-500 mt-3">Генерирам 3 варијанти — Поддршка, Основно и Збогатување...</p>
                </div>
            )}

            {/* 3× Variants result tabs */}
            {!isGeneratingVariants && variants && (
                <div className="mt-6 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <ICONS.sparkles className="w-5 h-5 text-brand-primary" />
                        <h3 className="text-lg font-bold text-gray-800">3 Нивоа на диференцијација</h3>
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
                        {([
                            { value: 'support' as const, label: '🔵 Поддршка' },
                            { value: 'standard' as const, label: '⚪ Основно' },
                            { value: 'advanced' as const, label: '🔴 Збогатување' },
                        ]).map(opt => (
                            <button key={opt.value} type="button"
                                onClick={() => setActiveVariantTab(opt.value)}
                                className={`flex-1 py-2.5 px-4 font-semibold text-sm transition-colors border-r last:border-r-0 border-gray-200 ${activeVariantTab === opt.value ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                            >{opt.label}</button>
                        ))}
                    </div>
                    {variants[activeVariantTab] && (
                        <div className="flex flex-col gap-2">
                            <GeneratedAssessment material={variants[activeVariantTab]} onSaveQuestion={handleSaveQuestion} />
                            <div className="flex justify-end gap-2 flex-wrap items-center">
                                {isPro && !savedToLibrary.has(`variant-${activeVariantTab}`) && (
                                  <button
                                    type="button"
                                    onClick={() => setSaveIsPublic(v => !v)}
                                    title={saveIsPublic ? 'Материјалот ќе биде јавен во Библиотеката' : 'Материјалот е приватен — само за тебе (PRO)'}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                      saveIsPublic
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно (PRO)</>}
                                  </button>
                                )}
                                <button type="button"
                                    onClick={() => handleSaveToLibrary(variants[activeVariantTab], `variant-${activeVariantTab}`)}
                                    disabled={savedToLibrary.has(`variant-${activeVariantTab}`)}
                                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has(`variant-${activeVariantTab}`) ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                                    {savedToLibrary.has(`variant-${activeVariantTab}`) ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                                    {savedToLibrary.has(`variant-${activeVariantTab}`) ? 'Зачувано' : 'Зачувај'}
                                </button>
                                <QuizShareButton
                                    material={variants[activeVariantTab]}
                                    materialType={(state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') ? state.materialType : 'QUIZ'}
                                    conceptId={state.selectedConcepts[0]}
                                    gradeLevel={curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level}
                                />
                                <button type="button" onClick={() => setAssignTarget(variants[activeVariantTab])}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                                    <ClipboardList className="w-4 h-4" />Задај на одделение
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bulk results — full lesson package */}
            {!isGeneratingBulk && bulkResults && Object.keys(bulkResults).length > 0 && (
                <div className="mt-6 space-y-6">
                    {/* Header + Save Package */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                            <ICONS.sparkles className="w-5 h-5" />
                            Генериран пакет материјали
                        </h3>
                        <div className="flex items-center gap-2">
                            {isPro && !savedToLibrary.has('package') && (
                                <button
                                    type="button"
                                    onClick={() => setSaveIsPublic(v => !v)}
                                    title={saveIsPublic ? 'Пакетот ќе биде јавен' : 'Пакетот е приватен (PRO)'}
                                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${saveIsPublic ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                >
                                    {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно</>}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSavePackage}
                                disabled={savedToLibrary.has('package')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${savedToLibrary.has('package') ? 'bg-green-100 text-green-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                            >
                                {savedToLibrary.has('package') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                                {savedToLibrary.has('package') ? 'Пакетот зачуван' : '💾 Зачувај цел пакет'}
                            </button>
                        </div>
                    </div>

                    {/* Scenario (lesson plan) */}
                    {bulkResults.scenario && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-purple-500 mb-2">🎭 Сценарио за час</p>
                            <GeneratedIdeas material={bulkResults.scenario} onSaveAsNote={handleSaveAsNote} />
                        </div>
                    )}

                    {/* Quiz */}
                    {bulkResults.quiz && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">❓ Квиз</p>
                            <GeneratedAssessment material={bulkResults.quiz} onSaveQuestion={handleSaveQuestion} />
                        </div>
                    )}

                    {/* Assessment */}
                    {bulkResults.assessment && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2">📄 Писмена работа</p>
                            <GeneratedAssessment material={bulkResults.assessment} onSaveQuestion={handleSaveQuestion} />
                        </div>
                    )}

                    {/* Rubric */}
                    {bulkResults.rubric && (
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-green-500 mb-2">📊 Рубрика</p>
                            <GeneratedRubric material={bulkResults.rubric} />
                        </div>
                    )}
                </div>
            )}

            {/* National standards alignment — shown after any result */}
            {!isGenerating && !isGeneratingVariants && (generatedMaterial || variants) && relevantStandards.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <ICONS.check className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-700">Усогласеност со Национални стандарди</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {relevantStandards.map((s: NationalStandard) => (
                            <div key={s.id} className="group relative">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-default border border-blue-200 hover:bg-blue-200 transition-colors">
                                    {s.code}
                                </span>
                                <div className="absolute bottom-full left-0 mb-1.5 w-72 bg-gray-900 text-white text-xs rounded-lg p-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                                    <span className="font-semibold text-blue-300">{s.code}</span>
                                    <p className="mt-0.5">{s.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            </ResultErrorBoundary>
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
