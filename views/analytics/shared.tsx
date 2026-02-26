import React from 'react';
import { Card } from '../../components/common/Card';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const fmt = (n: number, decimals = 1) => n.toFixed(decimals);

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const k = key(item);
        if (!result[k]) result[k] = [];
        result[k].push(item);
    }
    return result;
}

export function formatDate(ts: any): string {
    if (!ts) return '—';
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuizAggregate {
    quizId: string;
    quizTitle: string;
    attempts: number;
    avgPct: number;
    bestPct: number;
    worstPct: number;
    passRate: number;
}

export interface ConceptStat {
    conceptId: string;
    title: string;
    avgPct: number;
    attempts: number;
    passRate: number;
    uniqueStudents: number;
    masteredCount: number;
}

export interface PerStudentStat {
    name: string;
    attempts: number;
    avg: number;
    passRate: number;
    masteredCount: number;
    lastAttempt: any;
}

// ── Sub-components ───────────────────────────────────────────────────────────

export const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color: string }> = ({ icon, label, value, sub, color }) => (
    <Card className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
            {icon}
        </div>
        <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">{label}</p>
            <p className="text-2xl font-bold text-brand-primary leading-tight">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </Card>
);

// Progress bar components use style= for dynamic widths (CSS custom properties).
// This is React-idiomatic for runtime values — Tailwind can't generate arbitrary
// runtime classes. Same pattern as InteractiveQuizPlayer.tsx line 257.

// eslint-disable-next-line react/forbid-component-props
export const ScoreBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`analytics-bar h-full ${color} rounded-full`} data-pct={Math.max(pct, 0)} style={{ '--bar-pct': Math.max(pct, 0) } as React.CSSProperties} />
        </div>
        <span className="w-8 text-right text-gray-500">{fmt(pct, 0)}%</span>
    </div>
);

export const QuizRow: React.FC<{ agg: QuizAggregate }> = ({ agg }) => {
    const scoreColor = agg.avgPct >= 70 ? 'text-green-600' : agg.avgPct >= 50 ? 'text-yellow-600' : 'text-red-500';
    return (
        <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
            <td className="py-3 px-4">
                <p className="font-semibold text-sm text-brand-primary line-clamp-2">{agg.quizTitle}</p>
                <p className="text-xs text-gray-400">{agg.quizId}</p>
            </td>
            <td className="py-3 px-4 text-center">
                <span className="font-bold text-gray-700">{agg.attempts}</span>
            </td>
            <td className={`py-3 px-4 text-center font-bold text-lg ${scoreColor}`}>
                {fmt(agg.avgPct, 0)}%
            </td>
            <td className="py-3 px-4 text-center text-green-600 font-semibold">{fmt(agg.bestPct, 0)}%</td>
            <td className="py-3 px-4 text-center text-red-500 font-semibold">{fmt(agg.worstPct, 0)}%</td>
            <td className="py-3 px-4 text-center">
                <span className={`text-sm font-bold ${agg.passRate >= 70 ? 'text-green-600' : agg.passRate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {fmt(agg.passRate, 0)}%
                </span>
            </td>
        </tr>
    );
};
