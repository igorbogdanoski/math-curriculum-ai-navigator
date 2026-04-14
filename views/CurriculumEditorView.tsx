import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useNotification } from '../contexts/NotificationContext';
import { 
    curriculumOverridesService,
    type CustomConcept,
    type CustomTopic
} from '../services/firestoreService.curriculumOverrides';
import {
    BookOpen,
    Plus,
    Trash2,
    ChevronRight,
    ChevronDown,
    X,
    Info
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const CurriculumEditorView: React.FC = () => {
    const { user } = useAuth();
    const { navigate } = useNavigation();
    const { curriculum } = useCurriculum();
    const { addNotification } = useNotification();
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
    const [isAddingConcept, setIsAddingConcept] = useState<{ gradeId: string; topicId: string } | null>(null);
    const [isAddingTopic, setIsAddingTopic] = useState<{ gradeId: string } | null>(null);

    // Form states
    const [newConcept, setNewConcept] = useState<Partial<CustomConcept>>({
        title: '',
        description: '',
        assessmentStandards: [],
        activities: [],
        priorKnowledgeIds: []
    });
    const [newTopic, setNewTopic] = useState<Partial<CustomTopic>>({
        title: '',
        description: '',
        suggestedHours: 4
    });

    useEffect(() => {
        if (!user || (user.role !== 'school_admin' && user.role !== 'admin')) {
            navigate('/');
            return;
        }

        const loadOverrides = async () => {
            try {
                // For now, using 'school_overrides' as well-known key as per hook
                await curriculumOverridesService.fetchCurriculumOverrides('school_overrides');
            } catch (error) {
                logger.error('Error loading overrides:', error);
                addNotification('Грешка при вчитување на промените.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadOverrides();
    }, [user, navigate, addNotification]);

    const toggleGrade = (gradeId: string) => {
        setExpandedGrades(prev => {
            const next = new Set(prev);
            if (next.has(gradeId)) next.delete(gradeId);
            else next.add(gradeId);
            return next;
        });
    };

    const handleAddConcept = async () => {
        if (!isAddingConcept || !newConcept.title || !user) return;
        
        try {
            await curriculumOverridesService.addConceptOverride(
                'school_overrides',
                isAddingConcept.gradeId,
                isAddingConcept.topicId,
                {
                    title: newConcept.title,
                    description: newConcept.description || '',
                    assessmentStandards: newConcept.assessmentStandards || [],
                    activities: newConcept.activities || [],
                    priorKnowledgeIds: newConcept.priorKnowledgeIds || []
                }
            );
            
            setIsAddingConcept(null);
            setNewConcept({ title: '', description: '', assessmentStandards: [], activities: [], priorKnowledgeIds: [] });
            addNotification('Концептот е успешно додаден.', 'success');
        } catch (error) {
            addNotification('Грешка при додавање.', 'error');
        }
    };

    const handleAddTopic = async () => {
        if (!isAddingTopic || !newTopic.title || !user) return;
        
        try {
            await curriculumOverridesService.addTopicOverride(
                'school_overrides',
                isAddingTopic.gradeId,
                {
                    title: newTopic.title,
                    description: newTopic.description || '',
                    suggestedHours: newTopic.suggestedHours || 4
                }
            );
            
            setIsAddingTopic(null);
            setNewTopic({ title: '', description: '', suggestedHours: 4 });
            addNotification('Темата е успешно додадена.', 'success');
        } catch (error) {
            addNotification('Грешка при додавање.', 'error');
        }
    };

    const handleDeleteConcept = (conceptId: string) => {
        setConfirmDialog({
            message: 'Дали сте сигурни дека сакате да го избришете овој концепт?',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await curriculumOverridesService.deleteConceptOverride('school_overrides', conceptId);
                    await curriculumOverridesService.fetchCurriculumOverrides('school_overrides');
                        addNotification('Избришано.', 'success');
                } catch (error) {
                    addNotification('Грешка при бришење.', 'error');
                }
            }
        });
    };

    if (isLoading) return <div className="p-8 text-center">Вчитување...</div>;

    return (
        <>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-brand-primary" />
                        Уредувач на Наставна Програма
                    </h1>
                    <p className="text-gray-500 mt-1">Додадете ваши теми и концепти специфични за вашето училиште.</p>
                </div>
            </header>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                <Info className="w-5 h-5 shrink-0" />
                <p>
                    Сите измени направени тука ќе бидат видливи за **сите наставници** во вашето училиште. 
                    Статичката национална програма останува недопрена, а вашите додатоци се прикажуваат како дополнителни опции во планерот и генераторот.
                </p>
            </div>

            <div className="space-y-4">
                {curriculum?.grades.map(grade => (
                    <div key={grade.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <button 
                            onClick={() => toggleGrade(grade.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-primary/10 rounded-lg">
                                    <span className="font-bold text-brand-primary">{grade.level}</span>
                                </div>
                                <span className="font-bold text-gray-900">{grade.title}</span>
                            </div>
                            {expandedGrades.has(grade.id) ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                        </button>

                        {expandedGrades.has(grade.id) && (
                            <div className="p-4 bg-gray-50/30 border-t border-gray-100 space-y-4">
                                {/* Existing Topics in this Grade */}
                                {grade.topics.map(topic => (
                                    <div key={topic.id} className="bg-white rounded-xl border border-gray-200 p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-gray-800">{topic.title}</h3>
                                            <button 
                                                onClick={() => setIsAddingConcept({ gradeId: grade.id, topicId: topic.id })}
                                                className="flex items-center gap-1 text-xs font-bold text-brand-primary hover:bg-brand-primary/5 px-2 py-1 rounded-lg transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Додај концепт
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {topic.concepts.map(concept => {
                                                const isCustom = concept.id.startsWith('custom_');
                                                return (
                                                    <div key={concept.id} className={`flex items-center justify-between p-3 rounded-lg border ${isCustom ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">{concept.title}</span>
                                                            {isCustom && <span className="ml-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Ваш додаток</span>}
                                                        </div>
                                                        {isCustom && (
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleDeleteConcept(concept.id)}
                                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {isAddingConcept?.topicId === topic.id && (
                                            <div className="mt-4 p-4 border-2 border-dashed border-brand-primary/30 rounded-xl bg-brand-primary/5 animate-fade-in">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-bold text-sm text-brand-primary">Нов наставен концепт</h4>
                                                    <button type="button" aria-label="Откажи" onClick={() => setIsAddingConcept(null)}><X className="w-4 h-4 text-gray-400" /></button>
                                                </div>
                                                <div className="space-y-3">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Наслов на концептот..."
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                        value={newConcept.title}
                                                        onChange={e => setNewConcept(prev => ({ ...prev, title: e.target.value }))}
                                                    />
                                                    <textarea 
                                                        placeholder="Опис / Цели..."
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20"
                                                        value={newConcept.description}
                                                        onChange={e => setNewConcept(prev => ({ ...prev, description: e.target.value }))}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setIsAddingConcept(null)}
                                                            className="px-4 py-2 text-sm font-medium text-gray-500"
                                                        >
                                                            Откажи
                                                        </button>
                                                        <button 
                                                            onClick={handleAddConcept}
                                                            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold shadow-sm"
                                                        >
                                                            Зачувај
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button 
                                    onClick={() => setIsAddingTopic({ gradeId: grade.id })}
                                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-brand-primary hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all flex items-center justify-center gap-2 font-bold text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Додај нова Тема во {grade.title}
                                </button>

                                {isAddingTopic?.gradeId === grade.id && (
                                    <div className="p-4 border-2 border-dashed border-brand-primary/30 rounded-xl bg-brand-primary/5 animate-fade-in">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-sm text-brand-primary">Нова наставна тема</h4>
                                            <button type="button" aria-label="Откажи" onClick={() => setIsAddingTopic(null)}><X className="w-4 h-4 text-gray-400" /></button>
                                        </div>
                                        <div className="space-y-3">
                                            <input 
                                                type="text" 
                                                placeholder="Наслов на темата (пр. Вештачка Интелигенција во Математика)..."
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                                                value={newTopic.title}
                                                onChange={e => setNewTopic(prev => ({ ...prev, title: e.target.value }))}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setIsAddingTopic(null)}
                                                    className="px-4 py-2 text-sm font-medium text-gray-500"
                                                >
                                                    Откажи
                                                </button>
                                                <button 
                                                    onClick={handleAddTopic}
                                                    className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold shadow-sm"
                                                >
                                                    Зачувај Тема
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
        {confirmDialog && (
            <ConfirmDialog
                message={confirmDialog.message}
                title={confirmDialog.title}
                variant={confirmDialog.variant ?? 'warning'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        )}
        </>
    );
};
