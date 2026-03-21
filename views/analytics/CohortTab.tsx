/**
 * CohortTab — Класна Компаративна Аналитика (Ж6.1)
 *
 * Provides class-level cohort insights for the teacher:
 * 1. Performance distribution (4 segments: failing / at-risk / passing / mastery)
 * 2. Top 5 strongest + weakest concepts (systematic class gaps)
 * 3. Month-over-month trend (is the class improving?)
 * 4. Student segments by mastery level
 *
 * Педагошка основа: Data-Driven Decision Making, Formative Assessment
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Award, BarChart2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { NationalBenchmarkCard } from '../../components/analytics/NationalBenchmarkCard';
import { groupBy, fmt } from './shared';
import type { QuizResult } from '../../services/firestoreService.types';

interface Props {
    results: QuizResult[];
    teacherUid: string;
    gradeLevel: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(ts: any): string {
    try {
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch {
        return 'unknown';
    }
}

function getMonthLabel(key: string): string {
    const months = ['Јан', 'Фев', 'Мар', 'Апр', 'Мај', 'Јун', 'Јул', 'Авг', 'Сеп', 'Окт', 'Ное', 'Дек'];
    const [, m] = key.split('-');
    return months[parseInt(m) - 1] || key;
}

// ── Bar component ─────────────────────────────────────────────────────────────

const PercentBar: React.FC<{ pct: number; color: string; label: string; value: string }> = ({ pct, color, label, value }) => (
    <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-28 shrink-0 truncate">{label}</span>
        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.max(pct, 2)}%` }}
            />
        </div>
        <span className="text-xs font-bold text-gray-700 w-10 text-right shrink-0">{value}</span>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const CohortTab: React.FC<Props> = ({ results, teacherUid, gradeLevel }) => {
    // ── 1. Performance distribution ──────────────────────────────────────────
    const distribution = useMemo(() => {
        if (results.length === 0) return { fail: 0, risk: 0, pass: 0, mastery: 0, total: 0 };
        const total = results.length;
        const fail    = results.filter(r => r.percentage < 50).length;
        const risk    = results.filter(r => r.percentage >= 50 && r.percentage < 70).length;
        const pass    = results.filter(r => r.percentage >= 70 && r.percentage < 85).length;
        const mastery = results.filter(r => r.percentage >= 85).length;
        return {
            fail:    Math.round((fail / total) * 100),
            risk:    Math.round((risk / total) * 100),
            pass:    Math.round((pass / total) * 100),
            mastery: Math.round((mastery / total) * 100),
            total,
        };
    }, [results]);

    // ── 2. Concept performance ────────────────────────────────────────────────
    const conceptStats = useMemo(() => {
        const byConceptId = groupBy(results.filter(r => r.conceptId), r => r.conceptId!);
        return Object.entries(byConceptId)
            .map(([conceptId, items]) => ({
                conceptId,
                label: items[0]?.quizTitle?.split('—')[0]?.trim() || conceptId,
                avg: items.reduce((s, r) => s + r.percentage, 0) / items.length,
                count: items.length,
            }))
            .filter(c => c.count >= 2) // At least 2 attempts for statistical relevance
            .sort((a, b) => b.avg - a.avg);
    }, [results]);

    const strongest = conceptStats.slice(0, 5);
    const weakest   = [...conceptStats].sort((a, b) => a.avg - b.avg).slice(0, 5);

    // ── 3. Monthly trend ──────────────────────────────────────────────────────
    const monthlyTrend = useMemo(() => {
        const byMonth = groupBy(
            results.filter(r => r.playedAt),
            r => getMonthKey(r.playedAt),
        );
        return Object.entries(byMonth)
            .map(([month, items]) => ({
                month,
                label: getMonthLabel(month),
                avg: items.reduce((s, r) => s + r.percentage, 0) / items.length,
                count: items.length,
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-6); // Last 6 months
    }, [results]);

    const trendDirection = useMemo(() => {
        if (monthlyTrend.length < 2) return 'neutral';
        const last  = monthlyTrend[monthlyTrend.length - 1].avg;
        const prev  = monthlyTrend[monthlyTrend.length - 2].avg;
        if (last - prev > 3) return 'up';
        if (prev - last > 3) return 'down';
        return 'neutral';
    }, [monthlyTrend]);

    // ── 4. Student segments ───────────────────────────────────────────────────
    const studentSegments = useMemo(() => {
        const byStudent = groupBy(
            results.filter(r => r.studentName),
            r => r.studentName!,
        );
        const students = Object.entries(byStudent).map(([name, items]) => ({
            name,
            avg: items.reduce((s, r) => s + r.percentage, 0) / items.length,
            count: items.length,
        }));
        const total = students.length || 1;
        const mastery  = students.filter(s => s.avg >= 85).length;
        const onTrack  = students.filter(s => s.avg >= 70 && s.avg < 85).length;
        const atRisk   = students.filter(s => s.avg >= 50 && s.avg < 70).length;
        const critical = students.filter(s => s.avg < 50).length;
        return { mastery, onTrack, atRisk, critical, total };
    }, [results]);

    if (results.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400">
                <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Нема доволно податоци за кохортна анализа</p>
                <p className="text-sm mt-1">Потребни се барем неколку квиз резултати</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* ── Summary KPIs ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Вкупно обиди', value: distribution.total.toString(), color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
                    { label: 'Просечен резултат', value: `${fmt(results.reduce((s, r) => s + r.percentage, 0) / results.length)}%`, color: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
                    { label: 'Стапка на полагање (≥70%)', value: `${distribution.pass + distribution.mastery}%`, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
                    { label: 'Ученици ≥ Совладување (85%)', value: `${studentSegments.mastery} / ${studentSegments.total}`, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
                ].map(kpi => (
                    <Card key={kpi.label} className={`border ${kpi.color} p-4`}>
                        <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                        <p className={`text-2xl font-bold ${kpi.text}`}>{kpi.value}</p>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── Performance distribution ──────────────────────────── */}
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-indigo-500" />
                        Распределба на резултати
                    </h3>
                    <div className="space-y-3">
                        <PercentBar pct={distribution.mastery} color="bg-emerald-500" label="🏆 Совладување (≥85%)" value={`${distribution.mastery}%`} />
                        <PercentBar pct={distribution.pass}    color="bg-blue-400"    label="✅ Полага (70–84%)"      value={`${distribution.pass}%`} />
                        <PercentBar pct={distribution.risk}    color="bg-amber-400"   label="⚠️ Ризик (50–69%)"       value={`${distribution.risk}%`} />
                        <PercentBar pct={distribution.fail}    color="bg-red-400"     label="❌ Слаб (<50%)"          value={`${distribution.fail}%`} />
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Вкупно {distribution.total} обиди</p>
                </Card>

                {/* ── Student segments ──────────────────────────────────── */}
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        Сегменти на ученици
                    </h3>
                    <div className="space-y-3">
                        <PercentBar
                            pct={(studentSegments.mastery / studentSegments.total) * 100}
                            color="bg-emerald-500"
                            label={`🏆 Мајстори (${studentSegments.mastery})`}
                            value={`${Math.round((studentSegments.mastery / studentSegments.total) * 100)}%`}
                        />
                        <PercentBar
                            pct={(studentSegments.onTrack / studentSegments.total) * 100}
                            color="bg-blue-400"
                            label={`✅ На пат (${studentSegments.onTrack})`}
                            value={`${Math.round((studentSegments.onTrack / studentSegments.total) * 100)}%`}
                        />
                        <PercentBar
                            pct={(studentSegments.atRisk / studentSegments.total) * 100}
                            color="bg-amber-400"
                            label={`⚠️ Ризик (${studentSegments.atRisk})`}
                            value={`${Math.round((studentSegments.atRisk / studentSegments.total) * 100)}%`}
                        />
                        <PercentBar
                            pct={(studentSegments.critical / studentSegments.total) * 100}
                            color="bg-red-400"
                            label={`❌ Критично (${studentSegments.critical})`}
                            value={`${Math.round((studentSegments.critical / studentSegments.total) * 100)}%`}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-3">Вкупно {studentSegments.total} ученика</p>
                </Card>

                {/* ── Top strongest concepts ───────────────────────────── */}
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Најјаки концепти на класот
                    </h3>
                    {strongest.length === 0 ? (
                        <p className="text-sm text-gray-400">Нема доволно податоци</p>
                    ) : (
                        <div className="space-y-3">
                            {strongest.map(c => (
                                <PercentBar
                                    key={c.conceptId}
                                    pct={c.avg}
                                    color="bg-emerald-400"
                                    label={c.label}
                                    value={`${fmt(c.avg)}%`}
                                />
                            ))}
                        </div>
                    )}
                </Card>

                {/* ── Top weakest concepts ─────────────────────────────── */}
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Систематски слаби концепти
                    </h3>
                    {weakest.length === 0 ? (
                        <p className="text-sm text-gray-400">Нема доволно податоци</p>
                    ) : (
                        <div className="space-y-3">
                            {weakest.map(c => (
                                <PercentBar
                                    key={c.conceptId}
                                    pct={c.avg}
                                    color={c.avg < 50 ? 'bg-red-500' : c.avg < 70 ? 'bg-amber-400' : 'bg-blue-400'}
                                    label={c.label}
                                    value={`${fmt(c.avg)}%`}
                                />
                            ))}
                        </div>
                    )}
                    {weakest.filter(c => c.avg < 70).length > 0 && (
                        <p className="text-xs text-red-500 mt-3 font-medium">
                            ⚠️ {weakest.filter(c => c.avg < 70).length} концепт(и) под 70% — препорачај ремедијала
                        </p>
                    )}
                </Card>
            </div>

            {/* ── Monthly trend ─────────────────────────────────────────────── */}
            {monthlyTrend.length >= 2 && (
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        {trendDirection === 'up'      && <TrendingUp   className="w-4 h-4 text-emerald-500" />}
                        {trendDirection === 'down'    && <TrendingDown  className="w-4 h-4 text-red-500" />}
                        {trendDirection === 'neutral' && <Minus         className="w-4 h-4 text-gray-400" />}
                        Месечен тренд — просечен резултат
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                            trendDirection === 'up'      ? 'bg-emerald-100 text-emerald-700' :
                            trendDirection === 'down'    ? 'bg-red-100 text-red-700' :
                                                          'bg-gray-100 text-gray-600'
                        }`}>
                            {trendDirection === 'up' ? '↑ Подобрување' : trendDirection === 'down' ? '↓ Опаѓање' : '→ Стабилно'}
                        </span>
                    </h3>
                    <div className="flex items-end gap-3 h-32">
                        {monthlyTrend.map((m, i) => {
                            const maxAvg = Math.max(...monthlyTrend.map(x => x.avg));
                            const heightPct = maxAvg > 0 ? (m.avg / maxAvg) * 100 : 0;
                            const isLast = i === monthlyTrend.length - 1;
                            return (
                                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold text-gray-700">{fmt(m.avg)}%</span>
                                    <div className="w-full bg-gray-100 rounded-t-md flex items-end" style={{ height: '72px' }}>
                                        <div
                                            className={`w-full rounded-t-md transition-all ${
                                                isLast ? 'bg-indigo-500' : 'bg-indigo-300'
                                            }`}
                                            style={{ height: `${heightPct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500">{m.label}</span>
                                    <span className="text-xs text-gray-400">({m.count})</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Бројот во заграда = квиз обиди тој месец</p>
                </Card>
            )}

            {/* ── National Benchmark (Ж6.4) ──────────────────────────────────── */}
            {teacherUid && (
                <NationalBenchmarkCard
                    teacherUid={teacherUid}
                    results={results}
                    gradeLevel={gradeLevel}
                />
            )}
        </div>
    );
};
