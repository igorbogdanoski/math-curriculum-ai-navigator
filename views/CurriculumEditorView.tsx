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
    const { user, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const { curriculum, refreshPersonalOverrides } = useCurriculum();
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

    // Determine which layer this user can edit
    const isSchoolAdmin = user?.role === 'admin' || user?.role === 'school_admin';
    const ownerUid = isSchoolAdmin ? 'school_overrides' : (firebaseUser?.uid ?? null);

    useEffect(() => {
        if (!user) { navigate('/'); return; }
        if (!ownerUid) { setIsLoading(false); return; }
        curriculumOverridesService.fetchCurriculumOverrides(ownerUid)
            .catch(err => { logger.error('Error loading overrides:', err); addNotification('Грешка при вчитување.', 'error'); })
            .finally(() => setIsLoading(false));
    }, [user, ownerUid, navigate, addNotification]);

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
                ownerUid!,
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
            if (!isSchoolAdmin) refreshPersonalOverrides();
            addNotification('Концептот е успешно додаден.', 'success');
        } catch {
            addNotification('Грешка при додавање.', 'error');
        }
    };

    const handleAddTopic = async () => {
        if (!isAddingTopic || !newTopic.title || !user || !ownerUid) return;
        try {
            await curriculumOverridesService.addTopicOverride(
                ownerUid,
                isAddingTopic.gradeId,
                {
                    title: newTopic.title,
                    description: newTopic.description || '',
                    suggestedHours: newTopic.suggestedHours || 4
                }
            );
            setIsAddingTopic(null);
            setNewTopic({ title: '', description: '', suggestedHours: 4 });
            if (!isSchoolAdmin) refreshPersonalOverrides();
            addNotification('Темата е успешно додадена.', 'success');
        } catch {
            addNotification('Грешка при додавање.', 'error');
        }
    };

    const handleDeleteConcept = (conceptId: string) => {
        if (!ownerUid) return;
        setConfirmDialog({
            message: 'Дали сте сигурни дека сакате да го избришете овој концепт?',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await curriculumOverridesService.deleteConceptOverride(ownerUid, conceptId);
                    if (!isSchoolAdmin) refreshPersonalOverrides();
                    addNotification('Избришано.', 'success');
                } catch {
                    addNotification('Грешка при бришење.', 'error');
                }
            }
        });
    };

    if (isLoading) return <div className="p-8 text-center">Вчитување...</div>;

    return (
        <>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-brand-primary" />
                            Уредувач на Наставна Програма
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {isSchoolAdmin
                                ? '🏫 Уредувате го Училишниот слој — видливо за сите наставници'
                                : '👤 Уредувате го вашиот Личен слој — само за ваша употреба'}
                        </p>
                    </div>
                </div>
                {/* UNESCO 4-layer visual */}
                <div className="flex items-center gap-1 text-xs font-semibold overflow-x-auto">
                    {[
                        { label: '🏛 Национален (БРО)', cls: 'bg-gray-100 text-gray-500', active: false },
                        { label: '🏫 Училишен', cls: isSchoolAdmin ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700', active: isSchoolAdmin },
                        { label: '👤 Личен', cls: !isSchoolAdmin ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700', active: !isSchoolAdmin },
                        { label: '📋 Час (Сценарио)', cls: 'bg-gray-100 text-gray-500', active: false },
                    ].map((l, i, arr) => (
                        <React.Fragment key={l.label}>
                            <span className={`px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${l.cls} ${l.active ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                                {l.label}
                            </span>
                            {i < arr.length - 1 && <span className="text-gray-300 shrink-0">→</span>}
                        </React.Fragment>
                    ))}
                </div>
            </header>

            <div className={`border rounded-xl p-4 flex gap-3 text-sm ${isSchoolAdmin ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                    {isSchoolAdmin
                        ? 'Училишниот слој е видлив за СИТЕ наставници. Националната програма (БРО) останува недопрена. Вашите додатоци се прикажуваат на сите наставници во планерот.'
                        : 'Личниот слој е само за вас. Националната и Училишната програма се наследуваат автоматски. Вашите лични додатоци се видливи само во вашиот план.'
                    }
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
                                                const isSchoolCustom = concept.id.startsWith('custom_') && concept.id.includes('school_overrides'.slice(-6));
                                                const isPersonalCustom = concept.id.startsWith('custom_') && !isSchoolCustom;
                                                const isCustom = concept.id.startsWith('custom_');
                                                // Can delete only your own layer
                                                const canDelete = isCustom && (isSchoolAdmin ? isSchoolCustom || !isPersonalCustom : isPersonalCustom);
                                                return (
                                                    <div key={concept.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                                                        isPersonalCustom ? 'bg-emerald-50/50 border-emerald-100'
                                                        : isSchoolCustom ? 'bg-indigo-50/50 border-indigo-100'
                                                        : 'bg-gray-50 border-gray-100'
                                                    }`}>
                                                        <div className="min-w-0">
                                                            <span className="text-sm font-medium text-gray-700">{concept.title}</span>
                                                            {isSchoolCustom && <span className="ml-2 text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">🏫 Училишен</span>}
                                                            {isPersonalCustom && <span className="ml-2 text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">👤 Личен</span>}
                                                        </div>
                                                        {canDelete && (
                                                            <button
                                                                type="button"
                                                                title="Избриши концепт"
                                                                onClick={() => handleDeleteConcept(concept.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
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
