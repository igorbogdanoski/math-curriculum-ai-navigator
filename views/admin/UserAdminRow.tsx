import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
    teacher:      '🎓 Наставник',
    school_admin: '🏫 Директор',
    admin:        '🛡️ Систем Админ',
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

interface UserAdminRowProps {
    u: any;
    isMe: boolean;
    schools: any[];
    updatingUid: string | null;
    handleChangeRole: (uid: string, role: 'teacher' | 'school_admin' | 'admin', schoolId?: string) => void;
    handleUpdateSubscription: (uid: string, credits: number, isPremium: boolean, hasUnlimitedCredits: boolean, tier: 'Free' | 'Pro' | 'Unlimited') => void;
    handleDeleteUser: (uid: string) => void;
}

export const UserAdminRow: React.FC<UserAdminRowProps> = ({ u, isMe, schools, updatingUid, handleChangeRole, handleUpdateSubscription, handleDeleteUser }) => {
    const role = u.role ?? 'teacher';
    const [isEditing, setIsEditing] = useState(false);
    const [editCredits, setEditCredits] = useState(u.aiCreditsBalance || 0);
    const [editPremium, setEditPremium] = useState(u.isPremium || false);
    const [editUnlimited, setEditUnlimited] = useState(u.hasUnlimitedCredits || false);
    const [editTier, setEditTier] = useState<'Free' | 'Pro' | 'Unlimited'>(u.tier || 'Free');

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
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {(u.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                        {u.name ?? 'Непознат'}
                        {isMe && <span className="text-[10px] text-amber-600 font-bold">(ти)</span>}
                        {u.isPremium && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded font-bold">PRO</span>}
                        {u.hasUnlimitedCredits && <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-bold">∞</span>}
                        {u.proExpiresAt && new Date(u.proExpiresAt) < new Date() && (
                            <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">ИСТЕЧЕНО</span>
                        )}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate font-mono">{u.email || u.uid}</p>
                    {u.proExpiresAt && (
                        <p className={`text-[11px] truncate ${new Date(u.proExpiresAt) < new Date() ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                            Pro истекува: {new Date(u.proExpiresAt).toLocaleDateString('mk-MK')}
                        </p>
                    )}
                    {u.schoolId && (
                        <p className="text-[11px] text-gray-400 truncate">🏫 {schools.find((s: any) => s.id === u.schoolId)?.name ?? u.schoolId}</p>
                    )}
                </div>
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
                    {!isMe && !u.name && (
                        <button
                            type="button"
                            onClick={() => handleDeleteUser(u.uid)}
                            title="Избриши непознат корисник"
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {isEditing && !isMe && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-1 ml-12 space-y-3 text-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Уреди претплата — {u.name ?? u.uid}</p>
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
                            <input type="checkbox" checked={editPremium} onChange={e => setEditPremium(e.target.checked)} className="rounded" />
                            Premium
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editUnlimited}
                                onChange={e => { setEditUnlimited(e.target.checked); if (e.target.checked) setEditPremium(true); }}
                                className="rounded"
                            />
                            Неограничени (∞)
                        </label>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => { handleUpdateSubscription(u.uid, editCredits, editPremium, editUnlimited, editTier); setIsEditing(false); }}
                            disabled={updatingUid === u.uid}
                            className="bg-brand-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/90 disabled:opacity-40 transition"
                        >
                            {updatingUid === u.uid ? 'Зачувувам...' : '✓ Зачувај'}
                        </button>
                        <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition">
                            Откажи
                        </button>
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
