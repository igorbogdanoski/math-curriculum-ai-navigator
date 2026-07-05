import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { fetchHomeworkByClass, markHomeworkComplete, HomeworkAssignment } from '../services/firestoreService.classroom';
import { fetchClassMembership } from '../services/firestoreService.classroom';
import { getOrCreateDeviceId, getCachedStudentName } from '../utils/studentIdentity';
import { useNavigation } from '../contexts/NavigationContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dueDate: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function dueBadge(daysLeft: number) {
    if (daysLeft < 0) return { label: `Задоцнет ${Math.abs(daysLeft)} ден(а)`, cls: 'bg-red-100 text-red-700 border-red-200' };
    if (daysLeft === 0) return { label: 'Денес!', cls: 'bg-orange-100 text-orange-700 border-orange-200' };
    if (daysLeft <= 2) return { label: `За ${daysLeft} ден(а)`, cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: `За ${daysLeft} дена`, cls: 'bg-blue-50 text-blue-700 border-blue-100' };
}

const MATERIAL_ICON: Record<string, string> = {
    MATERIALS: '📄', QUIZ: '📝', GAMMA: '🎬', DUGGA: '📋', GENERIC: '📚',
};

// ── Main View ─────────────────────────────────────────────────────────────────

export const StudentHomeworkView: React.FC = () => {
    const { navigate } = useNavigation();
    const deviceId = getOrCreateDeviceId();

    const [studentName, setStudentName] = useState<string | null>(null);
    const [classId, setClassId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [completing, setCompleting] = useState<string | null>(null);

    useEffect(() => {
        fetchClassMembership(deviceId, getCachedStudentName()).then(membership => {
            if (!membership) { setIsLoading(false); return; }
            setClassId(membership.classId);
            setStudentName(membership.studentName ?? null);
            return fetchHomeworkByClass(membership.classId);
        }).then(hw => {
            if (hw) setAssignments(hw);
        }).finally(() => setIsLoading(false));
    }, [deviceId]);

    const handleComplete = async (assignment: HomeworkAssignment) => {
        if (!studentName) return;
        setCompleting(assignment.id);
        try {
            await markHomeworkComplete(assignment.id, studentName);
            setAssignments(prev => prev.map(a =>
                a.id === assignment.id
                    ? { ...a, completedBy: [...(a.completedBy ?? []), studentName] }
                    : a,
            ));
        } finally {
            setCompleting(null);
        }
    };

    const pending = assignments.filter(a => !a.completedBy?.includes(studentName ?? ''));
    const done = assignments.filter(a => a.completedBy?.includes(studentName ?? ''));

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-32">
                <ICONS.spinner className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    if (!classId) {
        return (
            <div className="p-6 max-w-lg mx-auto text-center py-24">
                <div className="text-5xl mb-4">🏫</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Не си приклучен на класа</h2>
                <p className="text-gray-500 text-sm">Побарај од наставникот код за приклучување.</p>
                <button
                    type="button"
                    onClick={() => navigate('/student-play')}
                    className="mt-6 px-5 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition"
                >
                    Приклучи се на класа
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        📚 Мои задачи
                    </h1>
                    {studentName && <p className="text-sm text-gray-500 mt-0.5">{studentName}</p>}
                </div>
                <span className="text-xs bg-brand-primary/10 text-brand-primary font-bold px-3 py-1.5 rounded-full">
                    {pending.length} активни
                </span>
            </div>

            {/* Pending */}
            {pending.length > 0 ? (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">За решавање</h2>
                    {pending.map(a => {
                        const days = daysUntil(a.dueDate);
                        const badge = dueBadge(days);
                        return (
                            <Card key={a.id} className="p-4 hover:shadow-md transition-shadow">
                                <div className="flex gap-3">
                                    <div className="text-2xl shrink-0">{MATERIAL_ICON[a.materialType] ?? '📚'}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                            <h3 className="font-bold text-gray-900 text-sm truncate">{a.title}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        {a.instructions && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.instructions}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-3">
                                            {a.materialLink && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(a.materialLink!)}
                                                    className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"
                                                >
                                                    <ICONS.arrowRight className="w-3.5 h-3.5" />
                                                    Отвори материјал
                                                </button>
                                            )}
                                            {studentName && (
                                                <button
                                                    type="button"
                                                    disabled={completing === a.id}
                                                    onClick={() => handleComplete(a)}
                                                    className="ml-auto flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition disabled:opacity-60"
                                                >
                                                    {completing === a.id
                                                        ? <ICONS.spinner className="w-3.5 h-3.5 animate-spin" />
                                                        : '✅'} Готово
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="font-bold text-emerald-700">Сите задачи се решени!</p>
                </div>
            )}

            {/* Completed */}
            {done.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-wider list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                        Завршени ({done.length})
                    </summary>
                    <div className="space-y-2 mt-2">
                        {done.map(a => (
                            <div key={a.id} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-lg">{MATERIAL_ICON[a.materialType] ?? '📚'}</span>
                                <span className="text-sm text-gray-500 line-through">{a.title}</span>
                                <span className="ml-auto text-emerald-500 text-xs font-bold">✓ Готово</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};
