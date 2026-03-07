import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { Card } from '../components/common/Card';
import { Building, Plus, ShieldAlert, Users, Copy, Check, BarChart2, TrendingDown, Globe } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

type Tab = 'schools' | 'users' | 'stats';

const ROLE_LABELS: Record<string, string> = {
  teacher:     '🎓 Наставник',
  school_admin: '🏫 Директор',
  admin:       '🛡️ Систем Админ',
};

const ROLE_COLORS: Record<string, string> = {
  teacher:      'bg-blue-50 text-blue-700 border-blue-200',
  school_admin: 'bg-amber-50 text-amber-700 border-amber-200',
  admin:        'bg-red-50 text-red-700 border-red-200',
};

export const SystemAdminView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const [activeTab, setActiveTab] = useState<Tab>('schools');

    // ── Schools state ──
    const [schools, setSchools] = useState<any[]>([]);
    const [isLoadingSchools, setIsLoadingSchools] = useState(true);
    const [newSchoolName, setNewSchoolName] = useState('');
    const [newSchoolCity, setNewSchoolCity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [schoolError, setSchoolError] = useState('');
    const [schoolSuccess, setSchoolSuccess] = useState('');

    // ── Users state ──
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [userError, setUserError] = useState('');
    const [updatingUid, setUpdatingUid] = useState<string | null>(null);
    const [copiedUid, setCopiedUid] = useState(false);

    // ── National stats state ──
    const [nationalStats, setNationalStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'admin') {
            navigate('/');
            return;
        }
        loadSchools();
    }, [user, navigate]);

    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            loadUsers();
        }
        if (activeTab === 'stats' && !nationalStats) {
            loadNationalStats();
        }
    }, [activeTab]);

    const loadSchools = async () => {
        setIsLoadingSchools(true);
        try {
            const data = await firestoreService.fetchSchools();
            setSchools(data || []);
        } catch {
            setSchoolError('Грешка при вчитување на училиштата.');
        } finally {
            setIsLoadingSchools(false);
        }
    };

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setUserError('');
        try {
            const data = await firestoreService.fetchAllUsers();
            // Sort: admin first, then school_admin, then teacher, alphabetically within
            const order: Record<string, number> = { admin: 0, school_admin: 1, teacher: 2 };
            data.sort((a, b) => (order[a.role ?? 'teacher'] ?? 2) - (order[b.role ?? 'teacher'] ?? 2) || (a.name ?? '').localeCompare(b.name ?? ''));
            setUsers(data);
        } catch {
            setUserError('Грешка при вчитување на корисниците.');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const loadNationalStats = async () => {
        setIsLoadingStats(true);
        try {
            const data = await firestoreService.fetchNationalStats();
            setNationalStats(data);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setSchoolError('');
        setSchoolSuccess('');
        if (!newSchoolName.trim() || !newSchoolCity.trim()) {
            setSchoolError('Внесете и ime и град.');
            return;
        }
        setIsSubmitting(true);
        try {
            await firestoreService.createSchool(newSchoolName.trim(), newSchoolCity.trim(), firebaseUser?.uid);
            setSchoolSuccess(`Училиштето „${newSchoolName}" е регистрирано!`);
            setNewSchoolName('');
            setNewSchoolCity('');
            await loadSchools();
        } catch {
            setSchoolError('Грешка при создавање. Проверете ги дозволите.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangeRole = async (uid: string, newRole: 'teacher' | 'school_admin' | 'admin', schoolId?: string) => {
        setUpdatingUid(uid);
        try {
            await firestoreService.updateUserRole(uid, newRole, schoolId);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole, ...(schoolId !== undefined ? { schoolId } : {}) } : u));
        } catch {
            setUserError('Грешка при ажурирање на улогата.');
        } finally {
            setUpdatingUid(null);
        }
    };

    const handleCopyUid = () => {
        if (firebaseUser?.uid) {
            navigator.clipboard.writeText(firebaseUser.uid).catch(() => {});
            setCopiedUid(true);
            setTimeout(() => setCopiedUid(false), 2000);
        }
    };

    if (!user || user.role !== 'admin') return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-0">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                        Системски Администратор
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Управување со училишта и кориснички улоги.</p>
                </div>
            </div>

            {/* My UID card — for bootstrap */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Твојот Firebase UID</p>
                    <p className="text-xs font-mono text-amber-900 break-all mt-0.5">{firebaseUser?.uid ?? '—'}</p>
                </div>
                <button
                    type="button"
                    onClick={handleCopyUid}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                    {copiedUid ? <><Check className="w-3.5 h-3.5" /> Копирано</> : <><Copy className="w-3.5 h-3.5" /> Копирај</>}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
                {([['schools', '🏫 Училишта'], ['users', '👥 Корисници'], ['stats', '📊 Статистики']] as [Tab, string][]).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${activeTab === id ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── TAB: Schools ── */}
            {activeTab === 'schools' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add school form */}
                    <div className="lg:col-span-1">
                        <Card className="p-6 sticky top-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-gray-500" />
                                Додади Училиште
                            </h2>
                            {schoolError && <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{schoolError}</div>}
                            {schoolSuccess && <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg">{schoolSuccess}</div>}
                            <form onSubmit={handleCreateSchool} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Име на училиште</label>
                                    <input
                                        type="text"
                                        value={newSchoolName}
                                        onChange={e => setNewSchoolName(e.target.value)}
                                        placeholder="пр. ООУ Гоце Делчев"
                                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 outline-none text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Град / Општина</label>
                                    <input
                                        type="text"
                                        value={newSchoolCity}
                                        onChange={e => setNewSchoolCity(e.target.value)}
                                        placeholder="пр. Скопје"
                                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-red-400 outline-none text-sm"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newSchoolName || !newSchoolCity}
                                    className="w-full py-2.5 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors text-sm"
                                >
                                    {isSubmitting ? 'Се создава...' : 'Регистрирај Училиште'}
                                </button>
                            </form>
                        </Card>
                    </div>

                    {/* School list */}
                    <div className="lg:col-span-2">
                        <Card className="p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Building className="w-5 h-5 text-gray-500" />
                                Регистрирани училишта ({schools.length})
                            </h2>
                            {isLoadingSchools ? (
                                <div className="space-y-3">
                                    {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                                </div>
                            ) : schools.length === 0 ? (
                                <p className="text-center py-8 text-gray-400 text-sm">Нема регистрирани училишта.</p>
                            ) : (
                                <div className="space-y-2">
                                    {schools.map(school => (
                                        <div key={school.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{school.name}</p>
                                                <p className="text-xs text-gray-500">{school.city}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 font-mono bg-white px-2 py-1 rounded border truncate max-w-[120px]">{school.id}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ── TAB: Users ── */}
            {activeTab === 'users' && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-500" />
                            Регистрирани корисници ({users.length})
                        </h2>
                        <button
                            type="button"
                            onClick={loadUsers}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Освежи
                        </button>
                    </div>

                    {userError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{userError}</div>}

                    {isLoadingUsers ? (
                        <div className="space-y-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">Нема корисници.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {users.map(u => {
                                const role = u.role ?? 'teacher';
                                const isMe = u.uid === firebaseUser?.uid;
                                return (
                                    <div key={u.uid} className={`flex items-center gap-3 py-3 ${isMe ? 'bg-amber-50/40' : ''}`}>
                                        {/* Avatar */}
                                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                            {(u.name ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {u.name ?? 'Непознат'}
                                                {isMe && <span className="ml-2 text-[10px] text-amber-600 font-bold">(ти)</span>}
                                            </p>
                                            <p className="text-[11px] text-gray-400 truncate font-mono">{u.uid}</p>
                                            {u.schoolId && (
                                                <p className="text-[11px] text-gray-400 truncate">🏫 {schools.find(s => s.id === u.schoolId)?.name ?? u.schoolId}</p>
                                            )}
                                        </div>
                                        {/* Role badge + dropdown */}
                                        <div className="shrink-0 flex items-center gap-2">
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role] ?? ROLE_COLORS.teacher}`}>
                                                {ROLE_LABELS[role] ?? role}
                                            </span>
                                            {!isMe && (
                                                <div className="relative">
                                                    <select
                                                        aria-label={`Улога за ${u.name ?? u.uid}`}
                                                        disabled={updatingUid === u.uid}
                                                        value={role}
                                                        onChange={e => handleChangeRole(u.uid, e.target.value as any, u.schoolId)}
                                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-red-400 outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="teacher">Наставник</option>
                                                        <option value="school_admin">Директор</option>
                                                        <option value="admin">Систем Админ</option>
                                                    </select>
                                                </div>
                                            )}
                                            {updatingUid === u.uid && (
                                                <span className="text-xs text-gray-400 animate-pulse">Зачувувам...</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            )}
            {/* ── TAB: Stats ── */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {isLoadingStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
                        </div>
                    ) : nationalStats ? (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Училишта', value: nationalStats.totalSchools, icon: <Building className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
                                    { label: 'Наставници', value: nationalStats.totalTeachers, icon: <Users className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
                                    { label: 'Квизови (2000)', value: nationalStats.totalQuizzes, icon: <Globe className="w-5 h-5 text-teal-500" />, bg: 'bg-teal-50' },
                                    { label: 'Нац. просек', value: `${nationalStats.nationalAvg}%`, icon: <BarChart2 className="w-5 h-5 text-green-500" />, bg: 'bg-green-50' },
                                ].map(card => (
                                    <Card key={card.label} className={`p-5 ${card.bg}`}>
                                        <div className="flex items-center gap-3">
                                            {card.icon}
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                                                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* Grade breakdown */}
                            {nationalStats.gradeStats.length > 0 && (
                                <Card className="p-6">
                                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4" />
                                        Национален просек по одделение
                                    </h2>
                                    <div className="space-y-3">
                                        {nationalStats.gradeStats.map((g: any) => (
                                            <div key={g.grade} className="flex items-center gap-3 text-sm">
                                                <span className="w-16 font-semibold text-gray-700 shrink-0">{g.grade}</span>
                                                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${g.avgPct >= 70 ? 'bg-green-400' : g.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                        style={{ width: `${Math.max(g.avgPct, 2)}%` }}
                                                    />
                                                </div>
                                                <span className={`w-12 text-right font-bold ${g.avgPct >= 70 ? 'text-green-600' : g.avgPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                    {g.avgPct}%
                                                </span>
                                                <span className="text-xs text-gray-400 w-20 text-right">{g.attempts} обиди</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* Weak concepts */}
                            {nationalStats.weakConcepts.length > 0 && (
                                <Card className="p-6">
                                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <TrendingDown className="w-4 h-4 text-red-400" />
                                        Топ 10 концепти со слаба совладаност (национален пресек)
                                    </h2>
                                    <div className="divide-y divide-gray-100">
                                        {nationalStats.weakConcepts.map((c: any, i: number) => (
                                            <div key={c.conceptId} className="flex items-center gap-3 py-2.5 text-sm">
                                                <span className="w-6 text-center font-bold text-gray-400">{i + 1}</span>
                                                <span className="flex-1 font-mono text-gray-600 truncate text-xs">{c.conceptId}</span>
                                                <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-red-400 rounded-full"
                                                        style={{ width: `${Math.max(c.avgPct, 2)}%` }}
                                                    />
                                                </div>
                                                <span className="w-10 text-right font-bold text-red-500">{c.avgPct}%</span>
                                                <span className="text-xs text-gray-400 w-16 text-right">{c.attempts} обиди</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {nationalStats.gradeStats.length === 0 && nationalStats.weakConcepts.length === 0 && (
                                <Card className="p-8 text-center text-gray-400 text-sm">
                                    Нема доволно податоци за национална статистика.
                                </Card>
                            )}
                        </>
                    ) : null}
                    <div className="flex justify-end">
                        <button type="button" onClick={loadNationalStats} className="text-xs text-gray-500 hover:text-gray-700 underline">
                            Освежи
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
