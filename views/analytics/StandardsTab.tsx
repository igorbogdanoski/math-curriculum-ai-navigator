import React from 'react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { ScoreBar } from './shared';

interface TestedStandard {
    standard: { id: string; code: string; description: string };
    avgScore: number;
    conceptCount: number;
}

interface StandardsTabProps {
    standardsCoverage: {
        tested: TestedStandard[];
        notTested: any[];
    };
}

export const StandardsTab: React.FC<StandardsTabProps> = ({ standardsCoverage }) => (
    <SilentErrorBoundary name="StandardsTab">
        <div className="space-y-4">
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                        Покриеност на Национални стандарди — врз основа на реални квизови
                    </h2>
                    <span className="text-xs font-semibold text-gray-400">{standardsCoverage.tested.length} тестирани</span>
                </div>
                {standardsCoverage.tested.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                        Нема концепти со nationalStandardIds во резултатите. Потребни се квизови поврзани со концепти.
                    </p>
                ) : (
                    <div className="space-y-2.5">
                        {standardsCoverage.tested.map(({ standard, avgScore, conceptCount }) => {
                            const barColor = avgScore >= 70 ? 'bg-green-400' : avgScore >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                            const textColor = avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-yellow-600' : 'text-red-500';
                            return (
                                <div key={standard.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex-shrink-0 w-16 text-center">
                                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                            {standard.code}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 truncate mb-1">{standard.description}</p>
                                        <ScoreBar pct={Math.max(avgScore, 3)} color={barColor} />
                                    </div>
                                    <div className="flex-shrink-0 text-right w-20">
                                        <p className={`text-lg font-black ${textColor}`}>{avgScore}%</p>
                                        <p className="text-xs text-gray-400">{conceptCount} концепт{conceptCount === 1 ? '' : 'и'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                    Прикажани се само стандарди кои се директно поврзани со концепти тестирани преку Ученичкиот Портал.
                    За целосна анализа на покриеноста (вклучувајќи lesson plans) посети ја страницата Анализа на Покриеност.
                </p>
            </Card>
        </div>
    </SilentErrorBoundary>
);
