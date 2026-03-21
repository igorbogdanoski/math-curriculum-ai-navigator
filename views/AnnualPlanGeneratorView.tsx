import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { fetchAnnualPlanById, updateAnnualPlan, createAnnualPlan } from '../services/firestoreService.materials';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../types';
import { geminiService } from '../services/geminiService';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { generatePlanICS, downloadICS } from '../utils/icalExport';


interface SortableTopicProps {
    topic: AIGeneratedAnnualPlanTopic;
    id: string;
    idx: number;
    onGenerateLesson: () => void;
}

const SortableTopic: React.FC<SortableTopicProps> = ({ topic, id, idx, onGenerateLesson }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: isDragging ? 'relative' as const : 'static' as const,
        opacity: isDragging ? 0.9 : 1,
        boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
    };

    return (
        <div ref={setNodeRef} style={style} className="border border-gray-200 rounded-xl bg-gray-50 mb-6 bg-white overflow-hidden transition-all duration-200">
            <div className="flex justify-between items-center p-4 bg-gray-100/50 border-b border-gray-200" {...attributes} {...listeners} style={{ cursor: 'grab' }}>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-3">
                    <div className="text-gray-400 hover:text-gray-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <span className="bg-white border text-gray-600 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-sm">
                        {idx + 1}
                    </span>
                    {topic.title}
                </h3>
                <div className="flex items-center gap-2" onPointerDown={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={onGenerateLesson}
                        title="Генерирај план за час за оваа тема"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3L2 12h3v8h14v-8h3L12 3z"/></svg>
                        Генерирај Час
                    </button>
                    <span className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-100 flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {topic.durationWeeks} нед.
                    </span>
                </div>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-primary text-sm mb-3 flex items-center gap-2">
                        {/* Assessment Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Очекувани резултати / Цели
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.objectives.map((obj, i) => (
                            <li key={i} className="leading-snug">{obj}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-brand-accent text-sm mb-3 flex items-center gap-2">
                        {/* Sparkles Icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 21v-8a2 2 0 0 1 2-2h8"></path><polygon points="16 7 20 11 16 15"></polygon><line x1="4" y1="11" x2="10" y2="11"></line></svg>
                        Предложени активности
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
                        {topic.suggestedActivities.map((act, i) => (
                            <li key={i} className="leading-snug">{act}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

interface AnnualPlanGeneratorViewProps {
    planId?: string; // when set → edit mode (load + update)
}

export const AnnualPlanGeneratorView: React.FC<AnnualPlanGeneratorViewProps> = ({ planId }) => {
    const { curriculum } = useCurriculum();
    const [selectedGradeId, setSelectedGradeId] = useState<string>('grade-6');
    const [subject, setSubject] = useState<string>('Математика');
    const [weeks, setWeeks] = useState<number>(36);
    const [currentStep, setCurrentStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [plan, setPlan] = useState<AIGeneratedAnnualPlan | null>(null);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    const { user, firebaseUser, updateLocalProfile } = useAuth();
    const { addNotification } = useNotification();
    const { navigate } = useNavigation();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const handleSaveRef = useRef<() => void>(() => {});
    const [subjectError, setSubjectError] = useState('');

    // Edit mode — load existing plan by planId
    useEffect(() => {
        if (!planId) return;
        setIsLoadingExisting(true);
        fetchAnnualPlanById(planId).then(doc => {
            if (doc) {
                setPlan(doc.planData);
                setSubject(doc.planData.subject);
                setWeeks(doc.planData.totalWeeks);
                setSavedId(planId); // already saved
                setCurrentStep(3); // jump straight to preview/edit
            } else {
                addNotification('Планот не е пронајден.', 'error');
            }
        }).catch(() => addNotification('Грешка при вчитување на планот.', 'error'))
          .finally(() => setIsLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId]);

    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id && plan) {
            const oldIndex = parseInt(active.id.split('-')[1]);
            const newIndex = parseInt(over.id.split('-')[1]);
            
            const newPlan = { ...plan };
            newPlan.topics = arrayMove(newPlan.topics, oldIndex, newIndex);
            
            setPlan(newPlan);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Годишна_Програма_${plan?.subject}_${plan?.grade}`,
    });

    const handleSave = async () => {
        if (!user || !plan || !firebaseUser?.uid) return;
        setIsSaving(true);
        try {
            if (planId) {
                // Edit mode — update existing document
                await updateAnnualPlan(planId, plan);
                setSavedId(planId);
                addNotification("Промените се успешно зачувани!", 'success');
            } else {
                // Create mode — new document
                const newId = await createAnnualPlan(firebaseUser.uid, plan);
                setSavedId(newId);
                addNotification("Програмата е успешно зачувана во облак!", 'success');
            }
        } catch (error) {
            console.error("Грешка при зачувување:", error);
            addNotification("Грешка при зачувување на програмата.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Keep ref in sync so the Cmd+S effect always calls the latest version
    handleSaveRef.current = handleSave;

    // Cmd+S / Ctrl+S — save annual plan from anywhere in the view
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSaveRef.current();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []); // runs once; ref keeps value fresh

    const handleGenerate = async () => {
        const cost = 10; // AI_COSTS.ANNUAL_PLAN
        
        if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
            if ((user.aiCreditsBalance || 0) < cost) {
                window.dispatchEvent(new CustomEvent('openUpgradeModal', { 
                    detail: { reason: `Останавте без AI кредити! Генерирањето на годишна програма чини ${cost} кредити. Надградете на Pro пакет.` }
                }));
                return;
            }
        }

        setIsGenerating(true);
        try {
            // Extract curriculum data to inject into prompt
            const gradeData = curriculum?.grades.find(g => g.id === selectedGradeId);
            const gradeName = gradeData?.title || gradeData?.id || selectedGradeId;
            let curriculumContext = '';
            
            if (gradeData && gradeData.topics && gradeData.topics.length > 0) {
                curriculumContext = gradeData.topics.map((t, idx) => {
                    let desc = `- Тема ${idx + 1}: ${t.title}`;
                    if (t.suggestedHours) desc += ` (Препорачани часови: ${t.suggestedHours} часа)`;
                    if (t.topicLearningOutcomes && t.topicLearningOutcomes.length > 0) {
                        desc += `\n  Очекувани резултати: ${t.topicLearningOutcomes.slice(0, 3).join('; ')}...`;
                    }
                    return desc;
                }).join('\n\n');
            } else {
                curriculumContext = "Нема специфични теми во системот за ова одделение. Генерирајте општи теми по математика.";
            }

            if (geminiService.generateAnnualPlan) {
                const generated = await geminiService.generateAnnualPlan(gradeName, subject, weeks, curriculumContext, user || undefined);
                setPlan(generated);
                
                // Deduct credits
                if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
                    try {
                        const { getFunctions, httpsCallable } = await import('firebase/functions');
                        const { app } = await import('../firebaseConfig');
                        const functions = getFunctions(app);
                        const deductFn = httpsCallable(functions, 'deductCredits');
                        await deductFn({ amount: cost });
                        // Update local state
                        updateLocalProfile({ aiCreditsBalance: (user.aiCreditsBalance || 0) - cost });
                    } catch (err) {
                        console.error("Error deducting credits:", err);
                    }
                }
            } else {
                console.warn("geminiService.generateAnnualPlan is not implemented yet!");
                // Mock for now so UI works
                setPlan({
                    grade: selectedGradeId,
                    subject,
                    totalWeeks: weeks,
                    topics: [
                        {
                            title: 'Броеви и операции',
                            durationWeeks: 6,
                            objectives: ['Читање и пишување броеви до 1000', 'Соберување и одземање'],
                            suggestedActivities: ['Игри со карти со броеви', 'Решавање текстуални задачи']
                        },
                        {
                            title: 'Геометрија',
                            durationWeeks: 4,
                            objectives: ['Препознавање 2Д и 3Д форми', 'Мерење агли'],
                            suggestedActivities: ['Цртање форми', 'Работа со гео-табла']
                        }
                    ]
                });
            }
        } catch (error) {
            console.error('Failed to generate plan:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {isLoadingExisting && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mr-4" />
                    <span className="text-gray-500 font-medium">Вчитување на планот...</span>
                </div>
            )}
            {!isLoadingExisting && (
            <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ICONS.planner className="w-8 h-8" />
                        {planId ? 'Уреди Годишна Програма' : 'AI Годишна Програма'}
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {planId
                            ? 'Уредувате постоечка програма — промените ќе се зачуваат на истото место.'
                            : 'Автоматско генерирање на структуриран годишен план (Annual Curriculum Planner)'}
                    </p>
                </div>
            </div>

            {/* Progress Stepper */}
            <div className="mb-10 w-full px-2 relative flex items-center justify-between max-w-2xl mx-auto">
                <div className="absolute left-[10%] right-[10%] top-5 h-[2px] bg-gray-200 -z-10">
                    <div className="h-full bg-blue-600 transition-all duration-300 ease-in-out" style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>
                </div>
                
                {[
                    { step: 1, label: 'Одделение & Предмет' },
                    { step: 2, label: 'Параметри' },
                    { step: 3, label: 'Генерирање & Преглед' }
                ].map((s) => (
                    <div key={s.step} className="flex flex-col items-center gap-2 text-center">
                        <button 
                            type="button"
                            onClick={() => s.step < currentStep || (plan && s.step === 3) ? setCurrentStep(s.step) : null}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 z-10
                                ${currentStep === s.step 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' 
                                    : currentStep > s.step 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : 'bg-white border-gray-200 text-gray-400'
                                }`}
                        >
                            {currentStep > s.step ? '✓' : s.step}
                        </button>
                        <span className={`text-[10px] sm:text-xs font-bold transition-colors ${currentStep === s.step ? 'text-blue-600' : 'text-gray-500'}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="max-w-4xl mx-auto">
                {currentStep === 1 && (
                    <Card className="animate-fade-in p-8">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">1</span>
                            Изберете Одделение и Предмет
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Одделение</label>
                                <select
                                    title="Одделение"
                                    className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium"
                                    value={selectedGradeId}
                                    onChange={(e) => setSelectedGradeId(e.target.value)}
                                >
                                    {curriculum?.grades.map(g => (
                                        <option key={g.id} value={g.id}>{g.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Предмет</label>
                                <input
                                    type="text"
                                    title="Предмет"
                                    placeholder="пр. Математика"
                                    value={subject}
                                    onChange={(e) => { setSubject(e.target.value); if (subjectError) setSubjectError(''); }}
                                    className={`w-full p-3 border-2 rounded-xl bg-gray-50 focus:bg-white outline-none transition-all font-medium ${subjectError ? 'border-red-400 focus:border-red-500' : 'border-gray-100 focus:border-blue-500'}`}
                                />
                                {subjectError && <p className="mt-1 text-xs text-red-500">{subjectError}</p>}
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!subject.trim()) { setSubjectError('Внесете назив на предметот.'); return; }
                                    setCurrentStep(2);
                                }}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                Следно <ICONS.chevronDown className="w-5 h-5 -rotate-90" />
                            </button>
                        </div>
                    </Card>
                )}

                {currentStep === 2 && (
                    <Card className="animate-fade-in p-8">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">2</span>
                            Параметри на планирањето
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                                    <span>Вкупно недели во учебната година</span>
                                    <span className="text-blue-600">{weeks} недели</span>
                                </label>
                                <input
                                    type="range"
                                    title="Број на недели"
                                    min="20"
                                    max="40"
                                    value={weeks}
                                    onChange={(e) => setWeeks(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                                    <span>20 недели</span>
                                    <span>36 недели (Стандардно)</span>
                                    <span>40 недели</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between">
                            <button 
                                onClick={() => setCurrentStep(1)}
                                className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <ICONS.chevronDown className="w-5 h-5 rotate-90" /> Назад
                            </button>
                            <button 
                                onClick={() => { setCurrentStep(3); if (!plan) handleGenerate(); }}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                Генерирај <ICONS.sparkles className="w-5 h-5" />
                            </button>
                        </div>
                    </Card>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        {!plan && isGenerating ? (
                            <Card className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Генерирање на Годишна Програма</h3>
                                <p className="text-gray-500 max-w-sm">AI ги анализира националните стандарди и ги распределува темите за Вашето одделение...</p>
                            </Card>
                        ) : plan ? (
                            <Card>
                                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            {plan.subject} ({plan.grade})
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-1">Повлечи ги темите за да го смениш редоследот</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                                            {plan.totalWeeks} недели
                                        </span>
                                        {user && (
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                title="Зачувај (Ctrl+S)"
                                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
                                            >
                                                {isSaving
                                                    ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Зачувувам...</>
                                                    : savedId && !planId ? '✓ Зачувано' : planId ? 'Ажурирај' : 'Зачувај'}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                const ics = generatePlanICS(plan);
                                                downloadICS(ics, `Годишна_Програма_${plan.subject}_${plan.grade}.ics`);
                                            }}
                                            className="p-2 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition text-gray-600"
                                            title="iCal Експорт"
                                        >
                                            📅
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="p-2 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition text-gray-600"
                                            title="Печати"
                                        >
                                            🖨️
                                        </button>
                                    </div>
                                </div>

                                <div className="print:p-8 print:bg-white" ref={printRef}>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext
                                            items={plan.topics.map((_, idx) => `topic-${idx}`)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {plan.topics.map((topic, idx) => (
                                                <SortableTopic
                                                    key={`topic-${idx}`}
                                                    id={`topic-${idx}`}
                                                    topic={topic}
                                                    idx={idx}
                                                    onGenerateLesson={() => {
                                                        const params = new URLSearchParams({
                                                            prefillTopic: topic.title,
                                                            prefillGrade: plan.grade,
                                                            prefillSubject: plan.subject,
                                                        });
                                                        navigate(`/planner/lesson/new?${params.toString()}`);
                                                    }}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                                <div className="mt-8 pt-6 border-t flex justify-start">
                                    <button 
                                        onClick={() => setCurrentStep(2)}
                                        className="px-6 py-3 text-blue-600 font-bold hover:bg-blue-50 rounded-xl transition-all"
                                    >
                                        ← Назад кон параметри
                                    </button>
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-12 text-center">
                                <div className="mb-4 text-gray-300 flex justify-center"><ICONS.planner className="w-12 h-12" /></div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">Грешка при генерирање</h3>
                                <p className="text-gray-500 mb-6">Настана грешка. Ве молиме обидете се повторно.</p>
                                <button onClick={() => setCurrentStep(2)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Обиди се повторно</button>
                            </Card>
                        )}
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    );
};
