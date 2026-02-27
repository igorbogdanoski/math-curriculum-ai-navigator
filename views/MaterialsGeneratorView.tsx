
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { RateLimitError } from '../services/apiErrors';
import type { AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric, GenerationContext, Topic, Concept, Grade, NationalStandard, StudentProfile, AIGeneratedIllustration, AIGeneratedLearningPaths, MaterialType } from '../types';
import { ModalType, PlannerItemType } from '../types';
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
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { generatorTourSteps } from '../tours/tour-steps';
import { useModal } from '../contexts/ModalContext';
import { useGeneratorState, type GeneratorState, getInitialState } from '../hooks/useGeneratorState';
import { GenerationContextForm } from '../components/generator/GenerationContextForm';
import { MaterialOptions } from '../components/generator/MaterialOptions';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';


declare var introJs: any;


const materialOptions: { id: MaterialType; label: string; icon: keyof typeof ICONS }[] = [
    { id: 'SCENARIO', label: 'Сценарио/Идеи', icon: 'lightbulb' },
    { id: 'LEARNING_PATH', label: 'Патека за учење', icon: 'mindmap' },
    { id: 'ASSESSMENT', label: 'Тест/Лист', icon: 'generator' },
    { id: 'RUBRIC', label: 'Рубрика', icon: 'edit' },
    { id: 'FLASHCARDS', label: 'Флеш-картички', icon: 'flashcards' },
    { id: 'QUIZ', label: 'Квиз', icon: 'quiz' },
    { id: 'EXIT_TICKET', label: 'Излезна картичка', icon: 'quiz' },
    { id: 'ILLUSTRATION', label: 'Илустрација', icon: 'gallery' },
];

export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props: Partial<GeneratorState>) => {
    const { curriculum, allConcepts, allNationalStandards, isLoading: isCurriculumLoading, getConceptDetails, findConceptAcrossGrades } = useCurriculum();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { addItem } = usePlanner();
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const { isOnline } = useNetworkStatus();
    const { showModal, hideModal } = useModal();
    
    const [state, dispatch] = useGeneratorState(props);
    const { materialType, contextType, selectedGrade, selectedTopic, selectedConcepts, selectedStandard, scenarioText, selectedActivity, imageFile, illustrationPrompt, activityTitle, useStudentProfiles, selectedStudentProfileIds, questionTypes, includeSelfAssessment, bloomDistribution } = state;

    // API State
    const [isGenerating, setIsLoading] = useState(false);
    const [generatedMaterial, setGeneratedMaterial] = useState<AIGeneratedIdeas | AIGeneratedAssessment | AIGeneratedRubric | AIGeneratedIllustration | AIGeneratedLearningPaths | null>(null);
    const [isThrottled, setIsThrottled] = useState(false);
    const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);

    // Quota error state — shown as persistent inline banner instead of fleeting toast
    const [quotaError, setQuotaError] = useState<{ resetTime: string; resetMs: number } | null>(null);
    const [quotaCountdown, setQuotaCountdown] = useState('');
    // Cancel ref — abort() sets isGenerating=false visually; underlying request finishes in bg
    const cancelRef = useRef(false);

    // 3× Variants state
    const [variants, setVariants] = useState<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment> | null>(null);
    const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
    const [activeVariantTab, setActiveVariantTab] = useState<'support' | 'standard' | 'advanced'>('standard');

    const filteredTopics = useMemo(() => curriculum?.grades.find((g: Grade) => g.id === selectedGrade)?.topics || [], [curriculum, selectedGrade]);
    const filteredConcepts = useMemo(() => filteredTopics.find((t: Topic) => t.id === selectedTopic)?.concepts || [], [filteredTopics, selectedTopic]);

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

    const tourInstance = React.useRef<any>(null);
    useEffect(() => {
        if (toursSeen.generator === true || typeof introJs === 'undefined' || isCurriculumLoading || tourInstance.current) return;
        
        // Disable tours on small screens as they are often buggy
        if (window.innerWidth < 768) return;

        const timer = setTimeout(() => {
            if (toursSeen.generator === true || tourInstance.current) return;

            const tour = introJs();
            tourInstance.current = tour;
            
            tour.setOptions({
                steps: generatorTourSteps,
                showProgress: true,
                showBullets: true,
                showStepNumbers: true,
                nextLabel: 'Следно',
                prevLabel: 'Претходно',
                doneLabel: 'Готово',
                exitOnOverlayClick: false, // Prevent accidental exits
            });
            
            const cleanup = () => {
                markTourAsSeen('generator');
                tourInstance.current = null;
            };

            tour.oncomplete(cleanup);
            tour.onexit(cleanup);
            
            try {
                tour.start();
            } catch (e) {
                console.warn("Failed to start generator tour:", e);
                tourInstance.current = null;
            }
        }, 1000);

        return () => {
            clearTimeout(timer);
            if (tourInstance.current) {
                tourInstance.current.exit(true);
                tourInstance.current = null;
            }
        };
    }, [toursSeen.generator, markTourAsSeen, isCurriculumLoading]);
    
    // Auto-populate illustration prompt
    useEffect(() => {
        if (materialType !== 'ILLUSTRATION') return;

        let newPrompt = '';
        if (contextType === 'CONCEPT' && selectedConcepts.length > 0) {
            const concept = filteredConcepts.find((c: Concept) => c.id === selectedConcepts[0]);
            newPrompt = concept ? `Визуелен приказ на ${concept.title}` : '';
        } else if (contextType === 'STANDARD' && selectedStandard) {
            const standard = allNationalStandards?.find((s: NationalStandard) => s.id === selectedStandard);
            newPrompt = standard ? `Илустрација за: ${standard.description}` : '';
        } else if (contextType === 'SCENARIO' && scenarioText) {
            newPrompt = `Илустрација за идејата: ${scenarioText}`;
        } else if (contextType === 'ACTIVITY' && selectedActivity) {
            newPrompt = `Илустрација за активноста: ${selectedActivity}`;
        }
        dispatch({ type: 'SET_FIELD', payload: { field: 'illustrationPrompt', value: newPrompt } });
    }, [materialType, contextType, selectedConcepts, selectedStandard, scenarioText, selectedActivity, filteredConcepts, allNationalStandards, dispatch]);

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

    const handleSaveAsNote = async () => {
        if (!generatedMaterial || !('openingActivity' in generatedMaterial)) {
            addNotification('Нема генерирани идеи за зачувување.', 'error');
            return;
        }

        const noteContent = `
### ${generatedMaterial.title}

**Воведна активност:**
${generatedMaterial.openingActivity}

**Главна активност:**
${generatedMaterial.mainActivity}

**Диференцијација:**
${generatedMaterial.differentiation}

**Идеја за оценување:**
${generatedMaterial.assessmentIdea}
        `.trim();

        try {
            await addItem({
                title: `Белешка: ${generatedMaterial.title}`,
                date: new Date().toISOString().split('T')[0],
                type: PlannerItemType.EVENT,
                description: noteContent,
            });
            addNotification('Идејата е успешно зачувана како белешка во планерот!', 'success');
        } catch (error) {
            addNotification('Грешка при зачувување на белешката.', 'error');
        }
    };
    
    const handleReset = () => {
        showModal(ModalType.Confirm, {
            title: 'Ресетирање',
            message: 'Дали сте сигурни дека сакате да ги ресетирате сите полиња?',
            variant: 'warning',
            confirmLabel: 'Да, ресетирај',
            onConfirm: () => {
                hideModal();
                if(curriculum && allNationalStandards) {
                    dispatch({ type: 'INITIALIZE', payload: getInitialState(curriculum, allNationalStandards) });
                }
                setGeneratedMaterial(null);
                addNotification('Формата е ресетирана.', 'info');
            },
            onCancel: hideModal,
        });
    };

    const MACEDONIAN_CONTEXT_HINT = 'Користи македонски примери: цени во денари (МКД), градови (Скопје, Битола, Охрид), реки (Вардар, Брегалница), ситуации од македонскиот секојдневен живот.';

    // Shared context builder — used by both handleGenerate and handleGenerateVariants
    const buildContext = (): { context: GenerationContext; imageParam: any; studentProfilesToPass: StudentProfile[] | undefined; tempActivityTitle: string } | null => {
        if (!curriculum) return null;
        const gradeData = curriculum.grades.find((g: Grade) => g.id === selectedGrade) || curriculum.grades.find((g: Grade) => String(g.level) === selectedGrade);
        if (!gradeData && contextType !== 'STANDARD') return null;
        let context: GenerationContext | null = null;
        let tempActivityTitle = activityTitle;
        switch (contextType) {
            case 'CONCEPT': case 'TOPIC': case 'ACTIVITY': {
                const topic = gradeData?.topics.find((t: Topic) => t.id === selectedTopic);
                if (!topic) return null;
                const concepts = allConcepts.filter((c: Concept) => selectedConcepts.includes(c.id));
                if ((contextType === 'CONCEPT' || contextType === 'ACTIVITY') && concepts.length === 0) return null;
                const scenario = contextType === 'ACTIVITY' ? `Креирај материјал за учење базиран на следнава активност од наставната програма: "${selectedActivity}"` : undefined;
                const activeBlooms = Object.keys(bloomDistribution).length > 0 ? bloomDistribution : undefined;
                // Resolve prerequisite concept titles for each selected concept
                const prerequisitesByConceptId: Record<string, string[]> = {};
                concepts.forEach((c: Concept) => {
                    if (c.priorKnowledgeIds?.length) {
                        prerequisitesByConceptId[c.id] = c.priorKnowledgeIds
                            .map((id: string) => getConceptDetails(id).concept?.title)
                            .filter((t): t is string => !!t);
                    }
                });
                // Resolve vertical progression for each selected concept across grades
                const verticalProgression = concepts
                    .map((c: Concept) => {
                        const prog = findConceptAcrossGrades(c.id);
                        if (!prog || prog.progression.length < 2) return null;
                        return {
                            conceptId: c.id,
                            title: prog.title,
                            progression: prog.progression.map(p => ({ grade: p.grade, conceptTitle: p.concept.title })),
                        };
                    })
                    .filter((p): p is NonNullable<typeof p> => p !== null);
                context = { type: contextType, grade: gradeData!, topic, concepts, scenario, bloomDistribution: activeBlooms, prerequisitesByConceptId, verticalProgression: verticalProgression.length ? verticalProgression : undefined };
                if (!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = contextType === 'ACTIVITY' ? selectedActivity : `Активност за ${concepts[0]?.title || topic.title}`;
                break;
            }
            case 'STANDARD': {
                const standard = allNationalStandards?.find((s: NationalStandard) => s.id === selectedStandard);
                if (!standard) return null;
                const standardGradeData = curriculum.grades.find((g: Grade) => g.level === standard.gradeLevel) || gradeData;
                if (!standardGradeData) return null;
                let topicForStandard: Topic | undefined;
                const concepts = standard.relatedConceptIds?.map((id: string) => { const details = getConceptDetails(id); if (!topicForStandard && details.topic) topicForStandard = details.topic; return details.concept; }).filter((c: Concept | undefined): c is Concept => !!c);
                if (!topicForStandard) topicForStandard = { id: 'standard-topic', title: `Стандарди за ${standardGradeData.title}`, description: `Материјали генерирани врз основа на национален стандард.`, concepts: concepts || [] };
                context = { type: 'STANDARD', grade: standardGradeData, standard, concepts, topic: topicForStandard };
                if (!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = `Активност за стандард ${standard.code}`;
                break;
            }
            case 'SCENARIO': {
                if (!scenarioText.trim() && !imageFile) return null;
                if (!gradeData) return null;
                context = { type: 'SCENARIO', grade: gradeData, scenario: scenarioText, topic: { id: 'scenario-topic', title: 'Генерирање од идеја', description: scenarioText.substring(0, 100), concepts: [] } };
                if (!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = `Активност според идеја`;
                break;
            }
        }
        if (!context) return null;
        return {
            context,
            imageParam: imageFile ? { base64: imageFile.base64, mimeType: imageFile.file.type } : undefined,
            studentProfilesToPass: (useStudentProfiles || materialType === 'LEARNING_PATH') ? user?.studentProfiles?.filter((p: StudentProfile) => selectedStudentProfileIds.includes(p.id)) : undefined,
            tempActivityTitle,
        };
    };

    const handleGenerateVariants = async () => {
        if (!isOnline) { addNotification("Нема интернет конекција.", 'error'); return; }
        if (isGeneratingVariants || isGenerateDisabled) return;
        if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }
        const built = buildContext();
        if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
        const { context: finalContext } = built;
        const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', state.customInstruction].filter(Boolean).join(' ');

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
                    materialType as 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS',
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

    const handleCancel = () => {
        cancelRef.current = true;
        setIsLoading(false);
    };

    // Helper to extract quota reset info from localStorage and set the inline banner
    const setQuotaBannerFromStorage = () => {
        try {
            const stored = localStorage.getItem('ai_daily_quota_exhausted');
            const { nextResetMs } = stored ? JSON.parse(stored) : {};
            const resetTime = nextResetMs
                ? new Date(nextResetMs).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })
                : '09:00';
            setQuotaError({ resetTime, resetMs: nextResetMs ?? 0 });
        } catch {
            setQuotaError({ resetTime: '09:00', resetMs: 0 });
        }
    };

    const handleGenerate = async () => {
        if (!isOnline) {
            addNotification("Нема интернет конекција. Генераторот е недостапен.", 'error');
            return;
        }

        // Check quota upfront — show inline banner immediately instead of waiting for 429
        if (isDailyQuotaKnownExhausted()) {
            setQuotaBannerFromStorage();
            return;
        }

        if (isThrottled) {
            addNotification("Ве молиме почекајте малку пред следното барање.", 'warning');
            return;
        }

        if(!curriculum) {
            addNotification('Наставната програма се уште се вчитува.', 'warning');
            return;
        }

        setIsThrottled(true);
        setTimeout(() => setIsThrottled(false), 3000); // 3s throttle

        const built = buildContext();
        if (!built) {
            addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error');
            return;
        }
        const { context: finalContext, imageParam, studentProfilesToPass, tempActivityTitle } = built;
        const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', state.customInstruction].filter(Boolean).join(' ');

        setIsLoading(true);
        setGeneratedMaterial(null);
        setVariants(null);

        try {
            if (materialType === 'ILLUSTRATION') {
                if (!illustrationPrompt && !imageFile) {
                    addNotification('Ве молиме внесете опис или прикачете слика за илустрацијата.', 'error');
                    setIsLoading(false);
                    return;
                }
                const res = await geminiService.generateIllustration(illustrationPrompt, imageParam);
                setGeneratedMaterial({ ...res, prompt: illustrationPrompt });
            } else if (materialType === 'LEARNING_PATH') {
                if (!studentProfilesToPass || studentProfilesToPass.length === 0) {
                    addNotification('Ве молиме изберете барем еден профил на ученик.', 'error');
                    setIsLoading(false);
                    return;
                }
                const result = await geminiService.generateLearningPaths(finalContext, studentProfilesToPass, user ?? undefined, effectiveInstruction);
                setGeneratedMaterial(result);
            } else if (materialType) { // SCENARIO, ASSESSMENT, RUBRIC, etc.
                let result;
                switch(materialType){
                    case 'SCENARIO':
                         if (!finalContext.grade) throw new Error("Недостасува информација за одделение.");
                         if (!finalContext.topic) throw new Error("Недостасува информација за тема.");
                         result = await geminiService.generateLessonPlanIdeas(finalContext.concepts || [], finalContext.topic, finalContext.grade.level, user ?? undefined, { focus: state.activityFocus, tone: state.scenarioTone, learningDesign: state.learningDesignModel }, effectiveInstruction);
                         result.generationContext = finalContext;
                         break;
                    case 'ASSESSMENT':
                    case 'FLASHCARDS':
                    case 'QUIZ':
                        result = await geminiService.generateAssessment(materialType, state.questionTypes, state.numQuestions, finalContext, user ?? undefined, state.differentiationLevel, studentProfilesToPass, imageParam, effectiveInstruction, includeSelfAssessment);
                        break;
                    case 'EXIT_TICKET':
                        result = await geminiService.generateExitTicket(state.exitTicketQuestions, state.exitTicketFocus, finalContext, user ?? undefined, effectiveInstruction);
                        break;
                    case 'RUBRIC':
                        if (!finalContext.grade) throw new Error("Недостасува информација за одделение.");
                        result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, state.activityType, state.criteriaHints, user ?? undefined, effectiveInstruction);
                        break;
                }
                setGeneratedMaterial(result || null);
            }
        } catch (error) {
            if (cancelRef.current) { cancelRef.current = false; return; } // user cancelled — no error shown
            console.error("[AI Generator]", error);
            if (error instanceof RateLimitError) {
                setQuotaBannerFromStorage(); // persistent inline banner instead of toast
            } else {
                const msg = (error instanceof Error && error.message)
                    ? error.message
                    : "Грешка при генерирање. Обидете се повторно.";
                addNotification(msg, 'error');
            }
            setGeneratedMaterial(null);
        } finally {
            cancelRef.current = false;
            setIsLoading(false);
        }
    }
    
    const isGenerateDisabled = useMemo(() => {
        if (isGenerating || !isOnline) return true;
        
        let contextIsValid = false;
        switch (contextType) {
            case 'CONCEPT': case 'TOPIC': contextIsValid = selectedConcepts.length > 0; break;
            case 'STANDARD': contextIsValid = !!selectedStandard; break;
            case 'SCENARIO': contextIsValid = scenarioText.trim().length > 0 || !!imageFile; break;
            case 'ACTIVITY': contextIsValid = selectedConcepts.length > 0 && !!selectedActivity; break;
            default: contextIsValid = false;
        }
        if(!contextIsValid) return true;

        if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType || '')) {
             if (questionTypes.length === 0) return true;
             if (useStudentProfiles && selectedStudentProfileIds.length === 0) return true;
        }
        if (materialType === 'LEARNING_PATH' && selectedStudentProfileIds.length === 0) return true;
        if (materialType === 'RUBRIC' && !activityTitle) return true;
        if (materialType === 'ILLUSTRATION' && !illustrationPrompt.trim() && !imageFile) return true;
        
        return false;
    }, [isGenerating, materialType, contextType, selectedConcepts, selectedStandard, scenarioText, selectedActivity, imageFile, questionTypes, useStudentProfiles, selectedStudentProfileIds, activityTitle, illustrationPrompt, isOnline]);
    
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
        <div className="p-4 md:p-6">
            {/* Inline quota exhaustion banner — persistent, shows countdown */}
            {quotaError && (
                <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-orange-200 bg-orange-50">
                    <span className="text-xl flex-shrink-0">⛔</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-orange-800">AI квотата е исцрпена за денес</p>
                        <p className="text-xs text-orange-700 mt-0.5">
                            Генерирањето ќе биде достапно утре во <strong>09:00 МК</strong>
                            {quotaCountdown ? ` — уште ${quotaCountdown}` : ''}.
                        </p>
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
            <Card>
                <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); handleGenerate(); }}>
                    <fieldset disabled={isGenerating} className="space-y-6">
                        <fieldset data-tour="generator-step-1" className="p-4 border border-gray-200 rounded-lg">
                            <legend className="text-xl font-bold text-gray-800 px-2 -ml-2">1. Изберете тип на материјал</legend>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                                {materialOptions.map(({ id, label }) => (
                                    <button
                                        type="button"
                                        key={id}
                                        onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'materialType', value: id } })}
                                        className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                                            materialType === id
                                                ? 'bg-brand-primary text-white shadow'
                                                : 'bg-transparent text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <GenerationContextForm state={state} dispatch={dispatch} />
                        
                        <fieldset data-tour="generator-step-3" className="p-4 border border-gray-200 rounded-lg">
                            <legend className="text-xl font-bold text-gray-800 px-2 -ml-2">3. Поставете опции</legend>
                            <div className="space-y-4 pt-2">
                                <MaterialOptions state={state} dispatch={dispatch} user={user} />

                                {/* Differentiation level — only for assessment types */}
                                {(['ASSESSMENT', 'QUIZ', 'FLASHCARDS', 'LEARNING_PATH'] as const).includes(state.materialType as any) && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ниво на диференцијација</label>
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                            {([
                                                { value: 'support' as const, label: '🔵 Поддршка', title: 'Поедноставено со детални упатства' },
                                                { value: 'standard' as const, label: '⚪ Основно', title: 'Стандардно ниво' },
                                                { value: 'advanced' as const, label: '🔴 Збогатување', title: 'Предизвикувачко со критичко размислување' },
                                            ]).map(opt => (
                                                <button key={opt.value} type="button" title={opt.title}
                                                    onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'differentiationLevel', value: opt.value } })}
                                                    className={`flex-1 py-2 px-3 font-medium transition-colors border-r last:border-r-0 border-gray-200 ${state.differentiationLevel === opt.value ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                                                >{opt.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="customInstruction" className="block text-sm font-medium text-gray-700">Дополнителни инструкции за AI (опционално)</label>
                                    <textarea id="customInstruction" value={state.customInstruction} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'customInstruction', value: e.target.value } })} rows={2} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="На пр. 'Фокусирај се на примери од реалниот живот', 'Направи го текстот забавен', 'Прашањата да бидат потешки'..."></textarea>
                                </div>

                                {/* Macedonian context toggle */}
                                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={state.useMacedonianContext}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'useMacedonianContext', value: e.target.checked } })}
                                        className="rounded border-gray-300 text-brand-primary"
                                    />
                                    Користи македонски примери (денари, локални места, македонски контекст)
                                </label>
                            </div>
                        </fieldset>
                    </fieldset>

                    <div data-tour="generator-generate-button" className="flex flex-wrap justify-end items-center pt-6 border-t mt-6 gap-3">
                         <button type="button" onClick={handleReset} disabled={isGenerating || isGeneratingVariants} className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors">
                            Ресетирај форма
                        </button>
                        {/* 3× Variants button — only for assessment material types */}
                        {(['ASSESSMENT', 'QUIZ', 'FLASHCARDS'] as const).includes(state.materialType as any) && (
                            <button
                                type="button"
                                onClick={handleGenerateVariants}
                                disabled={isGenerateDisabled || isGeneratingVariants || isGenerating}
                                title="Генерирај материјал на 3 нивоа: Поддршка, Основно и Збогатување"
                                className="flex items-center gap-2 border-2 border-brand-primary text-brand-primary px-4 py-3 rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
                            >
                                {isGeneratingVariants
                                    ? <><ICONS.spinner className="w-5 h-5 animate-spin" /><span>Генерирам 3 варијанти...</span></>
                                    : <><ICONS.sparkles className="w-5 h-5" /><span>3× Варијанти</span></>
                                }
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isGenerateDisabled || isGeneratingVariants}
                            title={!isOnline ? 'Нема интернет конекција' : 'Генерирај'}
                            className="w-full max-w-xs flex justify-center items-center gap-2 bg-brand-secondary text-white px-4 py-3 rounded-lg disabled:bg-gray-400 hover:bg-brand-primary transition-colors font-semibold text-lg"
                        >
                            {isGenerating ? (<><ICONS.spinner className="w-6 h-6 animate-spin" /><span>Генерирам...</span></>) : (<><ICONS.sparkles className="w-6 h-6"/><span>{isOnline ? 'Генерирај' : 'Офлајн'}</span></>)}
                        </button>
                    </div>
                </form>
            </Card>

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
            
            {!isGenerating && generatedMaterial && (
                <div className="mt-6">
                    {'imageUrl' in generatedMaterial && <GeneratedIllustration material={generatedMaterial} />}
                    {'openingActivity' in generatedMaterial && <GeneratedIdeas material={generatedMaterial} onSaveAsNote={handleSaveAsNote} />}
                    {'questions' in generatedMaterial && <GeneratedAssessment material={generatedMaterial} />}
                    {'criteria' in generatedMaterial && <GeneratedRubric material={generatedMaterial} />}
                    {'paths' in generatedMaterial && <GeneratedLearningPaths material={generatedMaterial} />}
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
                    {variants[activeVariantTab] && <GeneratedAssessment material={variants[activeVariantTab]} />}
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

            {!isGenerating && !isGeneratingVariants && !generatedMaterial && !variants && (
                <div className="mt-6"><EmptyState icon={<ICONS.generator className="w-12 h-12" />} title="Подготвени за создавање?" message="Следете ги чекорите за да го изберете саканиот контекст и параметри, потоа кликнете 'Генерирај' за да добиете материјали креирани од вештачка интелигенција." /></div>
            )}
        </div>
    );
};
