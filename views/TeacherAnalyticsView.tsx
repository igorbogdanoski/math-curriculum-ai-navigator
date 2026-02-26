import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import { Card } from '../components/common/Card';
import { SilentErrorBoundary } from '../components/common/SilentErrorBoundary';
import { BarChart3, Users, Award, TrendingUp, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Zap, QrCode, Copy, CheckCheck, Trophy, Sparkles, ChevronRight } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number, decimals = 1) => n.toFixed(decimals);

/** Group an array by a key function */
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of arr) {
        const k = key(item);
        if (!result[k]) result[k] = [];
        result[k].push(item);
    }
    return result;
}

/** Format a Firestore Timestamp or ISO string as a human date */
function formatDate(ts: any): string {
    if (!ts) return '—';
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '—';
    }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; color: string }> = ({ icon, label, value, sub, color }) => (
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

/** Horizontal bar for the weekly trend chart (h-6, overlaid % label) */
// eslint-disable-next-line react/forbid-component-props
const TrendBar: React.FC<{ pct: number; color: string; label: string }> = ({ pct, color, label }) => (
    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
        <div className={`analytics-bar h-full rounded-full ${color}`} data-pct={pct} style={{ '--bar-pct': pct } as React.CSSProperties} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">{label}</span>
    </div>
);

/** Horizontal score distribution bar */
// eslint-disable-next-line react/forbid-component-props
const ScoreBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`analytics-bar h-full ${color} rounded-full`} data-pct={Math.max(pct, 0)} style={{ '--bar-pct': Math.max(pct, 0) } as React.CSSProperties} />
        </div>
        <span className="w-8 text-right text-gray-500">{fmt(pct, 0)}%</span>
    </div>
);

/** Per-quiz aggregated row */
interface QuizAggregate {
    quizId: string;
    quizTitle: string;
    attempts: number;
    avgPct: number;
    bestPct: number;
    worstPct: number;
    passRate: number; // % with score >= 70
}

const QuizRow: React.FC<{ agg: QuizAggregate }> = ({ agg }) => {
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

// ── Main View ──────────────────────────────────────────────────────────────

export const TeacherAnalyticsView: React.FC = () => {
    const [results, setResults] = useState<QuizResult[]>([]);
    const [masteryRecords, setMasteryRecords] = useState<ConceptMastery[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const { navigate } = useNavigation();
    const { getConceptDetails, getStandardsByIds } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();
    const [copiedName, setCopiedName] = useState<string | null>(null);
    const [aiRecs, setAiRecs] = useState<any[] | null>(null);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'students' | 'standards' | 'concepts'>('overview');

    const handleGetRecommendations = async () => {
        if (isLoadingRecs || results.length === 0) return;
        setIsLoadingRecs(true);
        setAiRecs(null);
        try {
            const uniqueStudents = new Set(results.filter(r => r.studentName).map(r => r.studentName!));
            const recs = await geminiService.generateClassRecommendations({
                totalAttempts: results.length,
                avgScore: results.reduce((s, r) => s + r.percentage, 0) / results.length,
                passRate: (results.filter(r => r.percentage >= 70).length / results.length) * 100,
                weakConcepts: weakConcepts,
                masteredCount: masteryStats?.mastered.length ?? 0,
                inProgressCount: masteryStats?.inProgress.length ?? 0,
                strugglingCount: masteryStats?.struggling.length ?? 0,
                uniqueStudentCount: uniqueStudents.size,
            });
            setAiRecs(recs);
        } catch (err) {
            console.error('Error generating class recommendations:', err);
        } finally {
            setIsLoadingRecs(false);
        }
    };

    const handleGenerateRemedial = (conceptId: string, conceptTitle: string, avgPct: number) => {
        const { grade, topic } = getConceptDetails(conceptId);
        openGeneratorPanel({
            selectedGrade: grade?.id || '',
            selectedTopic: topic?.id || '',
            selectedConcepts: [conceptId],
            contextType: 'CONCEPT',
            materialType: 'ASSESSMENT',
            differentiationLevel: 'support',
            customInstruction: `РЕМЕДИЈАЛНА ВЕЖБА: Класата постигна само ${avgPct}% за концептот "${conceptTitle}". Генерирај работен лист со ПОДДРШКА ниво — поедноставени прашања, чекор-по-чекор упатства, детални примери, и визуелни помагала каде е можно.`,
        });
    };

    const loadResults = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [data, mastery] = await Promise.all([
                firestoreService.fetchQuizResults(200),
                firestoreService.fetchAllMastery(),
            ]);
            setResults(data);
            setMasteryRecords(mastery);
            setLastRefresh(new Date());
        } catch (err) {
            setError('Не можеше да се вчитаат резултатите. Проверете ја врската.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadResults(); }, []);

    // ── Aggregations ──────────────────────────────────────────────────────

    const { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents } = useMemo(() => {
        if (results.length === 0) {
            return { totalAttempts: 0, avgScore: 0, passRate: 0, quizAggregates: [], distribution: [0, 0, 0, 0], weakConcepts: [], allConceptStats: [], uniqueStudents: [] };
        }

        const totalAttempts = results.length;
        const avgScore = results.reduce((s, r) => s + r.percentage, 0) / totalAttempts;
        const passRate = (results.filter(r => r.percentage >= 70).length / totalAttempts) * 100;

        // Distribution buckets: <50, 50-70, 70-85, 85-100
        const buckets = [0, 0, 0, 0];
        for (const r of results) {
            if (r.percentage < 50) buckets[0]++;
            else if (r.percentage < 70) buckets[1]++;
            else if (r.percentage < 85) buckets[2]++;
            else buckets[3]++;
        }
        const distribution = buckets.map(b => (b / totalAttempts) * 100);

        // Per-quiz aggregation
        const grouped = groupBy(results, r => r.quizId);
        const quizAggregates: QuizAggregate[] = Object.entries(grouped).map(([quizId, items]) => {
            const pcts = items.map(i => i.percentage);
            const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
            const pass = (items.filter(i => i.percentage >= 70).length / items.length) * 100;
            return {
                quizId,
                quizTitle: items[0].quizTitle || quizId,
                attempts: items.length,
                avgPct: avg,
                bestPct: Math.max(...pcts),
                worstPct: Math.min(...pcts),
                passRate: pass,
            };
        }).sort((a, b) => b.attempts - a.attempts);

        // Concept-level aggregation: group by conceptId
        const conceptStats = results.filter(r => r.conceptId).reduce((acc, r) => {
            const key = r.conceptId!;
            if (!acc[key]) acc[key] = { total: 0, sum: 0, passCount: 0, students: new Set<string>(), quizTitle: r.quizTitle };
            acc[key].total++;
            acc[key].sum += r.percentage;
            if (r.percentage >= 70) acc[key].passCount++;
            if (r.studentName) acc[key].students.add(r.studentName);
            return acc;
        }, {} as Record<string, { total: number; sum: number; passCount: number; students: Set<string>; quizTitle: string }>);

        const allConceptStats = Object.entries(conceptStats).map(([conceptId, s]) => {
            const conceptTitle = getConceptDetails(conceptId).concept?.title || s.quizTitle;
            return {
                conceptId,
                title: conceptTitle,
                avgPct: Math.round(s.sum / s.total),
                attempts: s.total,
                passRate: Math.round((s.passCount / s.total) * 100),
                uniqueStudents: s.students.size,
            };
        }).sort((a, b) => a.avgPct - b.avgPct);

        const weakConcepts = allConceptStats.filter(c => c.avgPct < 70);

        // Unique student names from results (for parent QR links)
        const uniqueStudents = Array.from(
            new Set(results.filter(r => r.studentName).map(r => r.studentName!))
        ).sort();

        return { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents };
    }, [results, getConceptDetails]);

    // Mastery aggregations
    const masteryStats = useMemo(() => {
        if (masteryRecords.length === 0) return null;
        const mastered = masteryRecords.filter(m => m.mastered);
        const inProgress = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0);
        const struggling = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores === 0 && m.attempts > 1);

        // Group mastered by concept for leaderboard
        const masteredByConcept = mastered.reduce((acc, m) => {
            const key = m.conceptId;
            if (!acc[key]) acc[key] = { title: m.conceptTitle || m.conceptId, count: 0, students: [] };
            acc[key].count++;
            acc[key].students.push(m.studentName);
            return acc;
        }, {} as Record<string, { title: string; count: number; students: string[] }>);

        const topMasteredConcepts = Object.entries(masteredByConcept)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);

        return { mastered, inProgress, struggling, topMasteredConcepts };
    }, [masteryRecords]);

    // Weekly trend (last 8 weeks)
    const weeklyTrend = useMemo(() => {
        if (results.length === 0) return [];
        const weeks: Record<string, { sum: number; count: number; label: string }> = {};
        results.forEach(r => {
            if (!r.playedAt) return;
            const d = r.playedAt.toDate ? r.playedAt.toDate() : new Date(r.playedAt);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const key = weekStart.toISOString().slice(0, 10);
            const label = weekStart.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' });
            if (!weeks[key]) weeks[key] = { sum: 0, count: 0, label };
            weeks[key].sum += r.percentage;
            weeks[key].count++;
        });
        return Object.entries(weeks)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-8)
            .map(([, v]) => ({ label: v.label, avg: Math.round(v.sum / v.count), count: v.count }));
    }, [results]);

    // Per-student stats
    const perStudentStats = useMemo(() => {
        if (results.length === 0) return [];
        const grouped = groupBy(results.filter(r => r.studentName), r => r.studentName!);
        return Object.entries(grouped).map(([name, items]) => {
            const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);
            const passedCount = items.filter(r => r.percentage >= 70).length;
            const mastery = masteryRecords.filter(m => m.studentName === name);
            return {
                name,
                attempts: items.length,
                avg,
                passRate: Math.round((passedCount / items.length) * 100),
                masteredCount: mastery.filter(m => m.mastered).length,
                lastAttempt: items[0]?.playedAt,
            };
        }).sort((a, b) => a.avg - b.avg);
    }, [results, masteryRecords]);

    // Standards coverage — based on actual quiz results (not lesson plans)
    const standardsCoverage = useMemo(() => {
        if (results.length === 0) return { tested: [], notTested: [] };

        // Collect unique conceptIds from all quiz results
        const testedConceptIds = Array.from(new Set(results.filter(r => r.conceptId).map(r => r.conceptId!)));

        // For each concept, resolve its nationalStandardIds
        const testedStandardIds = new Set<string>();
        const conceptAvg: Record<string, number> = {};

        testedConceptIds.forEach(cid => {
            const { concept } = getConceptDetails(cid);
            concept?.nationalStandardIds?.forEach(sid => testedStandardIds.add(sid));

            // Avg score per concept
            const conceptResults = results.filter(r => r.conceptId === cid);
            if (conceptResults.length > 0) {
                conceptAvg[cid] = Math.round(conceptResults.reduce((s, r) => s + r.percentage, 0) / conceptResults.length);
            }
        });

        const testedStandards = getStandardsByIds(Array.from(testedStandardIds)).map(s => {
            // Find concepts for this standard and their avg scores
            const linkedConcepts = testedConceptIds
                .filter(cid => getConceptDetails(cid).concept?.nationalStandardIds?.includes(s.id))
                .map(cid => ({ cid, avg: conceptAvg[cid] ?? 0 }));
            const avgScore = linkedConcepts.length > 0
                ? Math.round(linkedConcepts.reduce((sum, c) => sum + c.avg, 0) / linkedConcepts.length)
                : 0;
            return { standard: s, avgScore, conceptCount: linkedConcepts.length };
        }).sort((a, b) => a.avgScore - b.avgScore);

        return { tested: testedStandards, notTested: [] };
    }, [results, getConceptDetails, getStandardsByIds]);

    // ── Render ─────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="p-8 animate-fade-in">
                <div className="animate-pulse space-y-6">
                    <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl"></div>)}
                    </div>
                    <div className="h-64 bg-gray-100 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 animate-fade-in">
            {/* Header */}
            <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-4xl font-bold text-brand-primary flex items-center gap-3">
                        <BarChart3 className="w-9 h-9" />
                        Аналитика на Квизови
                    </h1>
                    <p className="text-lg text-gray-600 mt-2">
                        Преглед на резултатите на учениците — во реално време.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={loadResults}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95"
                >
                    <RefreshCw className="w-4 h-4" />
                    Освежи
                </button>
            </header>

            {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                    <p className="text-red-600 font-medium">{error}</p>
                </Card>
            )}

            {results.length === 0 && !error ? (
                <Card className="text-center py-16">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-500">Сè уште нема резултати</h2>
                    <p className="text-gray-400 mt-2 max-w-sm mx-auto">
                        Откако учениците ќе решат квизови преку делениот линк, нивните резултати ќе се прикажат тука.
                    </p>
                </Card>
            ) : (
                <>
                    {/* Tab navigation */}
                    <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                        {([
                            { id: 'overview', label: 'Преглед' },
                            { id: 'trend', label: 'Тренд' },
                            { id: 'students', label: 'По ученик' },
                            { id: 'standards', label: 'Стандарди' },
                            { id: 'concepts', label: 'Концепти' },
                        ] as const).map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition ${
                                    activeTab === tab.id
                                        ? 'bg-white text-slate-800 shadow'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Summary stats — always visible */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            icon={<Users className="w-6 h-6 text-blue-600" />}
                            label="Вкупно обиди"
                            value={String(totalAttempts)}
                            sub={`освежено ${lastRefresh.toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}`}
                            color="bg-blue-50"
                        />
                        <StatCard
                            icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
                            label="Просечен резултат"
                            value={`${fmt(avgScore, 1)}%`}
                            sub={`врз основа на ${totalAttempts} обид${totalAttempts === 1 ? '' : 'и'}`}
                            color="bg-indigo-50"
                        />
                        <StatCard
                            icon={<Award className="w-6 h-6 text-green-600" />}
                            label="Стапка на положување (≥70%)"
                            value={`${fmt(passRate, 1)}%`}
                            sub={`${results.filter(r => r.percentage >= 70).length} од ${totalAttempts} ученици`}
                            color="bg-green-50"
                        />
                        <StatCard
                            icon={<BarChart3 className="w-6 h-6 text-orange-500" />}
                            label="Различни квизови"
                            value={String(quizAggregates.length)}
                            sub="квизови со резултати"
                            color="bg-orange-50"
                        />
                    </div>

                    {activeTab === 'overview' && <>

                    {/* Mastery Overview */}
                    {masteryStats && (
                        <Card className="mb-8 border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
                            <div className="flex items-center gap-2 mb-4">
                                <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                <h2 className="text-sm font-bold text-yellow-800 uppercase tracking-widest">Совладување на концепти</h2>
                                <span className="ml-auto text-xs text-yellow-600 font-semibold">≥85% три пати по ред = Совладан</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-5">
                                <div className="bg-white rounded-xl p-3 text-center border border-yellow-100">
                                    <p className="text-2xl font-black text-yellow-600">{masteryStats.mastered.length}</p>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">Совладани</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-yellow-100">
                                    <p className="text-2xl font-black text-blue-500">{masteryStats.inProgress.length}</p>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">Во напредок</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-yellow-100">
                                    <p className="text-2xl font-black text-red-400">{masteryStats.struggling.length}</p>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">Потребна помош</p>
                                </div>
                            </div>
                            {masteryStats.topMasteredConcepts.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-2">Најсовладани концепти</p>
                                    <div className="space-y-1.5">
                                        {masteryStats.topMasteredConcepts.map(([conceptId, data]) => (
                                            <div key={conceptId} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-yellow-100">
                                                <span className="text-sm font-semibold text-slate-700 truncate">{data.title}</span>
                                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                                    <Trophy className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                                                    <span className="text-xs font-bold text-yellow-700">{data.count} уч.</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}

                    {/* AI Class Recommendation Engine */}
                    <Card className="mb-8 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                <h2 className="text-sm font-bold text-indigo-800 uppercase tracking-widest">AI препорачува за следниот час</h2>
                            </div>
                            <button
                                type="button"
                                onClick={handleGetRecommendations}
                                disabled={isLoadingRecs || results.length === 0}
                                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition disabled:opacity-40"
                            >
                                {isLoadingRecs
                                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Анализира...</>
                                    : <><Sparkles className="w-3.5 h-3.5" /> {aiRecs ? 'Освежи' : 'Генерирај препораки'}</>}
                            </button>
                        </div>

                        {!aiRecs && !isLoadingRecs && (
                            <p className="text-sm text-indigo-600 text-center py-4 opacity-70">
                                Кликни „Генерирај препораки" за да добиеш конкретни совети базирани на реалните резултати на класата.
                            </p>
                        )}

                        {isLoadingRecs && (
                            <div className="flex items-center justify-center gap-2 py-6 text-indigo-600">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                                <span className="text-sm font-semibold">AI ги анализира резултатите...</span>
                            </div>
                        )}

                        {aiRecs && (
                            <div className="space-y-3">
                                {aiRecs.sort((a, b) => a.priority - b.priority).map((rec, i) => {
                                    const priorityColors = [
                                        'border-red-200 bg-red-50',
                                        'border-amber-200 bg-amber-50',
                                        'border-blue-200 bg-blue-50',
                                    ];
                                    const labelColors = [
                                        'bg-red-100 text-red-700',
                                        'bg-amber-100 text-amber-700',
                                        'bg-blue-100 text-blue-700',
                                    ];
                                    const priorityLabels = ['Итно', 'Важно', 'Препорачано'];
                                    const idx = Math.min(rec.priority - 1, 2);
                                    return (
                                        <div key={i} className={`rounded-xl border p-4 ${priorityColors[idx]}`}>
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{rec.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${labelColors[idx]}`}>
                                                            {priorityLabels[idx]}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-500 capitalize">{rec.differentiationLevel}</span>
                                                    </div>
                                                    <p className="font-bold text-slate-800 text-sm">{rec.title}</p>
                                                    <p className="text-xs text-slate-600 mt-1">{rec.explanation}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const { grade, topic } = rec.conceptId ? getConceptDetails(rec.conceptId) : { grade: undefined, topic: undefined };
                                                        openGeneratorPanel({
                                                            selectedGrade: grade?.id || '',
                                                            selectedTopic: topic?.id || '',
                                                            selectedConcepts: rec.conceptId ? [rec.conceptId] : [],
                                                            contextType: 'CONCEPT',
                                                            materialType: 'ASSESSMENT',
                                                            differentiationLevel: rec.differentiationLevel,
                                                            customInstruction: rec.explanation,
                                                        });
                                                    }}
                                                    className="flex items-center gap-1 text-xs font-bold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition flex-shrink-0"
                                                >
                                                    {rec.actionLabel} <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Score distribution card */}
                        <Card>
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Дистрибуција на резултати</h2>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> Под 50%</span>
                                        <span>{results.filter(r => r.percentage < 50).length} уч.</span>
                                    </div>
                                    <ScoreBar pct={distribution[0]} color="bg-red-400" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-400" /> 50–69%</span>
                                        <span>{results.filter(r => r.percentage >= 50 && r.percentage < 70).length} уч.</span>
                                    </div>
                                    <ScoreBar pct={distribution[1]} color="bg-yellow-400" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> 70–84%</span>
                                        <span>{results.filter(r => r.percentage >= 70 && r.percentage < 85).length} уч.</span>
                                    </div>
                                    <ScoreBar pct={distribution[2]} color="bg-green-400" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span className="flex items-center gap-1"><Award className="w-3 h-3 text-blue-400" /> 85–100%</span>
                                        <span>{results.filter(r => r.percentage >= 85).length} уч.</span>
                                    </div>
                                    <ScoreBar pct={distribution[3]} color="bg-blue-400" />
                                </div>
                            </div>
                        </Card>

                        {/* Recent 10 attempts */}
                        <Card className="lg:col-span-2">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Последни обиди</h2>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {results.slice(0, 15).map((r, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-700 truncate">{r.quizTitle}</p>
                                            <p className="text-xs text-gray-400">{formatDate(r.playedAt)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <span className={`text-sm font-bold ${r.percentage >= 70 ? 'text-green-600' : r.percentage >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                {r.correctCount}/{r.totalQuestions}
                                            </span>
                                            <p className="text-xs text-gray-400">{fmt(r.percentage, 0)}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    {/* Weak Concepts section — only shown when conceptId data exists */}
                    {weakConcepts.length > 0 && (
                        <Card className="mb-8 border-orange-200 bg-orange-50">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                <h2 className="text-sm font-bold text-orange-800 uppercase tracking-widest">Концепти под 70% — бараат внимание</h2>
                            </div>
                            <div className="space-y-2">
                                {weakConcepts.map(c => (
                                    <div key={c.conceptId} className="flex items-center justify-between gap-4 p-3 bg-white rounded-lg border border-orange-100">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-700 truncate">{c.title}</p>
                                            <p className="text-xs text-gray-400">{c.attempts} обид{c.attempts === 1 ? '' : 'и'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`text-lg font-bold ${c.avgPct < 50 ? 'text-red-500' : 'text-orange-500'}`}>{c.avgPct}%</span>
                                            <button
                                                type="button"
                                                onClick={() => handleGenerateRemedial(c.conceptId, c.title, c.avgPct)}
                                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold transition-colors"
                                                title="Генерирај ремедијален работен лист (Поддршка ниво)"
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                                Ремедијален
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/concept/${c.conceptId}`)}
                                                className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-semibold transition-colors"
                                            >
                                                Прегледај →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-orange-600 mt-3 italic">Овие концепти се базираат на резултатите од квизовите споделени преку Ученичкиот Портал.</p>
                        </Card>
                    )}

                    {/* Parent QR Code section — only shown when studentName data exists */}
                    {uniqueStudents.length > 0 && (
                        <Card className="mb-8 border-purple-200 bg-purple-50">
                            <div className="flex items-center gap-2 mb-4">
                                <QrCode className="w-5 h-5 text-purple-500 flex-shrink-0" />
                                <h2 className="text-sm font-bold text-purple-800 uppercase tracking-widest">Родителски линкови / QR кодови</h2>
                            </div>
                            <p className="text-xs text-purple-600 mb-4">Испрати го овој линк или QR код на родителот за да го следи прогресот на нивното дете.</p>
                            <div className="space-y-4">
                                {uniqueStudents.map(name => {
                                    const encoded = encodeURIComponent(name);
                                    const origin = window.location.origin + window.location.pathname;
                                    const progressUrl = `${origin}#/my-progress?name=${encoded}`;
                                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(progressUrl)}`;
                                    const isCopied = copiedName === name;
                                    return (
                                        <div key={name} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-purple-100">
                                            <img
                                                src={qrUrl}
                                                alt={`QR за ${name}`}
                                                className="w-24 h-24 rounded-lg border border-purple-100 flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-800 mb-1">{name}</p>
                                                <p className="text-xs text-slate-400 break-all mb-3 font-mono">{progressUrl}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(progressUrl).then(() => {
                                                            setCopiedName(name);
                                                            setTimeout(() => setCopiedName(null), 2000);
                                                        });
                                                    }}
                                                    className="flex items-center gap-1.5 text-xs font-bold bg-purple-100 text-purple-800 px-3 py-1.5 rounded-lg hover:bg-purple-200 transition"
                                                >
                                                    {isCopied
                                                        ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /> Копирано!</>
                                                        : <><Copy className="w-3.5 h-3.5" /> Копирај линк</>}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Per-quiz table */}
                    <Card>
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Резултати по квиз</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase tracking-widest text-left">
                                        <th className="py-2 px-4 font-semibold">Квиз / Поим</th>
                                        <th className="py-2 px-4 text-center font-semibold">Обиди</th>
                                        <th className="py-2 px-4 text-center font-semibold">Просек</th>
                                        <th className="py-2 px-4 text-center font-semibold">Најдобар</th>
                                        <th className="py-2 px-4 text-center font-semibold">Најлош</th>
                                        <th className="py-2 px-4 text-center font-semibold">Положиле</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quizAggregates.map(agg => <QuizRow key={agg.quizId} agg={agg} />)}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    </>}

                    {/* ── TAB: Тренд ── */}
                    {activeTab === 'trend' && (
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
                    )}

                    {/* ── TAB: По ученик ── */}
                    {activeTab === 'students' && (
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
                                                const status = s.avg >= 85 ? { label: 'Одличен', cls: 'bg-green-100 text-green-700' }
                                                    : s.avg >= 70 ? { label: 'Добар', cls: 'bg-blue-100 text-blue-700' }
                                                    : s.avg >= 50 ? { label: 'Во напредок', cls: 'bg-yellow-100 text-yellow-700' }
                                                    : { label: 'Потребна помош', cls: 'bg-red-100 text-red-700' };
                                                return (
                                                    <tr key={s.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                        <td className="py-2.5 px-3 font-semibold text-slate-700">{s.name}</td>
                                                        <td className="py-2.5 px-3 text-center text-gray-600">{s.attempts}</td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            <span className={`font-bold ${s.avg >= 70 ? 'text-green-600' : s.avg >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                                {s.avg}%
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
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
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
                    )}
                    {/* ── TAB: Стандарди ── */}
                    {activeTab === 'standards' && (
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
                    )}

                    {/* ── TAB: Концепти ── */}
                    {activeTab === 'concepts' && (
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
                                                        <td className="py-2.5 px-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleGenerateRemedial(c.conceptId, c.title, c.avgPct)}
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
                    )}
                </>
            )}
        </div>
    );
};
