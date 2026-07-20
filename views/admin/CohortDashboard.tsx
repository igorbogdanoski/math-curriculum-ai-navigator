import React, { useMemo } from 'react';
import { Card } from '../../components/common/Card';
import { BarChart2, TrendingDown, Activity, RefreshCw } from 'lucide-react';
import {
    computeActivityCounts,
    computeStickinessRatio,
    bucketWeeklyCohorts,
    computeCreditBurnRatio,
    type UserActivityRecord,
    type CohortRetentionPoint,
} from '../../utils/cohortMetrics';
import { useLanguage } from '../../i18n/LanguageContext';

interface CohortDashboardProps {
    users: UserActivityRecord[] | null;
    burnUsers: { aiCreditsBalance?: number }[];
    isLoading: boolean;
    now: number;
    onRefresh: () => void;
}

export const CohortDashboard: React.FC<CohortDashboardProps> = ({ users, burnUsers, isLoading, now, onRefresh }) => {
    const { t } = useLanguage();
    const counts = useMemo(() => users ? computeActivityCounts(users, now) : null, [users, now]);
    const stickiness = useMemo(() => counts ? computeStickinessRatio(counts) : null, [counts]);
    const cohorts = useMemo<CohortRetentionPoint[]>(
        () => users ? bucketWeeklyCohorts(users, now, 8) : [],
        [users, now],
    );
    const burnRatio = useMemo(() => computeCreditBurnRatio(burnUsers, 50, 0), [burnUsers]);

    if (isLoading || !counts) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    const kpis = [
        { label: 'DAU (24h)',       value: counts.dau,             color: 'bg-emerald-50 text-emerald-700' },
        { label: 'WAU (7d)',        value: counts.wau,             color: 'bg-blue-50 text-blue-700' },
        { label: 'MAU (30d)',       value: counts.mau,             color: 'bg-indigo-50 text-indigo-700' },
        { label: t('admin.cohort.registered'),    value: counts.totalRegistered, color: 'bg-slate-50 text-slate-700' },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map(k => (
                    <Card key={k.label} className={`p-5 ${k.color}`}>
                        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{k.label}</p>
                        <p className="text-3xl font-bold mt-1">{k.value}</p>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> {t('admin.cohort.stickinessTitle')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                        {stickiness == null ? '—' : `${(stickiness * 100).toFixed(1)}%`}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">{t('admin.cohort.stickinessGoal')}</p>
                </Card>
                <Card className="p-5">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" /> {t('admin.cohort.creditBurnTitle')}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">{`${(burnRatio * 100).toFixed(1)}%`}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{t('admin.cohort.creditBurnGoal')}</p>
                </Card>
            </div>

            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" /> {t('admin.cohort.weeklyCohortsTitle')}
                    </h2>
                    <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline">
                        <RefreshCw className="w-3.5 h-3.5" /> {t('admin.users.refresh')}
                    </button>
                </div>
                {cohorts.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">
                        {t('admin.cohort.noRegistrations')}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="text-gray-400 uppercase tracking-widest">
                                <tr>
                                    <th className="text-left py-2 pr-3">{t('admin.cohort.colCohort')}</th>
                                    <th className="text-right py-2 pr-3">{t('admin.cohort.colSize')}</th>
                                    {[0, 1, 3, 7, 14, 30].map(d => (
                                        <th key={d} className="text-right py-2 pr-3">D+{d}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {cohorts.map(c => (
                                    <tr key={c.cohortStart} className="border-t border-gray-100">
                                        <td className="py-2 pr-3 font-mono">{new Date(c.cohortStart).toISOString().slice(0, 10)}</td>
                                        <td className="py-2 pr-3 text-right font-bold">{c.cohortSize}</td>
                                        {[0, 1, 3, 7, 14, 30].map(d => {
                                            const ret = c.retainedByDay[d] ?? 0;
                                            const pct = c.cohortSize > 0 ? Math.round((ret / c.cohortSize) * 100) : 0;
                                            return (
                                                <td key={d} className="py-2 pr-3 text-right">
                                                    {ret > 0 ? (
                                                        <span className={`font-semibold ${pct >= 50 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                            {pct}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="text-[10px] text-gray-400 mt-3">
                    {t('admin.cohort.footerNote')}
                </p>
            </Card>
        </div>
    );
};
