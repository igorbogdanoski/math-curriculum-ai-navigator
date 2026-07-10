import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { fetchClasses, createHomeworkAssignment, HomeworkAssignment } from '../services/firestoreService.classroom';
import { type SchoolClass } from '../services/firestoreService.types';
import { ICONS } from '../constants';

interface Props {
    materialTitle: string;
    materialType?: HomeworkAssignment['materialType'];
    materialLink?: string;
    onClose: () => void;
}

export const HomeworkAssignModal: React.FC<Props> = ({
    materialTitle, materialType = 'GENERIC', materialLink = '', onClose,
}) => {
    const { user, firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    });
    const [instructions, setInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!firebaseUser?.uid) return;
        fetchClasses(firebaseUser.uid)
            .then(cls => { setClasses(cls); if (cls.length > 0) setSelectedClassId(cls[0].id); })
            .catch(() => addNotification('Не можев да ги вчитам класовите.', 'error'))
            .finally(() => setIsLoadingClasses(false));
    }, [firebaseUser?.uid, addNotification]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassId || !firebaseUser?.uid) return;
        const cls = classes.find(c => c.id === selectedClassId);
        if (!cls) return;

        setIsSubmitting(true);
        try {
            await createHomeworkAssignment(
                firebaseUser.uid,
                user?.name ?? 'Наставник',
                selectedClassId,
                cls.studentNames,
                materialTitle,
                dueDate,
                materialType,
                instructions,
                materialLink,
            );
            addNotification(`✅ Домашна задача доделена на ${cls.name}!`, 'success');
            onClose();
        } catch {
            addNotification('Грешка при доделување домашна задача.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <div>
                        <h2 className="font-bold text-lg text-gray-900">📚 Задај домашна задача</h2>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{materialTitle}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                        <ICONS.close className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Class selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Класа</label>
                        {isLoadingClasses ? (
                            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                        ) : classes.length === 0 ? (
                            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                Нема класи. Прво креирај класа во Тетратка за оценки.
                            </p>
                        ) : (
                            <select
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                                aria-label="Избери класа"
                            >
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name} — {cls.gradeLevel}. одд. ({cls.studentNames.length} ученици)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Due date */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Рок за предавање</label>
                        <input
                            type="date"
                            value={dueDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
                            required
                        />
                    </div>

                    {/* Instructions */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Упатство <span className="text-gray-400 font-normal">(опционално)</span>
                        </label>
                        <textarea
                            value={instructions}
                            onChange={e => setInstructions(e.target.value)}
                            placeholder="пр. Реши ги прашањата 1–5, предај го решението на следниот час."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 outline-none resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedClassId || classes.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-60 transition shadow-sm"
                        >
                            {isSubmitting ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Доделувам...</> : '✅ Задај'}
                        </button>
                        <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition">
                            Откажи
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
