import React, { useMemo } from 'react';
import { Card } from '../../components/common/Card';
import { Crown, Building2, Sparkles, Wallet } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { PRO_PRICE_MKD } from '../../data/pricingConstants';

interface SubscriberUser {
    uid: string;
    name?: string;
    email?: string;
    tier?: string;
    isPremium?: boolean;
    upgradedAt?: string;
    proExpiresAt?: string;
    stripeCustomerId?: string;
}

interface AdminSubscribersTabProps {
    users: SubscriberUser[];
    isLoadingUsers: boolean;
    onRefresh: () => void;
}

const TIER_STYLES: Record<string, { icon: React.ElementType; badge: string }> = {
    Pro: { icon: Crown, badge: 'bg-indigo-100 text-indigo-700' },
    School: { icon: Building2, badge: 'bg-purple-100 text-purple-700' },
    Unlimited: { icon: Sparkles, badge: 'bg-amber-100 text-amber-700' },
};

function formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('mk-MK');
}

// 2026-07-20 (Wave 13.1, drifting-snuggling-wave.md): before this tab, there was zero admin
// visibility into who is actually paying — SystemAdminView could edit a user's subscription
// fields one-by-one via AdminUsersTab, but nothing summarized who's Pro/School/Unlimited or
// what that's worth. Reuses the `users` array already fetched for the Users tab — no new query.
export function AdminSubscribersTab({ users, isLoadingUsers, onRefresh }: AdminSubscribersTabProps) {
    const { t } = useLanguage();

    const subscribers = useMemo(() => {
        return users
            .filter(u => u.isPremium || (u.tier && u.tier !== 'Free'))
            .sort((a, b) => (b.upgradedAt ?? '').localeCompare(a.upgradedAt ?? ''));
    }, [users]);

    const tierCounts = useMemo(() => {
        const counts: Record<string, number> = { Pro: 0, School: 0, Unlimited: 0 };
        subscribers.forEach(u => {
            const tier = u.tier && counts[u.tier] !== undefined ? u.tier : 'Pro';
            counts[tier] += 1;
        });
        return counts;
    }, [subscribers]);

    // Only the Pro tier has a fixed, known price (PRO_PRICE_MKD) — School/Unlimited are
    // negotiated by-contract (see SchoolPricingView, Wave 13.3), so they're excluded from
    // this estimate rather than guessed at.
    const estimatedProRevenue = tierCounts.Pro * PRO_PRICE_MKD;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: t('admin.subscribers.totalPaying'), value: subscribers.length, icon: <Wallet className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
                    { label: t('admin.subscribers.tierPro'), value: tierCounts.Pro, icon: <Crown className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
                    { label: t('admin.subscribers.tierSchool'), value: tierCounts.School, icon: <Building2 className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50' },
                    { label: t('admin.subscribers.estimatedProRevenue'), value: `${estimatedProRevenue.toLocaleString('mk-MK')} МКД`, icon: <Sparkles className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
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

            <Card className="p-0 overflow-hidden">
                {isLoadingUsers ? (
                    <div className="p-6 space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
                    </div>
                ) : subscribers.length === 0 ? (
                    <p className="p-8 text-center text-gray-400 text-sm">{t('admin.subscribers.noneYet')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.subscribers.colTeacher')}</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.subscribers.colTier')}</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.subscribers.colUpgradedAt')}</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.subscribers.colExpiresAt')}</th>
                                    <th className="text-left px-4 py-3 text-gray-500 font-medium">{t('admin.subscribers.colStripe')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {subscribers.map(u => {
                                    const tier = u.tier && TIER_STYLES[u.tier] ? u.tier : 'Pro';
                                    const style = TIER_STYLES[tier];
                                    const Icon = style.icon;
                                    return (
                                        <tr key={u.uid}>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-800">{u.name ?? '—'}</p>
                                                {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.badge}`}>
                                                    <Icon className="w-3.5 h-3.5" /> {tier}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{formatDate(u.upgradedAt)}</td>
                                            <td className="px-4 py-3 text-gray-600">{formatDate(u.proExpiresAt)}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-400">
                                                {u.stripeCustomerId ? u.stripeCustomerId.slice(0, 14) + '…' : t('admin.subscribers.manualActivation')}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <div className="flex justify-end">
                <button type="button" onClick={onRefresh} className="text-xs text-gray-500 hover:text-gray-700 underline">{t('admin.users.refresh')}</button>
            </div>
        </div>
    );
}
