import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { geminiService } from '../../services/geminiService';
import type { Grade, Topic, ThematicPlanLesson, AIGeneratedThematicPlan } from '../../types';
import { ICONS } from '../../constants';
import { OfficialThematicPlanTable } from './OfficialThematicPlanTable';
import { saveThematicPlanEdit, loadThematicPlanEdit } from '../../services/firestoreService.plans';

interface AIThematicPlanGeneratorModalProps {
    hideModal: () => void;
    /** When set (from Annual Plan drill-down), skip selection and auto-generate */
    prefillThemeName?: string;
    prefillGradeTitle?: string;
}

export const AIThematicPlanGeneratorModal: React.FC<AIThematicPlanGeneratorModalProps> = ({
    hideModal,
    prefillThemeName,
    prefillGradeTitle,
}) => {
    const { curriculum } = useCurriculum();
    const { addNotification } = useNotification();
    const { firebaseUser } = useAuth();

    const isPrefilled = Boolean(prefillThemeName && prefillGradeTitle);

    const [selectedGradeId, setSelectedGradeId] = useState<string>(curriculum?.grades[0]?.id || '');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<AIGeneratedThematicPlan | null>(null);
    const [viewMode, setViewMode] = useState<'preview' | 'official'>('official');

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editablePlan, setEditablePlan] = useState<AIGeneratedThematicPlan | null>(null);
    const [authorName, setAuthorName] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [period, setPeriod] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);

    const selectedGradeObj = useMemo(() =>
        curriculum?.grades.find(g => g.id === selectedGradeId),
    [curriculum, selectedGradeId]);

    const topicsForGrade = useMemo(() => selectedGradeObj?.topics || [], [selectedGradeObj]);

    const selectedTopicObj = useMemo(() =>
        topicsForGrade.find(t => t.id === selectedTopicId),
    [topicsForGrade, selectedTopicId]);

    // Sync editablePlan when generatedPlan arrives + check for saved edits
    useEffect(() => {
        if (!generatedPlan) return;
        if (!firebaseUser?.uid || !selectedGradeId || !selectedTopicId) {
            setEditablePlan(generatedPlan);
            setIsEditing(false);
            return;
        }
        loadThematicPlanEdit(firebaseUser.uid, selectedGradeId, selectedTopicId).then(saved => {
            if (saved) {
                setEditablePlan(saved.plan);
                setAuthorName(prev => prev || saved.authorName);
                setSchoolName(prev => prev || saved.schoolName);
                setPeriod(prev => prev || saved.period);
                setSavedAt(new Date());
            } else {
                setEditablePlan(generatedPlan);
            }
            setIsEditing(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generatedPlan]);

    // Auto-generate when coming from Annual Plan drill-down
    useEffect(() => {
        if (!isPrefilled || !curriculum || generatedPlan || isLoading) return;

        const gradeMatch = curriculum.grades.find(g =>
            prefillGradeTitle?.includes(String(g.level)) ||
            g.title === prefillGradeTitle
        ) ?? curriculum.grades[0];

        const topicMatch = gradeMatch?.topics.find(t =>
            t.title.toLowerCase().includes((prefillThemeName ?? '').toLowerCase()) ||
            (prefillThemeName ?? '').toLowerCase().includes(t.title.toLowerCase())
        ) ?? gradeMatch?.topics[0];

        if (!gradeMatch || !topicMatch) return;

        setSelectedGradeId(gradeMatch.id);
        setSelectedTopicId(topicMatch.id);
        setIsLoading(true);
        geminiService.generateThematicPlan(gradeMatch, topicMatch)
            .then(p => setGeneratedPlan(p))
            .catch(err => addNotification((err as Error).message, 'error'))
            .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [curriculum]);

    const handleGradeChange = (gradeId: string) => {
        setSelectedGradeId(gradeId);
        const grade = curriculum?.grades.find(g => g.id === gradeId);
        if (grade && grade.topics.length > 0) {
            setSelectedTopicId(grade.topics[0].id);
        } else {
            setSelectedTopicId('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradeObj || !selectedTopicObj) {
            addNotification('Ве молиме изберете валидно одделение и тема.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const plan = await geminiService.generateThematicPlan(selectedGradeObj, selectedTopicObj);
            setGeneratedPlan(plan);
        } catch (error) {
            addNotification((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLessonChange = useCallback((idx: number, field: string, value: string | number) => {
        setEditablePlan(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                lessons: prev.lessons.map((l, i) =>
                    i === idx
                        ? { ...l, [field]: value, ...(field === 'keyActivities' ? { scenario: undefined } : {}) }
                        : l
                ),
            };
        });
    }, []);

    const handleHeaderChange = useCallback((field: 'authorName' | 'schoolName' | 'period', value: string) => {
        if (field === 'authorName') setAuthorName(value);
        if (field === 'schoolName') setSchoolName(value);
        if (field === 'period') setPeriod(value);
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleSaveEdits = async () => {
        if (!editablePlan || !firebaseUser?.uid || !selectedGradeId || !selectedTopicId) return;
        setIsSaving(true);
        try {
            await saveThematicPlanEdit(firebaseUser.uid, selectedGradeId, selectedTopicId, editablePlan, { authorName, schoolName, period });
            setSavedAt(new Date());
            addNotification('✅ Тематскиот план е зачуван!', 'success');
        } catch {
            addNotification('Грешка при зачувување. Обидете се повторно.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Standard code extraction ─────────────────────────────────────────────

    const extractStdCodes = (text: string): string[] => {
      const matches = text.match(/III-[АA]\.(\d+)/g);
      return matches ? [...new Set(matches)] : [];
    };

    const allCoveredStandards = useMemo(() => {
      if (!editablePlan) return [];
      const all = editablePlan.lessons.flatMap(l => extractStdCodes(l.learningOutcomes));
      return [...new Set(all)].sort((a, b) => {
        const na = parseInt(a.split('.')[1]); const nb = parseInt(b.split('.')[1]);
        return na - nb;
      });
    }, [editablePlan]);

    // ── Render helpers ───────────────────────────────────────────────────────

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">
                        AI асистентот ја анализира темата и ги креира наставните единици со сценарија... Ова може да потрае неколку моменти.
                    </p>
                </div>
            );
        }

        if (editablePlan) {
            if (viewMode === 'official') {
                return (
                    <div className="p-4 bg-gray-100 min-h-[400px]">
                        {isEditing && (
                            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                                <ICONS.edit className="w-4 h-4 flex-shrink-0" />
                                <span>Режим на уредување — кликни на полињата за да внесеш промени пред печатење</span>
                            </div>
                        )}
                        {allCoveredStandards.length > 0 && (
                            <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg print:hidden">
                                <p className="text-[11px] font-bold text-indigo-700 mb-1.5">📋 БРО стандарди III-А покриени во темата ({allCoveredStandards.length})</p>
                                <div className="flex flex-wrap gap-1">
                                    {allCoveredStandards.map(code => (
                                        <span key={code} className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <OfficialThematicPlanTable
                            data={editablePlan}
                            grade={selectedGradeObj}
                            topic={selectedTopicObj}
                            authorName={authorName}
                            schoolName={schoolName}
                            period={period}
                            isEditable={isEditing}
                            onLessonChange={handleLessonChange}
                            onHeaderChange={handleHeaderChange}
                        />
                    </div>
                );
            }

            // Preview mode (simplified table)
            return (
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3 text-brand-primary">{editablePlan.thematicUnit}</h3>

                    {/* БРО standards summary */}
                    {allCoveredStandards.length > 0 && (
                        <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <p className="text-xs font-bold text-indigo-700 mb-2">
                                📋 Покриени БРО стандарди III-А ({allCoveredStandards.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {allCoveredStandards.map(code => (
                                    <span
                                        key={code}
                                        className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold"
                                    >
                                        {code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-h-[55vh] overflow-y-auto overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Час</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наставна единица</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цели / Стандарди</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Активности</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Оценување</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {editablePlan.lessons.map((lesson: ThematicPlanLesson) => {
                                    const codes = extractStdCodes(lesson.learningOutcomes);
                                    return (
                                        <tr key={lesson.lessonNumber}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.lessonNumber}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-800 font-semibold">{lesson.lessonUnit}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">
                                                <span>{lesson.learningOutcomes}</span>
                                                {codes.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {codes.map(code => (
                                                            <span
                                                                key={code}
                                                                className="px-1.5 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold"
                                                            >
                                                                {code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.keyActivities}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.assessment}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        // Form — grade/topic selection
        return (
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Изберете одделение и тема, а AI асистентот ќе ви генерира предлог-план со наставни единици, цели, детални сценарија за час и активности за целата тема.
                    </p>
                    <div>
                        <label htmlFor="grade-select" className="block text-sm font-medium text-gray-700">Одделение</label>
                        <select
                            id="grade-select"
                            value={selectedGradeId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleGradeChange(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md"
                        >
                            {curriculum?.grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700">Тематска целина</label>
                        <select
                            id="topic-select"
                            value={selectedTopicId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTopicId(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md"
                            disabled={topicsForGrade.length === 0}
                        >
                            <option value="">-- Избери тема --</option>
                            {topicsForGrade.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg">
                    <button type="button" onClick={hideModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 mr-3">
                        Откажи
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary"
                        disabled={!selectedTopicId || isLoading}
                    >
                        {isLoading ? 'Генерирам...' : 'Генерирај тематски план'}
                    </button>
                </div>
            </form>
        );
    };

    const renderFooter = () => {
        if (isLoading || !editablePlan) return null;

        return (
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-b-lg border-t border-gray-200 gap-2 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => { setGeneratedPlan(null); setEditablePlan(null); setIsEditing(false); }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm"
                    >
                        Назад
                    </button>
                    {viewMode === 'official' && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(v => !v)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                                isEditing
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <ICONS.edit className="w-4 h-4" />
                            {isEditing ? 'Прегледај' : 'Уреди'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setViewMode(viewMode === 'official' ? 'preview' : 'official')}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                        <ICONS.eye className="w-4 h-4" />
                        {viewMode === 'official' ? 'Поедноставен' : 'Официјален'}
                    </button>
                </div>
                <div className="flex gap-2">
                    {firebaseUser && (
                        <button
                            type="button"
                            onClick={handleSaveEdits}
                            disabled={isSaving}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 flex items-center gap-1.5 text-sm disabled:opacity-60 transition"
                            title={savedAt ? `Последно зачувано: ${savedAt.toLocaleTimeString('mk')}` : 'Зачувај ги промените во Firestore'}
                        >
                            {isSaving
                                ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Зачувувам...</>
                                : <>{savedAt ? '✅' : <ICONS.bookmark className="w-4 h-4" />} Зачувај</>
                            }
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-2 bg-brand-accent text-white rounded-lg shadow hover:bg-opacity-90 flex items-center gap-2 text-sm"
                        title={(!authorName || !schoolName) ? 'Препорачливо е да ги пополните полињата Изготвил/-а и Училиште пред печатење' : undefined}
                    >
                        <ICONS.printer className="w-4 h-4" />
                        Испечати
                    </button>
                    <button
                        type="button"
                        onClick={hideModal}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary text-sm"
                    >
                        Затвори
                    </button>
                </div>
            </div>
        );
    };

    if (!curriculum) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={hideModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-thematic-plan-title"
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[95vh]"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h2 id="ai-thematic-plan-title" className="text-xl font-bold text-brand-primary flex items-center gap-2">
                            <ICONS.sparkles className="w-5 h-5" />
                            {isPrefilled ? (
                                <span>Тематски план: <span className="text-emerald-600">{prefillThemeName}</span></span>
                            ) : 'AI Генератор на Тематски План'}
                        </h2>
                        <button
                            type="button"
                            onClick={hideModal}
                            className="p-1 rounded-full hover:bg-gray-200"
                            aria-label="Затвори модал"
                        >
                            <ICONS.close className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1">
                    {renderContent()}
                </div>

                {/* Footer */}
                {renderFooter()}
            </div>
        </div>
    );
};
