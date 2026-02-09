
import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import type { AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric, GenerationContext, Topic, Concept, AIGeneratedIllustration, AIGeneratedLearningPaths, MaterialType } from '../types';
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
import { generatorTourSteps } from '../tours/tour-steps';
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

export const MaterialsGeneratorView: React.FC<Partial<GeneratorState>> = (props) => {
    const { curriculum, allConcepts, allNationalStandards, isLoading: isCurriculumLoading, getConceptDetails } = useCurriculum();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { addItem } = usePlanner();
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const { isOnline } = useNetworkStatus();
    
    const [state, dispatch] = useGeneratorState(props);
    const { materialType, contextType, selectedGrade, selectedTopic, selectedConcepts, selectedStandard, scenarioText, selectedActivity, imageFile, illustrationPrompt, activityTitle, useStudentProfiles, selectedStudentProfileIds, questionTypes, includeSelfAssessment } = state;

    // API State
    const [isGenerating, setIsLoading] = useState(false);
    const [generatedMaterial, setGeneratedMaterial] = useState<AIGeneratedIdeas | AIGeneratedAssessment | AIGeneratedRubric | AIGeneratedIllustration | AIGeneratedLearningPaths | null>(null);

    const filteredTopics = useMemo(() => curriculum?.grades.find(g => g.id === selectedGrade)?.topics || [], [curriculum, selectedGrade]);
    const filteredConcepts = useMemo(() => filteredTopics.find(t => t.id === selectedTopic)?.concepts || [], [filteredTopics, selectedTopic]);

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
            const concept = filteredConcepts.find(c => c.id === selectedConcepts[0]);
            newPrompt = concept ? `Визуелен приказ на ${concept.title}` : '';
        } else if (contextType === 'STANDARD' && selectedStandard) {
            const standard = allNationalStandards?.find(s => s.id === selectedStandard);
            newPrompt = standard ? `Илустрација за: ${standard.description}` : '';
        } else if (contextType === 'SCENARIO' && scenarioText) {
            newPrompt = `Илустрација за идејата: ${scenarioText}`;
        } else if (contextType === 'ACTIVITY' && selectedActivity) {
            newPrompt = `Илустрација за активноста: ${selectedActivity}`;
        }
        dispatch({ type: 'SET_FIELD', payload: { field: 'illustrationPrompt', value: newPrompt } });
    }, [materialType, contextType, selectedConcepts, selectedStandard, scenarioText, selectedActivity, filteredConcepts, allNationalStandards, dispatch]);
    
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
                type: 'EVENT',
                description: noteContent,
            });
            addNotification('Идејата е успешно зачувана како белешка во планерот!', 'success');
        } catch (error) {
            addNotification('Грешка при зачувување на белешката.', 'error');
        }
    };
    
    const handleReset = () => {
        if (window.confirm('Дали сте сигурни дека сакате ги ресетирате сите полиња?')) {
            if(curriculum && allNationalStandards) {
                dispatch({ type: 'INITIALIZE', payload: getInitialState(curriculum, allNationalStandards) });
            }
            setGeneratedMaterial(null);
            addNotification('Формата е ресетирана.', 'info');
        }
    };

    const handleGenerate = async () => {
        if (!isOnline) {
            addNotification("Нема интернет конекција. Генераторот е недостапен.", 'error');
            return;
        }
        
        if(!curriculum) {
            addNotification('Наставната програма се уште се вчитува.', 'warning');
            return;
        }

        // Robust grade lookup to handle both string IDs and number levels
        const gradeData = curriculum.grades.find(g => g.id === selectedGrade) || curriculum.grades.find(g => String(g.level) === selectedGrade);
        
        // Only enforce grade selection if NOT using STANDARD context (standard defines grade)
        if(!gradeData && contextType !== 'STANDARD') {
             addNotification('Ве молиме изберете валидно одделение.', 'error');
             return;
        }

        let context: GenerationContext | null = null;
        
        let tempActivityTitle = activityTitle;
        switch(contextType) {
            case 'CONCEPT':
            case 'TOPIC':
            case 'ACTIVITY': {
                // Re-find topic to ensure it's valid object
                const topic = gradeData?.topics.find(t => t.id === selectedTopic);
                if (!topic) {
                    addNotification('Ве молиме изберете валидна тема.', 'error');
                    return;
                }
                const concepts = allConcepts.filter(c => selectedConcepts.includes(c.id));
                if ((contextType === 'CONCEPT' || contextType === 'ACTIVITY') && concepts.length === 0) {
                    addNotification('Ве молиме изберете барем еден поим.', 'error');
                    return;
                }
                
                const scenario = contextType === 'ACTIVITY' ? `Креирај материјал за учење базиран на следнава активност од наставната програма: "${selectedActivity}"` : undefined;
                context = { type: contextType, grade: gradeData!, topic, concepts, scenario };
                if (!tempActivityTitle && materialType === 'RUBRIC') {
                    tempActivityTitle = contextType === 'ACTIVITY' ? selectedActivity : `Активност за ${concepts[0]?.title || topic.title}`;
                }
                break;
            }
            case 'STANDARD': {
                const standard = allNationalStandards?.find(s => s.id === selectedStandard);
                if (!standard) {
                     addNotification('Ве молиме изберете стандард.', 'error');
                     return;
                }
                
                // Find grade data for standard
                const standardGradeData = curriculum.grades.find(g => g.level === standard.gradeLevel) || gradeData;
                
                if (!standardGradeData) {
                    addNotification('Не може да се одреди одделението за избраниот стандард.', 'error');
                    return;
                }

                let topicForStandard: Topic | undefined;
                const concepts = standard.relatedConceptIds
                    ?.map(id => {
                        const details = getConceptDetails(id);
                        if (!topicForStandard && details.topic) {
                            topicForStandard = details.topic;
                        }
                        return details.concept;
                    })
                    .filter((c): c is Concept => !!c);

                if (!topicForStandard) {
                    topicForStandard = {
                        id: 'standard-topic',
                        title: `Стандарди за ${standardGradeData.title}`,
                        description: `Материјали генерирани врз основа на национален стандард.`,
                        concepts: concepts || []
                    };
                }
                
                context = { type: 'STANDARD', grade: standardGradeData, standard, concepts, topic: topicForStandard };
                if(!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle =`Активност за стандард ${standard.code}`;
                break;
            }
            case 'SCENARIO': {
                 if (!scenarioText.trim() && !imageFile) {
                    addNotification('Ве молиме внесете идеја или прикачете слика.', 'error');
                    return;
                 }
                 const placeholderTopic: Topic = {
                     id: 'scenario-topic',
                     title: 'Генерирање од идеја',
                     description: scenarioText.substring(0, 100),
                     concepts: []
                 };
                 // Ensure gradeData is present for SCENARIO context
                 if (!gradeData) {
                      addNotification('Ве молиме изберете одделение за вашата идеја.', 'error');
                      return;
                 }
                 context = { type: 'SCENARIO', grade: gradeData, scenario: scenarioText, topic: placeholderTopic };
                 if(!tempActivityTitle && materialType === 'RUBRIC') tempActivityTitle = `Активност според идеја`;
                 break;
            }
        }

        if (!context) return;
        
        const finalContext = context;
        const imageParam = imageFile ? { base64: imageFile.base64, mimeType: imageFile.file.type } : undefined;
        const studentProfilesToPass = (useStudentProfiles || materialType === 'LEARNING_PATH') ? user?.studentProfiles?.filter(p => selectedStudentProfileIds.includes(p.id)) : undefined;

        setIsLoading(true);
        setGeneratedMaterial(null);

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
                const result = await geminiService.generateLearningPaths(finalContext, studentProfilesToPass, user ?? undefined, state.customInstruction);
                setGeneratedMaterial(result);
            } else if (materialType) { // SCENARIO, ASSESSMENT, RUBRIC, etc.
                let result;
                switch(materialType){
                    case 'SCENARIO':
                         if (!finalContext.grade) throw new Error("Недостасува информација за одделение.");
                         if (!finalContext.topic) throw new Error("Недостасува информација за тема.");
                         result = await geminiService.generateLessonPlanIdeas(finalContext.concepts || [], finalContext.topic, finalContext.grade.level, user ?? undefined, { focus: state.activityFocus, tone: state.scenarioTone, learningDesign: state.learningDesignModel }, state.customInstruction);
                         result.generationContext = finalContext;
                         break;
                    case 'ASSESSMENT':
                    case 'FLASHCARDS':
                    case 'QUIZ':
                        result = await geminiService.generateAssessment(materialType, state.questionTypes, state.numQuestions, finalContext, user ?? undefined, state.differentiationLevel, studentProfilesToPass, imageParam, state.customInstruction, includeSelfAssessment);
                        break;
                    case 'EXIT_TICKET':
                        result = await geminiService.generateExitTicket(state.exitTicketQuestions, state.exitTicketFocus, finalContext, user ?? undefined, state.customInstruction);
                        break;
                    case 'RUBRIC':
                        if (!finalContext.grade) throw new Error("Недостасува информација за одделение.");
                        result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, state.activityType, state.criteriaHints, user ?? undefined, state.customInstruction);
                        break;
                }
                setGeneratedMaterial(result || null);
            }
        } catch (error) {
            addNotification((error as Error).message, 'error');
            setGeneratedMaterial(null); // Clear on error
        } finally {
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
            <Card>
                <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
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
                                <div>
                                    <label htmlFor="customInstruction" className="block text-sm font-medium text-gray-700">Дополнителни инструкции за AI (опционално)</label>
                                    <textarea id="customInstruction" value={state.customInstruction} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'customInstruction', value: e.target.value } })} rows={2} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="На пр. 'Фокусирај се на примери од реалниот живот', 'Направи го текстот забавен', 'Прашањата да бидат потешки'..."></textarea>
                                </div>
                            </div>
                        </fieldset>
                    </fieldset>

                    <div data-tour="generator-generate-button" className="flex justify-end items-center pt-6 border-t mt-6 gap-4">
                         <button type="button" onClick={handleReset} disabled={isGenerating} className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors">
                            Ресетирај форма
                        </button>
                        <button 
                            type="submit" 
                            disabled={isGenerateDisabled} 
                            title={!isOnline ? 'Нема интернет конекција' : 'Генерирај'}
                            className="w-full max-w-xs flex justify-center items-center gap-2 bg-brand-secondary text-white px-4 py-3 rounded-lg disabled:bg-gray-400 hover:bg-brand-primary transition-colors font-semibold text-lg"
                        >
                            {isGenerating ? (<><ICONS.spinner className="w-6 h-6 animate-spin" /><span>Генерирам...</span></>) : (<><ICONS.sparkles className="w-6 h-6"/><span>{isOnline ? 'Генерирај' : 'Офлајн'}</span></>)}
                        </button>
                    </div>
                </form>
            </Card>

            {/* Use New Smart Loading Indicator */}
            {isGenerating && !generatedMaterial && (
                <div className="mt-6">
                    <AILoadingIndicator />
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

            {!isGenerating && !generatedMaterial && (
                <div className="mt-6"><EmptyState icon={<ICONS.generator className="w-12 h-12" />} title="Подготвени за создавање?" message="Следете ги чекорите за да го изберете саканиот контекст и параметри, потоа кликнете 'Генерирај' за да добиете материјали креирани од вештачка интелигенција." /></div>
            )}
        </div>
    );
};
