import React, { useState, useEffect, useMemo } from 'react';
import { Users, Plus, X, Trash2, UserPlus, CheckSquare, Square } from 'lucide-react';
import { firestoreService, type StudentGroup } from '../../services/firestoreService';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import type { PerStudentStat } from './shared';
import { useLanguage } from '../../i18n/LanguageContext';

interface GroupsTabProps {
    perStudentStats: PerStudentStat[];
    teacherUid?: string;
}

const COLOR_CLASSES: Record<string, { bg: string; border: string; badge: string; btn: string }> = {
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-800',  btn: 'bg-green-600 hover:bg-green-700' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-800',    btn: 'bg-blue-600 hover:bg-blue-700' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800',btn: 'bg-orange-500 hover:bg-orange-600' },
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-800',      btn: 'bg-red-600 hover:bg-red-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800',btn: 'bg-purple-600 hover:bg-purple-700' },
};

const COLOR_OPTIONS = ['green', 'blue', 'orange', 'red', 'purple'] as const;
const COLOR_DOT: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', orange: 'bg-orange-400',
    red: 'bg-red-500', purple: 'bg-purple-500',
};

export const GroupsTab: React.FC<GroupsTabProps> = ({ perStudentStats, teacherUid }) => {
    const { t } = useLanguage();
    const [groups, setGroups] = useState<StudentGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState<typeof COLOR_OPTIONS[number]>('blue');
    const [saving, setSaving] = useState(false);

    const loadGroups = async () => {
        setLoading(true);
        const g = await firestoreService.fetchStudentGroups(teacherUid);
        setGroups(g);
        setLoading(false);
    };

    useEffect(() => { loadGroups(); }, [teacherUid]);

    // Students already assigned to any group
    const assignedNames = useMemo(() => {
        const s = new Set<string>();
        groups.forEach(g => g.studentNames.forEach(n => s.add(n)));
        return s;
    }, [groups]);

    // Students with quiz results but not yet in any group
    const unassigned = useMemo(
        () => perStudentStats.filter(s => !assignedNames.has(s.name)),
        [perStudentStats, assignedNames],
    );

    // Per-group aggregate stats
    const groupStats = useMemo(() => {
        const statsMap: Record<string, { avg: number; passRate: number; mastered: number }> = {};
        groups.forEach(g => {
            const members = perStudentStats.filter(s => g.studentNames.includes(s.name));
            if (members.length === 0) {
                statsMap[g.id] = { avg: 0, passRate: 0, mastered: 0 };
                return;
            }
            statsMap[g.id] = {
                avg: Math.round(members.reduce((s, m) => s + m.avg, 0) / members.length),
                passRate: Math.round(members.reduce((s, m) => s + m.passRate, 0) / members.length),
                mastered: members.reduce((s, m) => s + m.masteredCount, 0),
            };
        });
        return statsMap;
    }, [groups, perStudentStats]);

    const toggleSelect = (name: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        await firestoreService.createStudentGroup(newName.trim(), newColor, teacherUid);
        setNewName('');
        setNewColor('blue');
        setShowForm(false);
        setSaving(false);
        await loadGroups();
    };

    const handleAddToGroup = async (groupId: string) => {
        if (selected.size === 0) return;
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const updated = Array.from(new Set([...group.studentNames, ...Array.from(selected)]));
        await firestoreService.updateGroupStudents(groupId, updated);
        setSelected(new Set());
        await loadGroups();
    };

    const handleRemoveFromGroup = async (groupId: string, studentName: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const updated = group.studentNames.filter(n => n !== studentName);
        await firestoreService.updateGroupStudents(groupId, updated);
        await loadGroups();
    };

    const handleDeleteGroup = async (groupId: string, groupName: string) => {
        if (!window.confirm(`Избриши ја групата „${groupName}"?`)) return;
        await firestoreService.deleteStudentGroup(groupId);
        await loadGroups();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm font-semibold">
                Вчитување групи...
            </div>
        );
    }

    return (
        <SilentErrorBoundary name="GroupsTab">
            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Left: Unassigned students ───────────────────────────── */}
                <div className="lg:w-72 flex-shrink-0">
                    <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Без група
                            </h2>
                            {unassigned.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                                    {unassigned.length}
                                </span>
                            )}
                        </div>

                        {selected.size > 0 && (
                            <p className="text-xs text-indigo-600 font-semibold mb-2">
                                {selected.size} избрани — кликни „+" на група за додавање
                            </p>
                        )}

                        {unassigned.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">Сите ученици се во групи.</p>
                        ) : (
                            <div className="space-y-1">
                                {unassigned.map(s => (
                                    <button
                                        key={s.name}
                                        type="button"
                                        onClick={() => toggleSelect(s.name)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition ${
                                            selected.has(s.name)
                                                ? 'bg-indigo-50 border border-indigo-200'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        {selected.has(s.name)
                                            ? <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                            : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                        }
                                        <span className="font-semibold text-slate-700 truncate">{s.name}</span>
                                        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{s.avg}%</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* ── Right: Groups ────────────────────────────────────────── */}
                <div className="flex-1 space-y-4">
                    {/* Create new group */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                            Групи ({groups.length})
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowForm(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Нова група
                        </button>
                    </div>

                    {showForm && (
                        <Card className="border-indigo-200 bg-indigo-50">
                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3">Нова група</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    placeholder="Име на група (напр. Напредна)"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                    className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                                />
                                <select
                                    value={newColor}
                                    onChange={e => setNewColor(e.target.value as typeof COLOR_OPTIONS[number])}
                                    aria-label="Избери боја за групата"
                                    className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                                >
                                    {COLOR_OPTIONS.map(c => (
                                        <option key={c} value={c}>{c === 'green' ? t('analytics.groups.colorGreen') : c === 'blue' ? t('analytics.groups.colorBlue') : c === 'orange' ? t('analytics.groups.colorOrange') : c === 'red' ? t('analytics.groups.colorRed') : t('analytics.groups.colorPurple')}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    disabled={!newName.trim() || saving}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition"
                                >
                                    {saving ? t('analytics.groups.saving') : t('analytics.groups.create')}
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

                    {groups.length === 0 && !showForm && (
                        <Card className="text-center py-10">
                            <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-gray-400">Нема создадени групи.</p>
                            <p className="text-xs text-gray-300 mt-1">Кликни „Нова група" за да организираш ученици.</p>
                        </Card>
                    )}

                    {groups.map(group => {
                        const c = COLOR_CLASSES[group.color] ?? COLOR_CLASSES.blue;
                        const stats = groupStats[group.id];
                        const members = perStudentStats.filter(s => group.studentNames.includes(s.name));

                        return (
                            <Card key={group.id} className={`${c.bg} ${c.border} border`}>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOT[group.color]}`} />
                                        <h3 className="font-bold text-slate-800 truncate">{group.name}</h3>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                                            {group.studentNames.length} уч.
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {selected.size > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddToGroup(group.id)}
                                                title={`Додај ${selected.size} избрани ученици`}
                                                className={`flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-lg transition ${c.btn}`}
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Додај ({selected.size})
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteGroup(group.id, group.name)}
                                            title="Избриши група"
                                            className="p-1 text-gray-400 hover:text-red-500 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Group stats */}
                                {members.length > 0 && stats && (
                                    <div className="flex gap-4 mb-3 text-xs font-semibold text-slate-600">
                                        <span>Просек: <strong>{stats.avg}%</strong></span>
                                        <span>Положиле: <strong>{stats.passRate}%</strong></span>
                                        <span>Совладани: <strong>{stats.mastered}</strong></span>
                                    </div>
                                )}

                                {/* Members */}
                                {group.studentNames.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">
                                        Нема ученици — избери ги од левата листа и кликни „Додај"
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.studentNames.map(name => (
                                            <span
                                                key={name}
                                                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}
                                            >
                                                {name}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFromGroup(group.id, name)}
                                                    aria-label={`Отстрани ${name} од групата`}
                                                    className="hover:opacity-60 transition"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>
        </SilentErrorBoundary>
    );
};
