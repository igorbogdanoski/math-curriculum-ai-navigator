import React, { useState, useEffect } from 'react';
import { School, Plus, Trash2, UserPlus, X, Edit2, Check } from 'lucide-react';
import { firestoreService, type SchoolClass } from '../../services/firestoreService';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';

interface ClassesTabProps {
    teacherUid: string;
}

const GRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ClassesTab: React.FC<ClassesTabProps> = ({ teacherUid }) => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // New class form state
    const [newName, setNewName] = useState('');
    const [newGrade, setNewGrade] = useState<number>(1);

    // Add student to class
    const [addStudentClassId, setAddStudentClassId] = useState<string | null>(null);
    const [studentInput, setStudentInput] = useState('');

    // Rename class
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const loadClasses = async () => {
        if (!teacherUid) return;
        setLoading(true);
        const data = await firestoreService.fetchClasses(teacherUid);
        setClasses(data);
        setLoading(false);
    };

    useEffect(() => { loadClasses(); }, [teacherUid]);

    const handleCreate = async () => {
        if (!newName.trim() || !teacherUid) return;
        setSaving(true);
        await firestoreService.createClass({
            name: newName.trim(),
            gradeLevel: newGrade,
            teacherUid,
            studentNames: [],
        });
        setNewName('');
        setNewGrade(1);
        setShowForm(false);
        setSaving(false);
        await loadClasses();
    };

    const handleDelete = async (classId: string, name: string) => {
        if (!window.confirm(`Избриши ја класата „${name}"?`)) return;
        await firestoreService.deleteClass(classId);
        await loadClasses();
    };

    const handleAddStudent = async (classId: string) => {
        const name = studentInput.trim();
        if (!name) return;
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = Array.from(new Set([...cls.studentNames, name]));
        await firestoreService.updateClass(classId, { studentNames: updated });
        setStudentInput('');
        setAddStudentClassId(null);
        await loadClasses();
    };

    const handleRemoveStudent = async (classId: string, studentName: string) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = cls.studentNames.filter(n => n !== studentName);
        await firestoreService.updateClass(classId, { studentNames: updated });
        await loadClasses();
    };

    const handleRename = async (classId: string) => {
        const name = renameValue.trim();
        if (!name) return;
        await firestoreService.updateClass(classId, { name });
        setRenameId(null);
        await loadClasses();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm font-semibold">
                Вчитување класи...
            </div>
        );
    }

    return (
        <SilentErrorBoundary name="ClassesTab">
            <div className="space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <School className="w-4 h-4" />
                        Мои класи ({classes.length})
                    </h2>
                    <button
                        type="button"
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Нова класа
                    </button>
                </div>

                {/* Create form */}
                {showForm && (
                    <Card className="border-indigo-200 bg-indigo-50">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3">Нова класа</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                placeholder="Назив на класата (напр. V-б)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                            />
                            <select
                                value={newGrade}
                                onChange={e => setNewGrade(Number(e.target.value))}
                                aria-label="Избери одделение"
                                className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                            >
                                {GRADE_LEVELS.map(g => (
                                    <option key={g} value={g}>{g}. одделение</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={!newName.trim() || saving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition"
                            >
                                {saving ? 'Зачувување...' : 'Создај'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
                            >
                                Откажи
                            </button>
                        </div>
                    </Card>
                )}

                {/* Empty state */}
                {classes.length === 0 && !showForm && (
                    <Card className="text-center py-12">
                        <School className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-400">Нема создадени класи.</p>
                        <p className="text-xs text-gray-300 mt-1">Кликни „Нова класа" за да создадеш своја прва класа.</p>
                    </Card>
                )}

                {/* Class cards */}
                {classes.map(cls => (
                    <Card key={cls.id} className="border-slate-200">
                        {/* Class header */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <School className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                {renameId === cls.id ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRename(cls.id);
                                                if (e.key === 'Escape') setRenameId(null);
                                            }}
                                            autoFocus
                                            className="border border-indigo-300 rounded px-2 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 w-32"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRename(cls.id)}
                                            className="p-1 text-green-600 hover:text-green-700 transition"
                                            aria-label="Зачувај"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRenameId(null)}
                                            className="p-1 text-gray-400 hover:text-gray-600 transition"
                                            aria-label="Откажи"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <h3 className="font-bold text-slate-800 truncate">{cls.name}</h3>
                                )}
                                <span className="text-xs font-semibold text-gray-400 flex-shrink-0">
                                    {cls.gradeLevel}. одд.
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">
                                    {cls.studentNames.length} уч.
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRenameId(cls.id);
                                        setRenameValue(cls.name);
                                    }}
                                    title="Преименувај класа"
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddStudentClassId(addStudentClassId === cls.id ? null : cls.id)}
                                    title="Додај ученик"
                                    className="p-1.5 text-gray-400 hover:text-green-600 transition"
                                >
                                    <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(cls.id, cls.name)}
                                    title="Избриши класа"
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Add student inline form */}
                        {addStudentClassId === cls.id && (
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    placeholder="Ime и презиме на ученик..."
                                    value={studentInput}
                                    onChange={e => setStudentInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleAddStudent(cls.id);
                                        if (e.key === 'Escape') setAddStudentClassId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddStudent(cls.id)}
                                    disabled={!studentInput.trim()}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition"
                                >
                                    Додај
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAddStudentClassId(null); setStudentInput(''); }}
                                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
                                >
                                    Откажи
                                </button>
                            </div>
                        )}

                        {/* Student list */}
                        {cls.studentNames.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">
                                Нема ученици — кликни <UserPlus className="w-3 h-3 inline" /> за да додадеш.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {cls.studentNames.sort().map(name => (
                                    <span
                                        key={name}
                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                                    >
                                        {name}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStudent(cls.id, name)}
                                            aria-label={`Отстрани ${name} од класата`}
                                            className="hover:opacity-60 transition"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </SilentErrorBoundary>
    );
};
