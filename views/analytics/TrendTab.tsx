import React from 'react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';

interface TrendTabProps {
    weeklyTrend: { label: string; avg: number; count: number }[];
}

export const TrendTab: React.FC<TrendTabProps> = ({ weeklyTrend }) => (
    <SilentErrorBoundary name="TrendTab">
        <Card>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">Неделен тренд — просечен резултат</h2>
            {weeklyTrend.length < 2 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                    Потребни се резултати од барем 2 недели за да се прикаже трендот.
                </p>
            ) : (
                <div className="space-y-3">
                    {weeklyTrend.map((w, i) => {
                        const barColor = w.avg >= 70 ? 'bg-green-400' : w.avg >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                        const prev = i > 0 ? weeklyTrend[i - 1].avg : w.avg;
                        const delta = w.avg - prev;
                        return (
                            <div key={w.label} className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-16 flex-shrink-0">{w.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${barColor} transition-all`}
                                        style={{ width: `${w.avg}%` }}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                                        {w.avg}%
                                    </span>
                                </div>
                                <span className="text-xs w-16 flex-shrink-0 text-right">
                                    <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}>
                                        {i > 0 && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}%` : ''}
                                    </span>
                                </span>
                                <span className="text-xs text-gray-400 w-16 flex-shrink-0">{w.count} обид{w.count === 1 ? '' : 'и'}</span>
                            </div>
                        );
                    })}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> ≥70%</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> 50–69%</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> &lt;50%</span>
                    </div>
                </div>
            )}
        </Card>
    </SilentErrorBoundary>
);
