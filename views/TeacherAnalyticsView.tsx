import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import { Card } from '../components/common/Card';
import { BarChart3, Users, Award, TrendingUp, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Zap, QrCode, Copy, CheckCheck, Trophy } from 'lucide-react';
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

/** Horizontal score distribution bar */
const ScoreBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.max(pct, 0)}%` }} />
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
    const { getConceptDetails } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();
    const [copiedName, setCopiedName] = useState<string | null>(null);

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

    const { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, uniqueStudents } = useMemo(() => {
        if (results.length === 0) {
            return { totalAttempts: 0, avgScore: 0, passRate: 0, quizAggregates: [], distribution: [0, 0, 0, 0], weakConcepts: [], uniqueStudents: [] };
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

        // Concept-level aggregation: group by conceptId to find weak concepts
        const conceptStats = results.filter(r => r.conceptId).reduce((acc, r) => {
            const key = r.conceptId!;
            if (!acc[key]) acc[key] = { total: 0, sum: 0, quizTitle: r.quizTitle };
            acc[key].total++;
            acc[key].sum += r.percentage;
            return acc;
        }, {} as Record<string, { total: number; sum: number; quizTitle: string }>);

        const weakConcepts = Object.entries(conceptStats)
            .map(([conceptId, s]) => {
                const conceptTitle = getConceptDetails(conceptId).concept?.title || s.quizTitle;
                return { conceptId, avgPct: Math.round(s.sum / s.total), attempts: s.total, title: conceptTitle };
            })
            .filter(c => c.avgPct < 70)
            .sort((a, b) => a.avgPct - b.avgPct);

        // Unique student names from results (for parent QR links)
        const uniqueStudents = Array.from(
            new Set(results.filter(r => r.studentName).map(r => r.studentName!))
        ).sort();

        return { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, uniqueStudents };
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
                    {/* Summary stats */}
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
                </>
            )}
        </div>
    );
};
