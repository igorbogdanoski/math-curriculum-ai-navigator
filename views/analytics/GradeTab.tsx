import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { ScoreBar, type GradeStat } from './shared';

interface GradeTabProps {
    gradeStats: GradeStat[];
}

const GRADE_LABELS: Record<string, string> = {
    '1': '1-во одделение',
    '2': '2-ро одделение',
    '3': '3-то одделение',
    '4': '4-то одделение',
    '5': '5-то одделение',
    '6': '6-то одделение',
    '7': '7-мо одделение',
    '8': '8-мо одделение',
    '9': '9-то одделение',
    'N/A': 'Без одделение',
};

export const GradeTab: React.FC<GradeTabProps> = ({ gradeStats }) => (
    <SilentErrorBoundary name="GradeTab">
        <Card>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">По одделение — споредба на перформанси</h2>
                <span className="text-xs font-semibold text-gray-400">{gradeStats.length} одделени{gradeStats.length === 1 ? 'е' : 'ја'}</span>
            </div>

            {gradeStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    Нема квизови поврзани со одделение. Квизовите треба да имаат доделено одделение за да се прикажат тука.
                </p>
            ) : (
                <>
                    {/* Visual bar comparison */}
                    <div className="space-y-4 mb-8">
                        {gradeStats.map(g => {
                            const barColor = g.avgPct >= 70 ? 'bg-green-400' : g.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                            const badgeColor = g.avgPct >= 70 ? 'bg-green-100 text-green-700' : g.avgPct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                            return (
                                <div key={g.grade} className="flex items-center gap-4">
                                    <span className="text-sm font-semibold text-slate-700 w-36 flex-shrink-0">
                                        {GRADE_LABELS[g.grade] ?? `${g.grade}-то одд.`}
                                    </span>
                                    <div className="flex-1">
                                        <ScoreBar pct={Math.max(g.avgPct, 2)} color={barColor} />
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
                                        {g.avgPct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                    <th className="py-2 px-3 font-semibold">Одделение</th>
                                    <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                    <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                    <th className="py-2 px-3 text-center font-semibold">Положиле</th>
                                    <th className="py-2 px-3 text-center font-semibold">Ученици</th>
                                    <th className="py-2 px-3 text-center font-semibold">Совладани</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gradeStats.map(g => {
                                    const avgColor = g.avgPct >= 70 ? 'text-green-600' : g.avgPct >= 50 ? 'text-yellow-600' : 'text-red-500';
                                    const rowBg = g.avgPct >= 70 ? '' : g.avgPct >= 50 ? 'bg-yellow-50/40' : 'bg-red-50/40';
                                    return (
                                        <tr key={g.grade} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${rowBg}`}>
                                            <td className="py-2.5 px-3">
                                                <span className="font-semibold text-slate-700 text-xs leading-tight">
                                                    {GRADE_LABELS[g.grade] ?? `${g.grade}-то одд.`}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{g.attempts}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`font-bold text-base ${avgColor}`}>{g.avgPct}%</span>
                                                    <div className="w-16">
                                                        <ScoreBar pct={Math.max(g.avgPct, 2)} color={g.avgPct >= 70 ? 'bg-green-400' : g.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{g.passRate}%</td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{g.uniqueStudents || '—'}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                {g.masteredCount > 0
                                                    ? <span className="flex items-center justify-center gap-1 text-yellow-700 font-bold text-xs">
                                                        <Trophy className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                                                        {g.masteredCount}
                                                      </span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                            Одделенијата се сортирани по број на одделение. Бојата на редот: <span className="text-red-400 font-semibold">Под 50%</span> · <span className="text-yellow-600 font-semibold">50–69%</span> · <span className="text-green-600 font-semibold">≥70%</span>.
                        </p>
                    </div>
                </>
            )}
        </Card>
    </SilentErrorBoundary>
);
