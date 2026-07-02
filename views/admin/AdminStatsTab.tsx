import React from 'react';
import { Card } from '../../components/common/Card';
import { Building, Users, Globe, BarChart2, TrendingDown } from 'lucide-react';

interface AdminStatsTabProps {
    nationalStats: any;
    isLoadingStats: boolean;
    conceptNameMap: Record<string, string>;
    onRefresh: () => void;
}

export function AdminStatsTab({ nationalStats, isLoadingStats, conceptNameMap, onRefresh }: AdminStatsTabProps) {
    return (
        <div className="space-y-6">
            {isLoadingStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : nationalStats ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Училишта',   value: nationalStats.totalSchools,  icon: <Building className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
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

                    {nationalStats.gradeStats.length > 0 && (
                        <Card className="p-6">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BarChart2 className="w-4 h-4" /> Национален просек по одделение
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

                    {nationalStats.weakConcepts.length > 0 && (
                        <Card className="p-6">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-red-400" /> Топ 10 концепти со слаба совладаност (национален пресек)
                            </h2>
                            <div className="divide-y divide-gray-100">
                                {nationalStats.weakConcepts.map((c: any, i: number) => (
                                    <div key={c.conceptId} className="flex items-center gap-3 py-2.5 text-sm">
                                        <span className="w-6 text-center font-bold text-gray-400">{i + 1}</span>
                                        <span className="flex-1 text-gray-700 truncate text-xs font-medium" title={c.conceptId}>{conceptNameMap[c.conceptId] ?? c.conceptId}</span>
                                        <div className="w-32 h-3 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max(c.avgPct, 2)}%` }} />
                                        </div>
                                        <span className="w-10 text-right font-bold text-red-500">{c.avgPct}%</span>
                                        <span className="text-xs text-gray-400 w-16 text-right">{c.attempts} обиди</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {nationalStats.gradeStats.length === 0 && nationalStats.weakConcepts.length === 0 && (
                        <Card className="p-8 text-center text-gray-400 text-sm">Нема доволно податоци за национална статистика.</Card>
                    )}
                </>
            ) : null}
            <div className="flex justify-end">
                <button type="button" onClick={onRefresh} className="text-xs text-gray-500 hover:text-gray-700 underline">Освежи</button>
            </div>
        </div>
    );
}
