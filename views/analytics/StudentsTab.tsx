import React from 'react';
import { Trophy } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { GradeBadge } from '../../components/common/GradeBadge';
import type { PerStudentStat } from './shared';

interface StudentsTabProps {
    perStudentStats: PerStudentStat[];
}

export const StudentsTab: React.FC<StudentsTabProps> = ({ perStudentStats }) => (
    <SilentErrorBoundary name="StudentsTab">
        <Card>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Индивидуален преглед по ученик</h2>
            {perStudentStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    Нема ученици со внесено ime. Учениците треба да го внесат своето ime при играње квиз.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                <th className="py-2 px-3 font-semibold">Ученик</th>
                                <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                <th className="py-2 px-3 text-center font-semibold">Положиле</th>
                                <th className="py-2 px-3 text-center font-semibold">Совладани</th>
                                <th className="py-2 px-3 text-center font-semibold">Статус</th>
                                <th className="py-2 px-3 font-semibold">Акција</th>
                            </tr>
                        </thead>
                        <tbody>
                            {perStudentStats.map(s => {
                                return (
                                    <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-2.5 px-3 font-semibold text-slate-700">{s.name}</td>
                                        <td className="py-2.5 px-3 text-center text-gray-600">{s.attempts}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className="flex items-center justify-center gap-1.5">
                                                <span className={`font-bold ${s.avg >= 70 ? 'text-green-600' : s.avg >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                    {s.avg}%
                                                </span>
                                                <GradeBadge pct={s.avg} />
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-gray-600">{s.passRate}%</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className="flex items-center justify-center gap-1">
                                                {s.masteredCount > 0 && <Trophy className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />}
                                                {s.masteredCount}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <GradeBadge pct={s.avg} showLabel={true} className="px-2 py-0.5 rounded-full" />
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <button
                                                type="button"
                                                onClick={() => { window.location.hash = `/my-progress?name=${encodeURIComponent(s.name)}`; }}
                                                className="text-xs font-bold text-indigo-600 hover:underline"
                                            >
                                                Прогрес →
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    </SilentErrorBoundary>
);
