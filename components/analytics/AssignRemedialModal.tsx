import { logger } from '../../utils/logger';
import React, { useState, useMemo } from 'react';
import { X, Users, AlertTriangle, ClipboardList, Loader2, CheckSquare, Square } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { firestoreService } from '../../services/firestoreService';
import type { SchoolClass } from '../../services/firestoreService';

interface Props {
    conceptId: string;
    conceptTitle: string;
    misconceptions: { text: string; count: number }[];
    strugglingStudents: string[];
    classes: SchoolClass[];
    teacherUid: string;
    gradeLevel: number;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

export const AssignRemedialModal: React.FC<Props> = ({
    conceptId,
    conceptTitle,
    misconceptions,
    strugglingStudents,
    classes,
    teacherUid,
    gradeLevel,
    onClose,
    onSuccess,
}) => {
    const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ?? '');
    const [dueDate, setDueDate] = useState(defaultDue);
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set(strugglingStudents));
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'idle' | 'generating' | 'saving' | 'assigning'>('idle');

    const selectedClass = useMemo(
        () => classes.find(c => c.id === selectedClassId),
        [classes, selectedClassId],
    );

    // Students in the selected class who are also struggling
    const classStruggling = useMemo(() => {
        if (!selectedClass) return strugglingStudents;
        const inClass = new Set(selectedClass.studentNames);
        const matched = strugglingStudents.filter(s => inClass.has(s));
        return matched.length > 0 ? matched : strugglingStudents;
    }, [selectedClass, strugglingStudents]);

    const toggleStudent = (name: string) => {
        setSelectedStudents(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedStudents.size === classStruggling.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(classStruggling));
        }
    };

    const handleAssign = async () => {
        if (!selectedClassId || selectedStudents.size === 0) return;
        setLoading(true);
        try {
            // 1. Generate targeted remedial quiz
            setStep('generating');
            const quiz = await geminiService.generateTargetedRemedialQuiz(conceptTitle, misconceptions, gradeLevel);

            // 2. Save to cached_ai_materials
            setStep('saving');
            const cacheId = await firestoreService.saveAssignmentMaterial(quiz, {
                title: quiz.title,
                type: 'QUIZ',
                conceptId,
                gradeLevel,
                teacherUid,
            });

            // 3. Create assignment
            setStep('assigning');
            const studentList = Array.from(selectedStudents);
            await firestoreService.saveAssignment({
                title: quiz.title,
                materialType: 'QUIZ',
                cacheId,
                teacherUid,
                classId: selectedClassId,
                classStudentNames: studentList,
                dueDate,
                completedBy: [],
            });

            onSuccess(studentList.length);
        } catch (err) {
            logger.error('Assign remedial error:', err);
        } finally {
            setLoading(false);
            setStep('idle');
        }
    };

    const stepLabel = step === 'generating'
        ? 'Генерирам квиз…'
        : step === 'saving'
        ? 'Зачувувам…'
        : step === 'assigning'
        ? 'Доделувам…'
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-orange-500" />
                            Додели ремедијален квиз
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            <span className="font-semibold text-gray-700">{conceptTitle}</span>
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={loading}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
                    {/* Misconceptions summary */}
                    {misconceptions.length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-red-700 uppercase tracking-wide flex items-center gap-1 mb-2">
                                <AlertTriangle className="w-3 h-3" />
                                Идентификувани грешки ({misconceptions.length})
                            </p>
                            <ul className="space-y-1">
                                {misconceptions.slice(0, 3).map((m, i) => (
                                    <li key={i} className="text-xs text-slate-700">
                                        <span className="font-semibold">„{m.text}"</span>
                                        <span className="text-gray-400 ml-1">— {m.count} ученик{m.count === 1 ? '' : 'и'}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Class picker */}
                    {classes.length > 0 ? (
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                                Одделение
                            </label>
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                disabled={loading}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
                            Немате креирани одделенија. Квизот ќе биде зачуван без директна доделба.
                        </div>
                    )}

                    {/* Struggling students checklist */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-orange-500" />
                                Засегнати ученици ({classStruggling.length})
                            </label>
                            <button type="button" onClick={toggleAll} disabled={loading}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                                {selectedStudents.size === classStruggling.length ? 'Одчекирај сите' : 'Чекирај сите'}
                            </button>
                        </div>
                        <div className="border border-gray-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-gray-50">
                            {classStruggling.map(name => (
                                <button
                                    key={name}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => toggleStudent(name)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
                                >
                                    {selectedStudents.has(name)
                                        ? <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                        : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                                    <span className={selectedStudents.has(name) ? 'font-semibold text-gray-800' : 'text-gray-500'}>
                                        {name}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {selectedStudents.size} / {classStruggling.length} избрани
                        </p>
                    </div>

                    {/* Due date */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">
                            Рок за предавање
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setDueDate(e.target.value)}
                            disabled={loading}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 flex items-center gap-3">
                    <button type="button" onClick={onClose} disabled={loading}
                        className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-40">
                        Откажи
                    </button>
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={loading || selectedStudents.size === 0 || !selectedClassId}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition disabled:opacity-40"
                    >
                        {loading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />{stepLabel}</>
                        ) : (
                            <><ClipboardList className="w-4 h-4" />Генерирај и додели</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
