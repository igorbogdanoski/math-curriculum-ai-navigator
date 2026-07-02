import React from 'react';
import { Card } from '../../components/common/Card';
import { Users } from 'lucide-react';
import { UserAdminRow } from './UserAdminRow';

const TRACK_LABELS: Record<string, string> = {
    vocational4: 'Стручно 4г',
    vocational3: 'Стручно 3г',
    vocational2: 'Стручно 2г',
    gymnasium:   'Гимназија',
    gymnasium_elective: 'Гимн. изб.',
};

interface AdminUsersTabProps {
    users: any[];
    isLoadingUsers: boolean;
    userError: string;
    userSearch: string;
    setUserSearch: (v: string) => void;
    updatingUid: string | null;
    currentUid: string | undefined;
    schools: any[];
    handleChangeRole: (uid: string, role: 'teacher' | 'school_admin' | 'admin', schoolId?: string) => void;
    handleUpdateSubscription: (uid: string, credits: number, isPremium: boolean, hasUnlimitedCredits: boolean, tier: 'Free' | 'Pro' | 'Unlimited') => void;
    handleDeleteUser: (uid: string) => void;
    onRefresh: () => void;
}

export function AdminUsersTab({
    users, isLoadingUsers, userError, userSearch, setUserSearch,
    updatingUid, currentUid, schools,
    handleChangeRole, handleUpdateSubscription, handleDeleteUser, onRefresh,
}: AdminUsersTabProps) {
    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-500" />
                    Регистрирани корисници ({users.length})
                </h2>
                <button type="button" onClick={onRefresh} className="text-xs text-gray-500 hover:text-gray-700 underline">Освежи</button>
            </div>

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

            {users.length > 0 && (() => {
                const primary = users.filter(u => !u.secondaryTrack).length;
                const secondary = users.filter(u => !!u.secondaryTrack);
                const trackCounts: Record<string, number> = {};
                secondary.forEach(u => { trackCounts[u.secondaryTrack] = (trackCounts[u.secondaryTrack] ?? 0) + 1; });
                return (
                    <div className="flex flex-wrap gap-2 mb-4 text-xs border-t border-gray-100 pt-3">
                        <span className="text-gray-400 text-[10px] uppercase tracking-wide self-center mr-1">Програма:</span>
                        <span className="px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600">📘 Основно: {primary}</span>
                        {Object.entries(trackCounts).map(([track, count]) => (
                            <span key={track} className="px-2.5 py-1 rounded-full font-bold bg-teal-50 text-teal-700 border border-teal-100">
                                🎓 {TRACK_LABELS[track] ?? track}: {count}
                            </span>
                        ))}
                        {secondary.length > 0 && (
                            <span className="px-2.5 py-1 rounded-full font-bold bg-indigo-50 text-indigo-700">Средно вкупно: {secondary.length}</span>
                        )}
                    </div>
                );
            })()}

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
                                isMe={u.uid === currentUid}
                                schools={schools}
                                updatingUid={updatingUid}
                                handleChangeRole={handleChangeRole}
                                handleUpdateSubscription={handleUpdateSubscription}
                                handleDeleteUser={handleDeleteUser}
                            />
                        ))
                    }
                </div>
            )}
        </Card>
    );
}
