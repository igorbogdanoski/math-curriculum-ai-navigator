import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { Card } from '../components/common/Card';
import { Building, Plus, ShieldAlert, Users, Copy, Check, BarChart2, TrendingDown, Globe, MessageSquare, BookOpen, Trash2, Star, RefreshCw } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { useCurriculum } from '../hooks/useCurriculum';
import { fetchAllForumThreadsAdmin, softDeleteThread, restoreThread } from '../services/firestoreService.forum';
import { fetchNationalLibrary, deleteNationalLibraryEntry, featureNationalLibraryEntry, getAvgRating, type NationalLibraryEntry } from '../services/firestoreService.materials';

type Tab = 'schools' | 'users' | 'stats' | 'forum' | 'content';

const ROLE_LABELS: Record<string, string> = {
  teacher:     '🎓 Наставник',
  school_admin: '🏫 Директор',
  admin:       '🛡️ Систем Админ',
};

const TRACK_LABELS: Record<string, string> = {
  vocational4: 'Стручно 4г',
  vocational3: 'Стручно 3г',
  vocational2: 'Стручно 2г',
  gymnasium:   'Гимназија',
  gymnasium_elective: 'Гимн. изб.',
};

const ROLE_COLORS: Record<string, string> = {
  teacher:      'bg-blue-50 text-blue-700 border-blue-200',
  school_admin: 'bg-amber-50 text-amber-700 border-amber-200',
  admin:        'bg-red-50 text-red-700 border-red-200',
};

const TIER_OPTIONS: { value: 'Free' | 'Pro' | 'Unlimited'; label: string; color: string }[] = [
    { value: 'Free',      label: 'Free',      color: 'bg-gray-100 text-gray-600' },
    { value: 'Pro',       label: 'Pro',        color: 'bg-yellow-100 text-yellow-800' },
    { value: 'Unlimited', label: 'Unlimited',  color: 'bg-purple-100 text-purple-800' },
];

const UserAdminRow = ({ u, isMe, schools, updatingUid, handleChangeRole, handleUpdateSubscription }: any) => {
    const role = u.role ?? 'teacher';
    const [isEditing, setIsEditing] = useState(false);
    const [editCredits, setEditCredits] = useState(u.aiCreditsBalance || 0);
    const [editPremium, setEditPremium] = useState(u.isPremium || false);
    const [editUnlimited, setEditUnlimited] = useState(u.hasUnlimitedCredits || false);
    const [editTier, setEditTier] = useState<'Free' | 'Pro' | 'Unlimited'>(u.tier || 'Free');

    // Keep local state in sync if parent refreshes
    React.useEffect(() => {
        setEditCredits(u.aiCreditsBalance || 0);
        setEditPremium(u.isPremium || false);
        setEditUnlimited(u.hasUnlimitedCredits || false);
        setEditTier(u.tier || 'Free');
    }, [u.aiCreditsBalance, u.isPremium, u.hasUnlimitedCredits, u.tier]);

    const tierColor = TIER_OPTIONS.find(t => t.value === (u.tier || 'Free'))?.color ?? 'bg-gray-100 text-gray-600';

    return (
        <div className={`flex flex-col gap-2 py-3 ${isMe ? 'bg-amber-50/40' : ''}`}>
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {(u.name ?? '?').charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                        {u.name ?? 'Непознат'}
                        {isMe && <span className="text-[10px] text-amber-600 font-bold">(ти)</span>}
                        {u.isPremium && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold">PRO</span>}
                        {u.hasUnlimitedCredits && <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-bold">∞</span>}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate font-mono">{u.email || u.uid}</p>
                    {u.schoolId && (
                        <p className="text-[11px] text-gray-400 truncate">🏫 {schools.find((s: any) => s.id === u.schoolId)?.name ?? u.schoolId}</p>
                    )}
                </div>
                {/* Credits + tier + role */}
                <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-1 text-xs border rounded-md px-2 py-1">
                        <span>🪙 {u.hasUnlimitedCredits ? '∞' : (u.aiCreditsBalance || 0)}</span>
                        {!isMe && (
                            <button type="button" onClick={() => setIsEditing(!isEditing)} className="text-blue-500 hover:text-blue-700 ml-1" title="Уреди претплата">✏️</button>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierColor}`}>
                        {u.tier || 'Free'}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[role] ?? ROLE_COLORS.teacher}`}>
                        {ROLE_LABELS[role] ?? role}
                    </span>
                    {u.secondaryTrack && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200" title={`Средно: ${u.secondaryTrack}`}>
                            🎓 {TRACK_LABELS[u.secondaryTrack] ?? u.secondaryTrack}
                        </span>
                    )}
                    {!isMe && (
                        <select
                            aria-label={`Улога за ${u.name ?? u.uid}`}
                            disabled={updatingUid === u.uid}
                            value={role}
                            onChange={e => handleChangeRole(u.uid, e.target.value as 'teacher' | 'school_admin' | 'admin', u.schoolId)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-red-400 outline-none cursor-pointer disabled:opacity-50"
                        >
                            <option value="teacher">Наставник</option>
                            <option value="school_admin">Директор</option>
                            <option value="admin">Систем Админ</option>
                        </select>
                    )}
                    {updatingUid === u.uid && (
                        <span className="text-xs text-gray-400 animate-pulse">Зачувувам...</span>
                    )}
                </div>
            </div>

            {/* ── Expanded Subscription Edit Form ── */}
            {isEditing && !isMe && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-1 ml-12 space-y-3 text-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Уреди претплата — {u.name ?? u.uid}</p>

                    {/* Credits row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            🪙 Кредити:
                            <input
                                type="number"
                                min={0}
                                className="w-20 px-2 py-1 border rounded-lg text-sm"
                                value={editCredits}
                                onChange={e => setEditCredits(Math.max(0, parseInt(e.target.value) || 0))}
                                disabled={editUnlimited}
                            />
                        </label>
                        <div className="flex gap-1.5">
                            {[10, 50, 100, 500].map(amt => (
                                <button
                                    key={amt}
                                    type="button"
                                    disabled={editUnlimited}
                                    onClick={() => setEditCredits((c: number) => c + amt)}
                                    className="px-2 py-1 bg-white border rounded-lg text-xs hover:bg-gray-100 disabled:opacity-30 transition"
                                >
                                    +{amt}
                                </button>
                            ))}
                            <button type="button" onClick={() => setEditCredits(0)} disabled={editUnlimited} className="px-2 py-1 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 hover:bg-red-100 disabled:opacity-30 transition">Reset</button>
                        </div>
                    </div>

                    {/* Tier + toggles row */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            Ниво:
                            <select
                                value={editTier}
                                onChange={e => {
                                    const t = e.target.value as 'Free' | 'Pro' | 'Unlimited';
                                    setEditTier(t);
                                    setEditPremium(t !== 'Free');
                                    setEditUnlimited(t === 'Unlimited');
                                }}
                                className="border rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                            >
                                <option value="Free">Free</option>
                                <option value="Pro">Pro (Premium)</option>
                                <option value="Unlimited">Unlimited (∞)</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editPremium}
                                onChange={e => setEditPremium(e.target.checked)}
                                className="rounded"
                            />
                            Premium
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editUnlimited}
                                onChange={e => {
                                    setEditUnlimited(e.target.checked);
                                    if (e.target.checked) setEditPremium(true);
                                }}
                                className="rounded"
                            />
                            Неограничени (∞)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                handleUpdateSubscription(u.uid, editCredits, editPremium, editUnlimited, editTier);
                                setIsEditing(false);
                            }}
                            disabled={updatingUid === u.uid}
                            className="bg-brand-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/90 disabled:opacity-40 transition"
                        >
                            {updatingUid === u.uid ? 'Зачувувам...' : '✓ Зачувај'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition"
                        >
                            Откажи
                        </button>
                        {/* Quick presets */}
                        <div className="ml-auto flex gap-1.5">
                            <button type="button" onClick={() => { setEditTier('Free'); setEditPremium(false); setEditUnlimited(false); setEditCredits(50); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Free+50</button>
                            <button type="button" onClick={() => { setEditTier('Pro'); setEditPremium(true); setEditUnlimited(false); setEditCredits(0); }} className="text-xs text-yellow-600 hover:text-yellow-800 underline font-bold">→ Pro</button>
                            <button type="button" onClick={() => { setEditTier('Unlimited'); setEditPremium(true); setEditUnlimited(true); setEditCredits(0); }} className="text-xs text-purple-600 hover:text-purple-800 underline font-bold">→ ∞ Unlimited</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const SystemAdminView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const { allConcepts } = useCurriculum();
    const [activeTab, setActiveTab] = useState<Tab>('schools');

    // Build conceptId → title lookup map from curriculum data
    const conceptNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        allConcepts.forEach(c => { map[c.id] = c.title; });
        return map;
    }, [allConcepts]);

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
    const [userSearch, setUserSearch] = useState('');

    // ── National stats state ──
    const [nationalStats, setNationalStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    // ── Forum moderation state ──
    const [forumThreads, setForumThreads] = useState<any[]>([]);
    const [isLoadingForum, setIsLoadingForum] = useState(false);
    const [forumSearch, setForumSearch] = useState('');
    const [forumActionUid, setForumActionUid] = useState<string | null>(null);

    // ── Content moderation state ──
    const [libEntries, setLibEntries] = useState<NationalLibraryEntry[]>([]);
    const [isLoadingLib, setIsLoadingLib] = useState(false);
    const [libSearch, setLibSearch] = useState('');
    const [libActionId, setLibActionId] = useState<string | null>(null);

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
        if (activeTab === 'forum' && forumThreads.length === 0) {
            loadForumThreads();
        }
        if (activeTab === 'content' && libEntries.length === 0) {
            loadLibEntries();
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

    const loadForumThreads = async () => {
        setIsLoadingForum(true);
        try {
            const data = await fetchAllForumThreadsAdmin(200);
            setForumThreads(data);
        } finally {
            setIsLoadingForum(false);
        }
    };

    const handleForumDelete = async (threadId: string) => {
        setForumActionUid(threadId);
        try {
            await softDeleteThread(threadId);
            setForumThreads(prev => prev.map(t => t.id === threadId ? { ...t, deleted: true } : t));
        } finally {
            setForumActionUid(null);
        }
    };

    const handleForumRestore = async (threadId: string) => {
        setForumActionUid(threadId);
        try {
            await restoreThread(threadId);
            setForumThreads(prev => prev.map(t => t.id === threadId ? { ...t, deleted: false } : t));
        } finally {
            setForumActionUid(null);
        }
    };

    const loadLibEntries = async () => {
        setIsLoadingLib(true);
        try {
            const { entries } = await fetchNationalLibrary({ });
            setLibEntries(entries);
        } finally {
            setIsLoadingLib(false);
        }
    };

    const handleLibDelete = async (entryId: string) => {
        if (!confirm('Да се избрише оваа ставка? Оваа акција е неповратна.')) return;
        setLibActionId(entryId);
        try {
            await deleteNationalLibraryEntry(entryId);
            setLibEntries(prev => prev.filter(e => e.id !== entryId));
        } finally {
            setLibActionId(null);
        }
    };

    const handleLibFeature = async (entryId: string, current: boolean) => {
        setLibActionId(entryId);
        try {
            await featureNationalLibraryEntry(entryId, !current);
            setLibEntries(prev => prev.map(e => e.id === entryId ? { ...e, isFeatured: !current } : e));
        } finally {
            setLibActionId(null);
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

    const handleUpdateSubscription = async (uid: string, credits: number, isPremium: boolean, hasUnlimitedCredits: boolean, tier: 'Free' | 'Pro' | 'Unlimited') => {
        setUpdatingUid(uid);
        try {
            await firestoreService.updateUserSubscription(uid, { aiCreditsBalance: credits, isPremium, hasUnlimitedCredits, tier });
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, aiCreditsBalance: credits, isPremium, hasUnlimitedCredits, tier } : u));
        } catch (err: any) {
            setUserError('Грешка при ажурирање претплата.');
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
            <div className="flex flex-wrap gap-1 border-b border-gray-200">
                {([['schools', '🏫 Училишта'], ['users', '👥 Корисници'], ['stats', '📊 Статистики'], ['forum', '💬 Форум'], ['content', '📚 Содржина']] as [Tab, string][]).map(([id, label]) => (
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
                    <div className="flex items-center justify-between mb-4">
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

                    {/* Subscription summary pills */}
                    {users.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4 text-xs">
                            {[
                                { label: 'Free',      count: users.filter(u => !u.isPremium && !u.hasUnlimitedCredits).length, color: 'bg-gray-100 text-gray-600' },
                                { label: 'Pro',       count: users.filter(u => u.isPremium && !u.hasUnlimitedCredits).length,  color: 'bg-yellow-100 text-yellow-800' },
                                { label: 'Unlimited', count: users.filter(u => u.hasUnlimitedCredits).length,                  color: 'bg-purple-100 text-purple-800' },
                            ].map(p => (
                                <span key={p.label} className={`px-2.5 py-1 rounded-full font-bold ${p.color}`}>
                                    {p.label}: {p.count}
                                </span>
                            ))}
                            <span className="px-2.5 py-1 rounded-full font-bold bg-blue-50 text-blue-700">
                                🪙 Вкупно кредити: {users.filter(u => !u.hasUnlimitedCredits).reduce((s: number, u: any) => s + (u.aiCreditsBalance || 0), 0)}
                            </span>
                        </div>
                    )}

                    {/* Secondary track breakdown */}
                    {users.length > 0 && (() => {
                        const primary = users.filter(u => !u.secondaryTrack).length;
                        const secondary = users.filter(u => !!u.secondaryTrack);
                        const trackCounts: Record<string, number> = {};
                        secondary.forEach(u => { trackCounts[u.secondaryTrack] = (trackCounts[u.secondaryTrack] ?? 0) + 1; });
                        return (
                            <div className="flex flex-wrap gap-2 mb-4 text-xs border-t border-gray-100 pt-3">
                                <span className="text-gray-400 text-[10px] uppercase tracking-wide self-center mr-1">Програма:</span>
                                <span className="px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600">
                                    📘 Основно: {primary}
                                </span>
                                {Object.entries(trackCounts).map(([track, count]) => (
                                    <span key={track} className="px-2.5 py-1 rounded-full font-bold bg-teal-50 text-teal-700 border border-teal-100">
                                        🎓 {TRACK_LABELS[track] ?? track}: {count}
                                    </span>
                                ))}
                                {secondary.length > 0 && (
                                    <span className="px-2.5 py-1 rounded-full font-bold bg-indigo-50 text-indigo-700">
                                        Средно вкупно: {secondary.length}
                                    </span>
                                )}
                            </div>
                        );
                    })()}

                    {/* Search */}
                    <input
                        type="search"
                        placeholder="Пребарај по ime или email..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
                    />

                    {userError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{userError}</div>}

                    {isLoadingUsers ? (
                        <div className="space-y-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">Нема корисници.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {users
                                .filter(u => {
                                    if (!userSearch.trim()) return true;
                                    const q = userSearch.toLowerCase();
                                    return (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.uid ?? '').toLowerCase().includes(q);
                                })
                                .map(u => (
                                    <UserAdminRow
                                        key={u.uid}
                                        u={u}
                                        isMe={u.uid === firebaseUser?.uid}
                                        schools={schools}
                                        updatingUid={updatingUid}
                                        handleChangeRole={handleChangeRole}
                                        handleUpdateSubscription={handleUpdateSubscription}
                                    />
                                ))
                            }
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
                                                <span className="flex-1 text-gray-700 truncate text-xs font-medium" title={c.conceptId}>{conceptNameMap[c.conceptId] ?? c.conceptId}</span>
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

            {/* ── TAB: Forum Moderation ── */}
            {activeTab === 'forum' && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-gray-500" />
                            Модерирање на форум ({forumThreads.length})
                        </h2>
                        <button type="button" onClick={loadForumThreads} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline">
                            <RefreshCw className="w-3.5 h-3.5" /> Освежи
                        </button>
                    </div>

                    <input
                        type="search"
                        placeholder="Пребарај по наслов или автор..."
                        value={forumSearch}
                        onChange={e => setForumSearch(e.target.value)}
                        className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
                    />

                    {isLoadingForum ? (
                        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                    ) : forumThreads.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">Нема нишки во форумот.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {forumThreads
                                .filter(t => {
                                    if (!forumSearch.trim()) return true;
                                    const q = forumSearch.toLowerCase();
                                    return (t.title ?? '').toLowerCase().includes(q) || (t.authorName ?? '').toLowerCase().includes(q);
                                })
                                .map(thread => (
                                    <div key={thread.id} className={`flex items-start gap-3 py-3 ${thread.deleted ? 'opacity-50' : ''}`}>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                                                {thread.title}
                                                {thread.deleted && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">ИЗБРИШАНА</span>}
                                            </p>
                                            <p className="text-xs text-gray-400">{thread.authorName} · {thread.replyCount} одговори · {thread.upvotedBy?.length ?? 0} гласови</p>
                                            {thread.conceptTitle && <p className="text-[11px] text-indigo-500 mt-0.5">📌 {thread.conceptTitle}</p>}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {thread.deleted ? (
                                                <button
                                                    type="button"
                                                    disabled={forumActionUid === thread.id}
                                                    onClick={() => handleForumRestore(thread.id)}
                                                    className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-40 transition font-medium"
                                                >
                                                    Врати
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={forumActionUid === thread.id}
                                                    onClick={() => handleForumDelete(thread.id)}
                                                    className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition font-medium flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Избриши
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    )}
                </Card>
            )}

            {/* ── TAB: Content Moderation ── */}
            {activeTab === 'content' && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-gray-500" />
                            Национална Библиотека ({libEntries.length})
                        </h2>
                        <button type="button" onClick={loadLibEntries} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline">
                            <RefreshCw className="w-3.5 h-3.5" /> Освежи
                        </button>
                    </div>

                    <input
                        type="search"
                        placeholder="Пребарај по прашање или автор..."
                        value={libSearch}
                        onChange={e => setLibSearch(e.target.value)}
                        className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
                    />

                    {isLoadingLib ? (
                        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                    ) : libEntries.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">Нема ставки во библиотеката.</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {libEntries
                                .filter(e => {
                                    if (!libSearch.trim()) return true;
                                    const q = libSearch.toLowerCase();
                                    return (e.question ?? '').toLowerCase().includes(q) || (e.publishedByName ?? '').toLowerCase().includes(q);
                                })
                                .map(entry => {
                                    const avg = getAvgRating(entry);
                                    const ratingCount = entry.ratingsByUid ? Object.keys(entry.ratingsByUid).length : 0;
                                    return (
                                        <div key={entry.id} className="flex items-start gap-3 py-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 line-clamp-2">{entry.question}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[11px] text-gray-400">{entry.publishedByName}</span>
                                                    {entry.gradeLevel && <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{entry.gradeLevel}. одд.</span>}
                                                    {entry.conceptTitle && <span className="text-[11px] text-indigo-500 truncate max-w-[150px]">{entry.conceptTitle}</span>}
                                                    <span className="text-[11px] text-gray-400">📥 {entry.importCount}</span>
                                                    {avg && <span className="text-[11px] text-amber-600 flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{avg} ({ratingCount})</span>}
                                                    {entry.isFeatured && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">FEATURED</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={libActionId === entry.id}
                                                    onClick={() => handleLibFeature(entry.id, entry.isFeatured ?? false)}
                                                    title={entry.isFeatured ? 'Отстрани Featured' : 'Означи Featured'}
                                                    className={`text-xs px-2.5 py-1 border rounded-lg disabled:opacity-40 transition font-medium flex items-center gap-1 ${entry.isFeatured ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                                >
                                                    <Star className={`w-3 h-3 ${entry.isFeatured ? 'fill-amber-400 text-amber-400' : ''}`} />
                                                    {entry.isFeatured ? 'Unfeature' : 'Feature'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={libActionId === entry.id}
                                                    onClick={() => handleLibDelete(entry.id)}
                                                    className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition font-medium flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Избриши
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};
