import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { GradeSelector } from '../components/curriculum/GradeSelector';
import { ICONS } from '../constants';
import { AIGeneratedAnnualPlan } from '../types';
import { geminiService } from '../services/geminiService';
import { useLanguage } from '../i18n/LanguageContext';
import { useCurriculum } from '../hooks/useCurriculum';


interface SortableTopicProps {
    topic: AIGeneratedAnnualPlanTopic;
    id: string; // Use index or unique string as id
    idx: number;
}

const SortableTopic: React.FC<SortableTopicProps> = ({ topic, id, idx }) => {
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
                        {/* Drag Handle Icon Inline */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <span className="bg-white border text-gray-600 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-sm">
                        {idx + 1}
                    </span>
                    {topic.title}
                </h3>
                <span className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-100 flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {topic.durationWeeks} недели
                </span>
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


interface SortableTopicProps {
    topic: AIGeneratedAnnualPlanTopic;
    id: string; // Use index or unique string as id
    idx: number;
}

const SortableTopic: React.FC<SortableTopicProps> = ({ topic, id, idx }) => {
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
                        {/* Drag Handle Icon Inline */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </div>
                    <span className="bg-white border text-gray-600 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-sm">
                        {idx + 1}
                    </span>
                    {topic.title}
                </h3>
                <span className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-full shadow-sm border border-blue-100 flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {topic.durationWeeks} недели
                </span>
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

export const AnnualPlanGeneratorView: React.FC = () => {
    const { t } = useLanguage();
    const { curriculum } = useCurriculum();
    const [selectedGradeId, setSelectedGradeId] = useState<string>('grade-6');
    const [subject, setSubject] = useState<string>('Математика');
    const [weeks, setWeeks] = useState<number>(36);
    const [isGenerating, setIsGenerating] = useState(false);
    const [plan, setPlan] = useState<AIGeneratedAnnualPlan | null>(null);

    const { user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);

    
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
        if (!user || !plan) return;
        setIsSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'academic_annual_plans'), {
                userId: user.uid,
                createdAt: serverTimestamp(),
                planData: plan,
                grade: plan.grade,
                subject: plan.subject
            });
            setSavedId(docRef.id);
            alert("Програмата е успешно зачувана во облак!");
        } catch (error) {
            console.error("Грешка при зачувување:", error);
            alert("Грешка при зачувување на програмата.");
        } finally {
            setIsSaving(false);
        }
    };


    const { user } = useAuth();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Годишна_Програма_${plan?.subject}_${plan?.grade}`,
    });

    const handleSave = async () => {
        if (!user || !plan) return;
        setIsSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'academic_annual_plans'), {
                userId: user.uid,
                createdAt: serverTimestamp(),
                planData: plan,
                grade: plan.grade,
                subject: plan.subject
            });
            setSavedId(docRef.id);
            alert("Програмата е успешно зачувана во облак!");
        } catch (error) {
            console.error("Грешка при зачувување:", error);
            alert("Грешка при зачувување на програмата.");
        } finally {
            setIsSaving(false);
        }
    };


    const handleGenerate = async () => {
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
                const generated = await geminiService.generateAnnualPlan(gradeName, subject, weeks, curriculumContext);
                setPlan(generated);
                setPlan(generated);
                setPlan(generated);
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
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        {ICONS.planner} AI Годишна Програма
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Автоматско генерирање на структуриран годишен план (Annual Curriculum Planner)
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <h2 className="text-xl font-bold mb-4">Параметри</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Одделение
                                </label>
                                <GradeSelector
                                    selectedGradeId={selectedGradeId}
                                    onGradeSelect={setSelectedGradeId}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Предмет
                                </label>
                                <input 
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Вкупно недели
                                </label>
                                <input 
                                    type="number"
                                    min="20"
                                    max="40"
                                    value={weeks}
                                    onChange={(e) => setWeeks(Number(e.target.value))}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <Button 
                                onClick={handleGenerate} 
                                isLoading={isGenerating}
                                className="w-full"
                                icon={ICONS.sparkles}
                            >
                                Генерирај Програма
                            </Button>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    {plan ? (
                        <Card>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">
                                    Годишна Програма: {plan.subject} ({plan.grade})
                                </h2>
                                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                                    Вкупно: {plan.totalWeeks} недели
                                </span>
                            </div>
                            
                            <div className="space-y-6 print:p-8 print:bg-white" ref={printRef}>
                                {plan.topics.map((topic, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                <span className="bg-white text-gray-600 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">
                                                    {idx + 1}
                                                </span>
                                                {topic.title}
                                            </h3>
                                            <span className="text-sm font-medium text-gray-600 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                                                {topic.durationWeeks} недели
                                            </span>
                                        </div>
                                        
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-white p-3 rounded-lg border border-gray-100">
                                                <h4 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-1">
                                                    {ICONS.assessment} Цели
                                                </h4>
                                                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                                                    {topic.objectives.map((obj, i) => (
                                                        <li key={i}>{obj}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-gray-100">
                                                <h4 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-1">
                                                    {ICONS.sparkles} Активности
                                                </h4>
                                                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                                                    {topic.suggestedActivities.map((act, i) => (
                                                        <li key={i}>{act}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50/50">
                            <div>
                                <div className="text-4xl mb-4 text-gray-300">{ICONS.planner}</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">Нема генерирано програма</h3>
                                <p className="text-gray-500">
                                    Споделете ги параметрите и кликнете "Генерирај Програма" за да создадете нова годишна програма со помош на AI.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
