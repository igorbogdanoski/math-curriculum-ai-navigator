import React from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { ScoreBar, type ConceptStat, confidenceEmoji, confidenceColor } from './shared';

interface ConceptsTabProps {
    allConceptStats: ConceptStat[];
    onGenerateRemedial: (conceptId: string, title: string, avgPct: number) => void;
}

export const ConceptsTab: React.FC<ConceptsTabProps> = ({ allConceptStats, onGenerateRemedial }) => (
    <SilentErrorBoundary name="ConceptsTab">
        <Card>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Перформанси по концепт</h2>
                <span className="text-xs font-semibold text-gray-400">{allConceptStats.length} концепт{allConceptStats.length === 1 ? '' : 'и'}</span>
            </div>
            {allConceptStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    Нема квизови поврзани со концепти. Квизовите треба да бидат генерирани преку конкретен концепт за да се прикажат тука.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                <th className="py-2 px-3 font-semibold">Концепт</th>
                                <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                <th className="py-2 px-3 text-center font-semibold">Положиле</th>
                                <th className="py-2 px-3 text-center font-semibold">Ученици</th>
                                <th className="py-2 px-3 text-center font-semibold">Совладани</th>
                                <th className="py-2 px-3 text-center font-semibold">Доверба</th>
                                <th className="py-2 px-3 font-semibold">Акција</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allConceptStats.map(c => {
                                const avgColor = c.avgPct >= 70 ? 'text-green-600' : c.avgPct >= 50 ? 'text-yellow-600' : 'text-red-500';
                                const rowBg = c.avgPct >= 70 ? '' : c.avgPct >= 50 ? 'bg-yellow-50/40' : 'bg-red-50/40';
                                return (
                                    <tr key={c.conceptId} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${rowBg}`}>
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                {c.avgPct < 50 && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                                <span className="font-semibold text-slate-700 text-xs leading-tight">{c.title}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-gray-600">{c.attempts}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`font-bold text-base ${avgColor}`}>{c.avgPct}%</span>
                                                <div className="w-16">
                                                    <ScoreBar pct={Math.max(c.avgPct, 2)} color={c.avgPct >= 70 ? 'bg-green-400' : c.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-gray-600">{c.passRate}%</td>
                                        <td className="py-2.5 px-3 text-center text-gray-600">{c.uniqueStudents || '—'}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            {c.masteredCount > 0
                                                ? <span className="flex items-center justify-center gap-1 text-yellow-700 font-bold text-xs">
                                                    <Trophy className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" />
                                                    {c.masteredCount}
                                                  </span>
                                                : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            <span className={`text-sm ${confidenceColor(c.avgConfidence)}`}>
                                                {confidenceEmoji(c.avgConfidence)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <button
                                                type="button"
                                                onClick={() => onGenerateRemedial(c.conceptId, c.title, c.avgPct)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                                                    c.avgPct < 70
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                }`}
                                            >
                                                {c.avgPct < 70 ? 'Ремедијален' : 'Збогатување'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                        Концептите се сортирани по просечен резултат — најслабите се прикажани прво. Бојата на редот: <span className="text-red-400 font-semibold">Под 50%</span> · <span className="text-yellow-600 font-semibold">50–69%</span> · <span className="text-green-600 font-semibold">≥70%</span>.
                    </p>
                </div>
            )}
        </Card>
    </SilentErrorBoundary>
);
