import React, { useState, useEffect } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Trash2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { firestoreService, type Assignment } from '../../services/firestoreService';
import { useNotification } from '../../contexts/NotificationContext';

interface Props {
    teacherUid: string;
}

export const AssignmentsTab: React.FC<Props> = ({ teacherUid }) => {
    const { addNotification } = useNotification();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const data = await firestoreService.fetchAssignmentsByTeacher(teacherUid);
        setAssignments(data);
        setLoading(false);
    };

    useEffect(() => { load(); }, [teacherUid]);

    const handleDelete = async (id: string) => {
        if (!confirm('Да се избрише задачата?')) return;
        await firestoreService.deleteAssignment(id);
        setAssignments(prev => prev.filter(a => a.id !== id));
        addNotification('Задачата е избришана.', 'info');
    };

    const today = new Date().toISOString().split('T')[0];

    const statusFor = (a: Assignment) => {
        const completionRate = a.classStudentNames.length > 0
            ? Math.round((a.completedBy.length / a.classStudentNames.length) * 100)
            : 0;
        const overdue = a.dueDate < today && completionRate < 100;
        return { completionRate, overdue };
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-400">Вчитувам задачи…</div>;
    }

    if (assignments.length === 0) {
        return (
            <Card className="p-8 text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Нема зададени задачи.</p>
                <p className="text-sm text-gray-400 mt-1">
                    Генерирајте квиз или тест и кликнете „Задај на класа".
                </p>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-500">{assignments.length} задач{assignments.length === 1 ? 'а' : 'и'}</p>
            {assignments.map(a => {
                const { completionRate, overdue } = statusFor(a);
                const isExpanded = expanded === a.id;
                const notCompleted = a.classStudentNames.filter(s => !a.completedBy.includes(s));
                const completed = a.classStudentNames.filter(s => a.completedBy.includes(s));

                return (
                    <Card key={a.id} className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        a.materialType === 'QUIZ' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                        {a.materialType === 'QUIZ' ? 'Квиз' : 'Тест'}
                                    </span>
                                    {overdue && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />Задоцнета
                                        </span>
                                    )}
                                </div>
                                <p className="font-semibold text-gray-800 truncate">{a.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />Рок: {a.dueDate}
                                    </span>
                                    <span>{a.classStudentNames.length} ученик{a.classStudentNames.length === 1 ? '' : 'и'}</span>
                                </div>

                                {/* Progress bar */}
                                <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-500">Завршиле</span>
                                        <span className="font-bold text-gray-700">{a.completedBy.length}/{a.classStudentNames.length} ({completionRate}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all ${completionRate === 100 ? 'bg-green-500' : overdue ? 'bg-red-400' : 'bg-indigo-500'}`}
                                            style={{ width: `${completionRate}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => setExpanded(isExpanded ? null : a.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                    title="Детали"
                                >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => handleDelete(a.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"
                                    title="Избриши"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Expanded student details */}
                        {isExpanded && (
                            <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="font-medium text-green-700 flex items-center gap-1 mb-1">
                                        <CheckCircle className="w-3.5 h-3.5" />Завршиле ({completed.length})
                                    </p>
                                    {completed.length === 0 ? (
                                        <p className="text-xs text-gray-400">—</p>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {completed.map(s => (
                                                <li key={s} className="text-xs text-gray-600">✓ {s}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-amber-700 flex items-center gap-1 mb-1">
                                        <Clock className="w-3.5 h-3.5" />Не завршиле ({notCompleted.length})
                                    </p>
                                    {notCompleted.length === 0 ? (
                                        <p className="text-xs text-gray-400">Сите завршиле! 🎉</p>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {notCompleted.map(s => (
                                                <li key={s} className="text-xs text-gray-600">• {s}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
};
