import React, { useEffect, useMemo, useState } from 'react';

import { AlertTriangle, CheckSquare, ClipboardCheck, Loader2, Square, Users, Wand2, X } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { firestoreService, type SchoolClass } from '../../services/firestoreService';
import type { AIGeneratedAssessment } from '../../types';

interface Props {
    conceptId: string;
    conceptTitle: string;
    misconceptions: { text: string; count: number }[];
    strugglingStudents: string[];
    classes: SchoolClass[];
    teacherUid: string;
    gradeLevel: number;
    topicId?: string;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

export const RecoveryWorksheetPreviewModal: React.FC<Props> = ({
    conceptId,
    conceptTitle,
    misconceptions,
    strugglingStudents,
    classes,
    teacherUid,
    gradeLevel,
    topicId,
    onClose,
    onSuccess,
}) => {
    const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
    const [dueDate, setDueDate] = useState(defaultDue);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set(strugglingStudents));
    const [worksheet, setWorksheet] = useState<AIGeneratedAssessment | null>(null);
    const [teacherNotes, setTeacherNotes] = useState('');
    const [excludedQuestionIds, setExcludedQuestionIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'generating' | 'review' | 'saving' | 'assigning'>('generating');

    const selectedClass = useMemo(
        () => classes.find(c => c.id === selectedClassId),
        [classes, selectedClassId],
    );

    const classStruggling = useMemo(() => {
        if (!selectedClass) return strugglingStudents;
        const inClass = new Set(selectedClass.studentNames);
        const matched = strugglingStudents.filter(s => inClass.has(s));
        return matched.length > 0 ? matched : strugglingStudents;
    }, [selectedClass, strugglingStudents]);

    const activeQuestions = useMemo(
        () => (worksheet?.questions ?? []).filter(q => !excludedQuestionIds.has(q.id ?? -1)),
        [worksheet, excludedQuestionIds],
    );

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        setStep('generating');

        geminiService.generateRecoveryWorksheet(conceptTitle, misconceptions, gradeLevel)
            .then(result => {
                if (!active) return;
                setWorksheet(result);
                setStep('review');
            })
            .catch(err => {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Грешка при генерирање recovery worksheet.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [conceptTitle, misconceptions, gradeLevel]);

    useEffect(() => {
        setSelectedStudents(new Set(classStruggling));
    }, [classStruggling]);

    const toggleStudent = (name: string) => {
        setSelectedStudents(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleAllStudents = () => {
        if (selectedStudents.size === classStruggling.length) setSelectedStudents(new Set());
        else setSelectedStudents(new Set(classStruggling));
    };

    const toggleQuestion = (questionId?: number) => {
        if (questionId == null) return;
        setExcludedQuestionIds(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
            return next;
        });
    };

    const handleApproveAndAssign = async () => {
        if (!worksheet || !selectedClassId || selectedStudents.size === 0 || activeQuestions.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            setStep('saving');
            const approvalRef = await firestoreService.saveRecoveryWorksheetApproval({
                teacherUid,
                conceptId,
                topicId,
                gradeLevel,
                title: worksheet.title,
                approvedQuestionCount: activeQuestions.length,
                removedQuestionIds: Array.from(excludedQuestionIds),
                teacherNotes: teacherNotes.trim() || undefined,
                classId: selectedClassId,
                assignedStudentCount: selectedStudents.size,
            });

            const finalWorksheet: AIGeneratedAssessment = {
                ...worksheet,
                questions: activeQuestions,
            };

            const cacheId = await firestoreService.saveAssignmentMaterial(finalWorksheet, {
                title: finalWorksheet.title,
                type: 'ASSESSMENT',
                conceptId,
                topicId,
                gradeLevel,
                teacherUid,
                isRecoveryWorksheet: true,
                reviewStatus: 'approved',
                teacherNotes: teacherNotes.trim() || undefined,
                approvalRef,
                removedQuestionIds: Array.from(excludedQuestionIds),
            });

            setStep('assigning');
            const studentList = Array.from(selectedStudents);
            await firestoreService.saveAssignment({
                title: finalWorksheet.title,
                materialType: 'ASSESSMENT',
                cacheId,
                teacherUid,
                classId: selectedClassId,
                classStudentNames: studentList,
                dueDate,
                completedBy: [],
            });

            onSuccess(studentList.length);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Грешка при одобрување и доделување.');
        } finally {
            setLoading(false);
            setStep('review');
        }
    };

    const stepLabel = step === 'generating'
        ? 'Генерирам worksheet…'
        : step === 'saving'
        ? 'Зачувувам approval…'
        : step === 'assigning'
        ? 'Доделувам…'
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                            Recovery Worksheet — teacher confirm
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            <span className="font-semibold text-gray-700">{conceptTitle}</span>
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading}
                        title="Затвори recovery worksheet modal"
                        aria-label="Затвори recovery worksheet modal"
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
                    <div className="space-y-4">
                        {misconceptions.length > 0 && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1 mb-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Target misconceptions ({misconceptions.length})
                                </p>
                                <ul className="space-y-1">
                                    {misconceptions.slice(0, 4).map((m, i) => (
                                        <li key={i} className="text-xs text-slate-700">
                                            <span className="font-semibold">„{m.text}"</span>
                                            <span className="text-gray-400 ml-1">— {m.count} ученик{m.count === 1 ? '' : 'и'}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {loading && !worksheet && (
                            <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-4 text-sm text-emerald-700 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {stepLabel}
                            </div>
                        )}

                        {error && (
                            <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {worksheet && (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <Wand2 className="w-4 h-4 text-emerald-600" />
                                        {worksheet.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">Одобри ги прашањата што сакаш да останат во worksheet-от. Исклучените прашања нема да се доделат.</p>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {worksheet.questions.map((question, index) => {
                                        const qid = question.id ?? index + 1;
                                        const included = !excludedQuestionIds.has(qid);
                                        return (
                                            <div key={qid} className={`p-4 ${included ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleQuestion(qid)}
                                                        className="mt-0.5 text-left flex-shrink-0"
                                                        aria-label={included ? 'Исклучи прашање' : 'Вклучи прашање'}
                                                    >
                                                        {included
                                                            ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                                                            : <Square className="w-4 h-4 text-gray-400" />}
                                                    </button>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-gray-500 uppercase">Q{index + 1}</span>
                                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">{question.cognitiveLevel}</span>
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{question.question}</p>
                                                        {question.options && question.options.length > 0 && (
                                                            <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc list-inside">
                                                                {question.options.map((option, optionIndex) => (
                                                                    <li key={`${qid}-${optionIndex}`}>{option}</li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                        {question.solution && (
                                                            <p className="mt-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
                                                                Насока: {question.solution}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="recovery-teacher-notes" className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                Teacher notes before approval
                            </label>
                            <textarea
                                id="recovery-teacher-notes"
                                value={teacherNotes}
                                onChange={e => setTeacherNotes(e.target.value)}
                                disabled={loading}
                                rows={4}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                placeholder="Кратка белешка за адаптација, фокус или инструкции за класот..."
                            />
                        </div>

                        {classes.length > 0 ? (
                            <div>
                                <label htmlFor="recovery-class-select" className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                    Одделение
                                </label>
                                <select
                                    id="recovery-class-select"
                                    title="Избери одделение за recovery worksheet"
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    disabled={loading}
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                >
                                    {classes.map(cls => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.name} ({cls.gradeLevel}. одд.)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                                Немате креирани одделенија. Recovery worksheet не може да се додели без одделение.
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                                    Засегнати ученици ({classStruggling.length})
                                </label>
                                <button type="button" onClick={toggleAllStudents} disabled={loading}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                                    {selectedStudents.size === classStruggling.length ? 'Одчекирај сите' : 'Чекирај сите'}
                                </button>
                            </div>
                            <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50">
                                {classStruggling.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        disabled={loading}
                                        onClick={() => toggleStudent(name)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
                                    >
                                        {selectedStudents.has(name)
                                            ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                            : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                                        <span className={selectedStudents.has(name) ? 'font-semibold text-gray-800' : 'text-gray-500'}>
                                            {name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{selectedStudents.size} / {classStruggling.length} избрани</p>
                        </div>

                        <div>
                            <label htmlFor="recovery-due-date" className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                Рок за предавање
                            </label>
                            <input
                                id="recovery-due-date"
                                title="Избери рок за предавање"
                                type="date"
                                value={dueDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setDueDate(e.target.value)}
                                disabled={loading}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-1">
                            <p><span className="font-semibold text-gray-800">Одобрени прашања:</span> {activeQuestions.length}</p>
                            <p><span className="font-semibold text-gray-800">Исклучени прашања:</span> {excludedQuestionIds.size}</p>
                            <p><span className="font-semibold text-gray-800">Audit:</span> teacher confirm + worksheet approval запис</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 flex items-center gap-3">
                    <button type="button" onClick={onClose} disabled={loading}
                        className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-40">
                        Откажи
                    </button>
                    <button
                        type="button"
                        onClick={handleApproveAndAssign}
                        disabled={loading || selectedStudents.size === 0 || !selectedClassId || activeQuestions.length === 0 || !worksheet}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-40"
                    >
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{stepLabel}</>
                            : <><ClipboardCheck className="w-4 h-4" />Одобри и додели</>}
                    </button>
                </div>
            </div>
        </div>
    );
};