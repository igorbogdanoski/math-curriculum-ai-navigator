import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { ShieldAlert, Copy, Check } from 'lucide-react';
import { getRagStats, type RagStats } from '../services/ragService';
import { firestoreService } from '../services/firestoreService';
import { useCurriculum } from '../hooks/useCurriculum';
import { fetchAllForumThreadsAdmin, softDeleteThread, restoreThread, approveForumThread } from '../services/firestoreService.forum';
import { type UserActivityRecord } from '../utils/cohortMetrics';
import { useLanguage } from '../i18n/LanguageContext';

import { AdminSchoolsTab } from './admin/AdminSchoolsTab';
import { AdminSchoolRegistryTab } from './admin/AdminSchoolRegistryTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminStatsTab } from './admin/AdminStatsTab';
import { AdminForumTab } from './admin/AdminForumTab';
import { AdminContentTab } from './admin/AdminContentTab';
import { CohortDashboard } from './admin/CohortDashboard';
import { AdminSubscribersTab } from './admin/AdminSubscribersTab';

type Tab = 'schools' | 'schoolRegistry' | 'users' | 'stats' | 'forum' | 'content' | 'cohort' | 'subscribers';

export const SystemAdminView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const { allConcepts } = useCurriculum();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<Tab>('schools');

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

    // ── Cohort/Activity state ──
    const [cohortUsers, setCohortUsers] = useState<UserActivityRecord[] | null>(null);
    const [cohortBurn, setCohortBurn] = useState<{ aiCreditsBalance?: number }[]>([]);
    const [isLoadingCohort, setIsLoadingCohort] = useState(false);
    const [cohortClock, setCohortClock] = useState<number>(() => Date.now());

    // ── RAG Indexing state ──
    const [ragIndexStatus, setRagIndexStatus] = useState<Record<number, 'idle' | 'running' | 'done' | 'error'>>({ 6: 'idle', 7: 'idle', 8: 'idle' });
    const [ragIndexLog, setRagIndexLog] = useState<string[]>([]);
    const [ragStats, setRagStats] = useState<RagStats | null>(null);
    const [ragEnabled, setRagEnabled] = useState(() => localStorage.getItem('VITE_ENABLE_VECTOR_RAG') === 'true');

    const handleRefreshRagStats = useCallback(() => { setRagStats(getRagStats()); }, []);

    const handleToggleRag = useCallback((enabled: boolean) => {
        if (enabled) localStorage.setItem('VITE_ENABLE_VECTOR_RAG', 'true');
        else localStorage.removeItem('VITE_ENABLE_VECTOR_RAG');
        setRagEnabled(enabled);
    }, []);

    const handleIndexGrade = useCallback(async (grade: number) => {
        const gradeLabel = grade === 6 ? 'VI' : grade === 7 ? 'VII' : 'VIII';
        setRagIndexStatus(prev => ({ ...prev, [grade]: 'running' }));
        setRagIndexLog([t('admin.view.ragIndexStarting').replace('{label}', gradeLabel)]);
        try {
            const [{ callEmbeddingProxy }, { doc, setDoc }] = await Promise.all([
                import('../services/gemini/core'),
                import('firebase/firestore'),
            ]);
            const { db } = await import('../firebaseConfig');

            type SubDoc = { id: string; grade: number; text: string; topicId: string; topicTitle: string; subtopicTitle: string };
            let subtopics: SubDoc[];
            if (grade === 6) {
                const m = await import('../data/official/grade6Official');
                subtopics = m.getOfficialSubtopicDocs();
            } else if (grade === 7) {
                const m = await import('../data/official/grade7Official');
                subtopics = m.getOfficialSubtopicDocs();
            } else {
                const m = await import('../data/official/grade8Official');
                subtopics = m.getOfficialSubtopicDocs(8);
            }

            setRagIndexLog(prev => [...prev, t('admin.view.ragIndexFound').replace('{n}', String(subtopics.length))]);

            const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
            let done = 0;
            for (const sub of subtopics) {
                if (done > 0) await sleep(600);
                const vector = await callEmbeddingProxy(sub.text, undefined, 'RETRIEVAL_DOCUMENT', 768);
                await setDoc(doc(db, 'concept_embeddings', sub.id), {
                    vector, text: sub.text, grade: sub.grade,
                    topicId: sub.topicId, topicTitle: sub.topicTitle, subtopicTitle: sub.subtopicTitle,
                    source: 'official_mon_2025', indexedAt: new Date().toISOString(),
                });
                done += 1;
                setRagIndexLog(prev => [...prev, `[${done}/${subtopics.length}] ${sub.subtopicTitle}`]);
            }
            setRagIndexLog(prev => [...prev, t('admin.view.ragIndexDone').replace('{n}', String(done))]);
            setRagIndexStatus(prev => ({ ...prev, [grade]: 'done' }));
        } catch (err) {
            setRagIndexLog(prev => [...prev, t('admin.view.ragIndexError').replace('{message}', err instanceof Error ? err.message : String(err))]);
            setRagIndexStatus(prev => ({ ...prev, [grade]: 'error' }));
        }
    }, []);

    useEffect(() => {
        if (!user || user.role !== 'admin') { navigate('/'); return; }
        loadSchools();
    }, [user, navigate]);

    useEffect(() => {
        if ((activeTab === 'users' || activeTab === 'schoolRegistry' || activeTab === 'subscribers') && users.length === 0) loadUsers();
        if (activeTab === 'stats' && !nationalStats) loadNationalStats();
        if (activeTab === 'forum' && forumThreads.length === 0) loadForumThreads();
        if (activeTab === 'cohort' && cohortUsers === null) loadCohort();
    }, [activeTab]);

    const loadCohort = async () => {
        setIsLoadingCohort(true);
        try {
            const data = await firestoreService.fetchAllUsers();
            setCohortUsers(data.map(u => ({ uid: u.uid, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, lastSeenAt: u.lastSeenAt, role: u.role })));
            setCohortBurn(data.map(u => ({ aiCreditsBalance: u.aiCreditsBalance })));
            setCohortClock(Date.now());
        } finally {
            setIsLoadingCohort(false);
        }
    };

    const loadSchools = async () => {
        setIsLoadingSchools(true);
        try {
            const data = await firestoreService.fetchSchools();
            setSchools(data || []);
        } catch {
            setSchoolError(t('admin.view.loadSchoolsError'));
        } finally {
            setIsLoadingSchools(false);
        }
    };

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setUserError('');
        try {
            const data = await firestoreService.fetchAllUsers();
            const order: Record<string, number> = { admin: 0, school_admin: 1, teacher: 2 };
            data.sort((a, b) => (order[a.role ?? 'teacher'] ?? 2) - (order[b.role ?? 'teacher'] ?? 2) || (a.name ?? '').localeCompare(b.name ?? ''));
            setUsers(data);
        } catch {
            setUserError(t('admin.view.loadUsersError'));
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

    // 2026-07-19 (Wave 8.6, audit_2026_07_18_full_app_review): reportForumThread() has always
    // written moderationStatus='pending' + reportedBy/reportReason, but nothing in the admin UI
    // ever surfaced them — reports silently accumulated with no way for an admin to see or
    // resolve them. This clears a report without deleting the thread (the reported content
    // stays up, matching reportForumThread's own "don't insta-hide" design).
    const handleForumApprove = async (threadId: string) => {
        setForumActionUid(threadId);
        try {
            await approveForumThread(threadId);
            setForumThreads(prev => prev.map(t => t.id === threadId ? { ...t, moderationStatus: 'approved', reportedBy: [], reportReason: null } : t));
        } finally {
            setForumActionUid(null);
        }
    };

    const handleCreateSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setSchoolError('');
        setSchoolSuccess('');
        if (!newSchoolName.trim() || !newSchoolCity.trim()) { setSchoolError(t('admin.view.nameAndCityRequired')); return; }
        setIsSubmitting(true);
        try {
            await firestoreService.createSchool(newSchoolName.trim(), newSchoolCity.trim(), firebaseUser?.uid);
            setSchoolSuccess(t('admin.view.schoolRegistered').replace('{name}', newSchoolName));
            setNewSchoolName('');
            setNewSchoolCity('');
            await loadSchools();
        } catch {
            setSchoolError(t('admin.view.createSchoolError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (uid: string) => {
        if (!window.confirm(t('admin.view.deleteUserConfirm'))) return;
        setUpdatingUid(uid);
        try {
            await firestoreService.deleteUserProfile(uid);
            setUsers(prev => prev.filter(u => u.uid !== uid));
        } catch {
            setUserError(t('admin.view.deleteUserError'));
        } finally {
            setUpdatingUid(null);
        }
    };

    const handleChangeRole = async (uid: string, newRole: 'teacher' | 'school_admin' | 'admin', schoolId?: string) => {
        setUpdatingUid(uid);
        try {
            await firestoreService.updateUserRole(uid, newRole, schoolId);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole, ...(schoolId !== undefined ? { schoolId } : {}) } : u));
        } catch {
            setUserError(t('admin.view.updateRoleError'));
        } finally {
            setUpdatingUid(null);
        }
    };

    const handleUpdateSubscription = async (uid: string, credits: number, isPremium: boolean, hasUnlimitedCredits: boolean, tier: 'Free' | 'Pro' | 'Unlimited') => {
        setUpdatingUid(uid);
        try {
            await firestoreService.updateUserSubscription(uid, { aiCreditsBalance: credits, isPremium, hasUnlimitedCredits, tier });
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, aiCreditsBalance: credits, isPremium, hasUnlimitedCredits, tier } : u));
        } catch {
            setUserError(t('admin.view.updateSubscriptionError'));
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                        {t('admin.view.title')}
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">{t('admin.view.subtitle')}</p>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">{t('admin.view.yourFirebaseUid')}</p>
                    <p className="text-xs font-mono text-amber-900 break-all mt-0.5">{firebaseUser?.uid ?? '—'}</p>
                </div>
                <button
                    type="button"
                    onClick={handleCopyUid}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                    {copiedUid ? <><Check className="w-3.5 h-3.5" /> {t('admin.view.copied')}</> : <><Copy className="w-3.5 h-3.5" /> {t('admin.view.copy')}</>}
                </button>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-gray-200">
                {([['schools', t('admin.view.tabSchools')], ['schoolRegistry', t('admin.view.tabRegistry')], ['users', t('admin.view.tabUsers')], ['subscribers', t('admin.view.tabSubscribers')], ['stats', t('admin.view.tabStats')], ['cohort', t('admin.view.tabCohort')], ['forum', t('admin.view.tabForum')], ['content', t('admin.view.tabContent')]] as [Tab, string][]).map(([id, label]) => (
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

            {activeTab === 'schools' && (
                <AdminSchoolsTab
                    schools={schools}
                    isLoadingSchools={isLoadingSchools}
                    schoolError={schoolError}
                    schoolSuccess={schoolSuccess}
                    newSchoolName={newSchoolName}
                    newSchoolCity={newSchoolCity}
                    isSubmitting={isSubmitting}
                    setNewSchoolName={setNewSchoolName}
                    setNewSchoolCity={setNewSchoolCity}
                    handleCreateSchool={handleCreateSchool}
                />
            )}

            {activeTab === 'schoolRegistry' && (
                <AdminSchoolRegistryTab
                    users={users}
                    isLoadingUsers={isLoadingUsers}
                    adminUid={firebaseUser?.uid ?? ''}
                />
            )}

            {activeTab === 'users' && (
                <AdminUsersTab
                    users={users}
                    isLoadingUsers={isLoadingUsers}
                    userError={userError}
                    userSearch={userSearch}
                    setUserSearch={setUserSearch}
                    updatingUid={updatingUid}
                    currentUid={firebaseUser?.uid}
                    schools={schools}
                    handleChangeRole={handleChangeRole}
                    handleUpdateSubscription={handleUpdateSubscription}
                    handleDeleteUser={handleDeleteUser}
                    onRefresh={loadUsers}
                />
            )}

            {activeTab === 'subscribers' && (
                <AdminSubscribersTab
                    users={users}
                    isLoadingUsers={isLoadingUsers}
                    onRefresh={loadUsers}
                />
            )}

            {activeTab === 'stats' && (
                <AdminStatsTab
                    nationalStats={nationalStats}
                    isLoadingStats={isLoadingStats}
                    conceptNameMap={conceptNameMap}
                    onRefresh={loadNationalStats}
                />
            )}

            {activeTab === 'forum' && (
                <AdminForumTab
                    forumThreads={forumThreads}
                    isLoadingForum={isLoadingForum}
                    forumSearch={forumSearch}
                    setForumSearch={setForumSearch}
                    forumActionUid={forumActionUid}
                    handleForumDelete={handleForumDelete}
                    handleForumRestore={handleForumRestore}
                    handleForumApprove={handleForumApprove}
                    onRefresh={loadForumThreads}
                />
            )}

            {activeTab === 'content' && (
                <AdminContentTab
                    ragIndexStatus={ragIndexStatus}
                    ragIndexLog={ragIndexLog}
                    ragStats={ragStats}
                    ragEnabled={ragEnabled}
                    handleIndexGrade={handleIndexGrade}
                    handleRefreshRagStats={handleRefreshRagStats}
                    handleToggleRag={handleToggleRag}
                />
            )}

            {activeTab === 'cohort' && (
                <CohortDashboard
                    users={cohortUsers}
                    burnUsers={cohortBurn}
                    isLoading={isLoadingCohort}
                    now={cohortClock}
                    onRefresh={loadCohort}
                />
            )}
        </div>
    );
};
