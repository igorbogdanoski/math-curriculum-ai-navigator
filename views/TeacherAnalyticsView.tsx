import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import { Card } from '../components/common/Card';
import { BarChart3, Users, Award, TrendingUp, RefreshCw } from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { StatCard, QuizAggregate, ConceptStat, PerStudentStat, groupBy, fmt } from './analytics/shared';
import { OverviewTab } from './analytics/OverviewTab';
import { TrendTab } from './analytics/TrendTab';
import { StudentsTab } from './analytics/StudentsTab';
import { StandardsTab } from './analytics/StandardsTab';
import { ConceptsTab } from './analytics/ConceptsTab';

export const TeacherAnalyticsView: React.FC = () => {
    const [results, setResults] = useState<QuizResult[]>([]);
    const [masteryRecords, setMasteryRecords] = useState<ConceptMastery[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const { getConceptDetails, getStandardsByIds } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();
    const [copiedName, setCopiedName] = useState<string | null>(null);
    const [aiRecs, setAiRecs] = useState<any[] | null>(null);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'students' | 'standards' | 'concepts'>('overview');

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleGetRecommendations = async () => {
        if (isLoadingRecs || results.length === 0) return;
        setIsLoadingRecs(true);
        setAiRecs(null);
        try {
            const uniqueStudentSet = new Set(results.filter(r => r.studentName).map(r => r.studentName!));
            const recs = await geminiService.generateClassRecommendations({
                totalAttempts: results.length,
                avgScore: results.reduce((s, r) => s + r.percentage, 0) / results.length,
                passRate: (results.filter(r => r.percentage >= 70).length / results.length) * 100,
                weakConcepts: weakConcepts,
                masteredCount: masteryStats?.mastered.length ?? 0,
                inProgressCount: masteryStats?.inProgress.length ?? 0,
                strugglingCount: masteryStats?.struggling.length ?? 0,
                uniqueStudentCount: uniqueStudentSet.size,
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

    // ── Aggregations ──────────────────────────────────────────────────────────

    const { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents } = useMemo(() => {
        if (results.length === 0) {
            return { totalAttempts: 0, avgScore: 0, passRate: 0, quizAggregates: [] as QuizAggregate[], distribution: [0, 0, 0, 0], weakConcepts: [] as ConceptStat[], allConceptStats: [] as ConceptStat[], uniqueStudents: [] as string[] };
        }

        const totalAttempts = results.length;
        const avgScore = results.reduce((s, r) => s + r.percentage, 0) / totalAttempts;
        const passRate = (results.filter(r => r.percentage >= 70).length / totalAttempts) * 100;

        const buckets = [0, 0, 0, 0];
        for (const r of results) {
            if (r.percentage < 50) buckets[0]++;
            else if (r.percentage < 70) buckets[1]++;
            else if (r.percentage < 85) buckets[2]++;
            else buckets[3]++;
        }
        const distribution = buckets.map(b => (b / totalAttempts) * 100);

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

        const conceptStats = results.filter(r => r.conceptId).reduce((acc, r) => {
            const key = r.conceptId!;
            if (!acc[key]) acc[key] = { total: 0, sum: 0, passCount: 0, students: new Set<string>(), quizTitle: r.quizTitle };
            acc[key].total++;
            acc[key].sum += r.percentage;
            if (r.percentage >= 70) acc[key].passCount++;
            if (r.studentName) acc[key].students.add(r.studentName);
            return acc;
        }, {} as Record<string, { total: number; sum: number; passCount: number; students: Set<string>; quizTitle: string }>);

        const allConceptStats: ConceptStat[] = Object.entries(conceptStats).map(([conceptId, s]) => {
            const conceptTitle = getConceptDetails(conceptId).concept?.title || s.quizTitle;
            const masteredCount = masteryRecords.filter(m => m.conceptId === conceptId && m.mastered).length;
            return {
                conceptId,
                title: conceptTitle,
                avgPct: Math.round(s.sum / s.total),
                attempts: s.total,
                passRate: Math.round((s.passCount / s.total) * 100),
                uniqueStudents: s.students.size,
                masteredCount,
            };
        }).sort((a, b) => a.avgPct - b.avgPct);

        const weakConcepts = allConceptStats.filter(c => c.avgPct < 70);

        const uniqueStudents = Array.from(
            new Set(results.filter(r => r.studentName).map(r => r.studentName!))
        ).sort();

        return { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents };
    }, [results, masteryRecords, getConceptDetails]);

    const masteryStats = useMemo(() => {
        if (masteryRecords.length === 0) return null;
        const mastered = masteryRecords.filter(m => m.mastered);
        const inProgress = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0);
        const struggling = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores === 0 && m.attempts > 1);

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

    const perStudentStats = useMemo((): PerStudentStat[] => {
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

    const standardsCoverage = useMemo(() => {
        if (results.length === 0) return { tested: [], notTested: [] };

        const testedConceptIds = Array.from(new Set(results.filter(r => r.conceptId).map(r => r.conceptId!)));
        const testedStandardIds = new Set<string>();
        const conceptAvg: Record<string, number> = {};

        testedConceptIds.forEach(cid => {
            const { concept } = getConceptDetails(cid);
            concept?.nationalStandardIds?.forEach(sid => testedStandardIds.add(sid));
            const conceptResults = results.filter(r => r.conceptId === cid);
            if (conceptResults.length > 0) {
                conceptAvg[cid] = Math.round(conceptResults.reduce((s, r) => s + r.percentage, 0) / conceptResults.length);
            }
        });

        const testedStandards = getStandardsByIds(Array.from(testedStandardIds)).map(s => {
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

    // ── Render ────────────────────────────────────────────────────────────────

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

                    {/* Tab content */}
                    {activeTab === 'overview' && (
                        <OverviewTab
                            masteryStats={masteryStats}
                            results={results}
                            weakConcepts={weakConcepts}
                            uniqueStudents={uniqueStudents}
                            distribution={distribution}
                            quizAggregates={quizAggregates}
                            aiRecs={aiRecs}
                            isLoadingRecs={isLoadingRecs}
                            copiedName={copiedName}
                            onGetRecommendations={handleGetRecommendations}
                            onGenerateRemedial={handleGenerateRemedial}
                            onCopyName={(name) => {
                                setCopiedName(name);
                                setTimeout(() => setCopiedName(null), 2000);
                            }}
                        />
                    )}
                    {activeTab === 'trend' && <TrendTab weeklyTrend={weeklyTrend} />}
                    {activeTab === 'students' && <StudentsTab perStudentStats={perStudentStats} />}
                    {activeTab === 'standards' && <StandardsTab standardsCoverage={standardsCoverage} />}
                    {activeTab === 'concepts' && <ConceptsTab allConceptStats={allConceptStats} onGenerateRemedial={handleGenerateRemedial} />}
                </>
            )}
        </div>
    );
};
