import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery, type Announcement } from '../services/firestoreService';
import type { DocumentSnapshot } from 'firebase/firestore';
import { useNotification } from '../contexts/NotificationContext';
import { geminiService } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/common/Card';
import { BarChart3, Users, Award, TrendingUp, RefreshCw, Download, Megaphone, Trash2, Send, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCurriculum } from '../hooks/useCurriculum';
import { useTeacherAnalytics } from '../hooks/useTeacherAnalytics';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { StatCard, QuizAggregate, ConceptStat, PerStudentStat, GradeStat, groupBy, fmt } from './analytics/shared';
import { OverviewTab } from './analytics/OverviewTab';
import { TrendTab } from './analytics/TrendTab';
import { StudentsTab } from './analytics/StudentsTab';
import { StandardsTab } from './analytics/StandardsTab';
import { ConceptsTab } from './analytics/ConceptsTab';
import { GradeTab } from './analytics/GradeTab';
import { AlertsTab } from './analytics/AlertsTab';
import { GroupsTab } from './analytics/GroupsTab';
import { LiveTab } from './analytics/LiveTab';
import { ClassesTab } from './analytics/ClassesTab';
import { QuestionBankTab } from './analytics/QuestionBankTab';
import { QuizCoverageTab } from './analytics/QuizCoverageTab';
import { AssignmentsTab } from './analytics/AssignmentsTab';
import { LeagueTab } from './analytics/LeagueTab';
import { useReactToPrint } from 'react-to-print';
import { PrintableEDnevnikReport } from '../components/analytics/PrintableEDnevnikReport';
import { Printer } from 'lucide-react';

// Module-level TTL cache (5 min) — survives tab switches, cleared on manual refresh
const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { results: QuizResult[]; mastery: ConceptMastery[]; lastDoc: DocumentSnapshot | null; ts: number };
const analyticsCache = new Map<string, CacheEntry>();

export const TeacherAnalyticsView: React.FC = () => {
  const { t } = useLanguage();
    const { firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const { data: analyticsData, isLoading, error, refetch: loadResults } = useTeacherAnalytics(firebaseUser?.uid);

    const results = analyticsData?.results || [];
    const masteryRecords = analyticsData?.mastery || [];

    // Local pagination state for "Load More"
    const [localResults, setLocalResults] = useState<QuizResult[]>([]);
    
    
    // Sync local results when basic query loads
    useEffect(() => {
        if (analyticsData) {
            setLocalResults(analyticsData.results);
            setLastDoc(analyticsData.lastDoc);
            setHasMore(analyticsData.lastDoc !== null);
        }
    }, [analyticsData]);
    const { getConceptDetails, getStandardsByIds, allConcepts } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();
    const [copiedName, setCopiedName] = useState<string | null>(null);
    const [aiRecs, setAiRecs] = useState<any[] | null>(null);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);
    // П32 — Pagination
    
    const printRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `e-dnevnik-report-${new Date().toISOString().slice(0, 10)}` });
    // П27 — Announcements
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [newMsg, setNewMsg] = useState('');
    const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'students' | 'standards' | 'concepts' | 'grades' | 'alerts' | 'groups' | 'live' | 'classes' | 'questionBank' | 'coverage' | 'assignments' | 'league'>('overview');
    const [showMoreTabs, setShowMoreTabs] = useState(false);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleGetRecommendations = async () => {
        if (isLoadingRecs || localResults.length === 0) return;
        setIsLoadingRecs(true);
        setAiRecs(null);
        try {
            const uniqueStudentSet = new Set(localResults.filter(r => r.studentName).map(r => r.studentName!));
            const recs = await geminiService.generateClassRecommendations({
                totalAttempts: localResults.length,
                avgScore: localResults.reduce((s, r) => s + r.percentage, 0) / localResults.length,
                passRate: (localResults.filter(r => r.percentage >= 70).length / localResults.length) * 100,
                weakConcepts: weakConcepts,
                masteredCount: masteryStats?.mastered.length ?? 0,
                inProgressCount: masteryStats?.inProgress.length ?? 0,
                strugglingCount: masteryStats?.struggling.length ?? 0,
                uniqueStudentCount: uniqueStudentSet.size,
            });
            setAiRecs(recs);
        } catch (err) {
            console.error('Error generating class recommendations:', err);
            addNotification('Грешка при генерирање препораки. Проверете ја AI квотата.', 'error');
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

    // loadResults replaced by React Query refetch

    const loadMore = async () => {
        if (!lastDoc || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const uid = firebaseUser?.uid;
            const page = await firestoreService.fetchQuizResultsPage(uid, 200, lastDoc);
            setLocalResults(prev => [...prev, ...page.results]);
            setLastDoc(page.lastDoc);
            setHasMore(page.lastDoc !== null);
        } catch (err) {
            console.error('Error loading more results:', err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    
    const calculateGrade = (percentage: number): number => {
        if (percentage < 30) return 1;
        if (percentage < 50) return 2;
        if (percentage < 70) return 3;
        if (percentage < 85) return 4;
        return 5;
    };

    const handleEDnevnikExport = () => {
        const rows: string[][] = [
            ['Ученик / Идентификатор', 'Квиз / Тема', 'Поени', 'Макс. Поени', 'Процент', 'Оценка (Е-Дневник)', 'Датум'],
            ...localResults.map(r => {
                const perc = Math.round(r.percentage);
                const grade = calculateGrade(perc);
                return [
                    r.studentName || 'Анонимен',
                    r.quizTitle,
                    String(r.correctCount),
                    String(r.totalQuestions),
                    `${perc}%`,
                    String(grade),
                    r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || ''
                ];
            }),
        ];
        const csv = rows.map(row =>
            row.map(cell => cell.includes(',') || cell.includes('"') || /[\r\n]/.test(cell)
                ? `"${cell.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"` : cell
            ).join(',')
        ).join('\n');
        
        // Use standard CSV MIME type with UTF-8 BOM for Excel Cyrillic support
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `e-dnevnik-ocenki-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addNotification('Експортот за Е-Дневник е успешно преземен', 'success');
    };

    const handleExportCSV = () => {
        const rows: string[][] = [
            ['Квиз', 'Ученик', 'Точни', 'Вкупно', 'Проценти', 'Датум', 'Концепт ID'],
            ...localResults.map(r => [
                r.quizTitle,
                r.studentName || 'Анонимен',
                String(r.correctCount),
                String(r.totalQuestions),
                `${Math.round(r.percentage)}%`,
                r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || '',
                r.conceptId || '',
            ]),
        ];
        const csv = rows.map(row =>
            row.map(cell => cell.includes(',') || cell.includes('"') || /[\r\n]/.test(cell)
                ? `"${cell.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"` : cell
            ).join(',')
        ).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    

    useEffect(() => {
        if (!firebaseUser?.uid) return;
        firestoreService.fetchAnnouncements(firebaseUser.uid).then(setAnnouncements);
    }, [firebaseUser?.uid]);

    const handlePostAnnouncement = async () => {
        if (!newMsg.trim() || !firebaseUser?.uid) return;
        setIsPostingAnnouncement(true);
        try {
            await firestoreService.addAnnouncement(firebaseUser.uid, newMsg);
            setNewMsg('');
            const updated = await firestoreService.fetchAnnouncements(firebaseUser.uid);
            setAnnouncements(updated);
            addNotification('Огласот е објавен! 📢', 'success');
        } catch (err) {
            console.error('Error posting announcement:', err);
            addNotification('Грешка при објавување на огласот.', 'error');
        } finally {
            setIsPostingAnnouncement(false);
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        try {
            await firestoreService.deleteAnnouncement(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            console.error('Error deleting announcement:', err);
            addNotification('Грешка при бришење на огласот.', 'error');
        }
    };

    // ── Aggregations ──────────────────────────────────────────────────────────

    const { totalAttempts, avgScore, passRate, quizAggregates, distribution, weakConcepts, allConceptStats, uniqueStudents } = useMemo(() => {
        if (localResults.length === 0) {
            return { totalAttempts: 0, avgScore: 0, passRate: 0, quizAggregates: [] as QuizAggregate[], distribution: [0, 0, 0, 0], weakConcepts: [] as ConceptStat[], allConceptStats: [] as ConceptStat[], uniqueStudents: [] as string[] };
        }

        const totalAttempts = localResults.length;
        const avgScore = results.reduce((s, r) => s + r.percentage, 0) / totalAttempts;
        const passRate = (localResults.filter(r => r.percentage >= 70).length / totalAttempts) * 100;

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
            if (!acc[key]) acc[key] = { total: 0, sum: 0, passCount: 0, students: new Set<string>(), quizTitle: r.quizTitle, confSum: 0, confCount: 0, misconceptions: [] as string[] };
            acc[key].total++;
            acc[key].sum += r.percentage;
            if (r.percentage >= 70) acc[key].passCount++;
            if (r.studentName) acc[key].students.add(r.studentName);
            // В2 — confidence accumulation
            if (r.confidence != null) { acc[key].confSum += r.confidence; acc[key].confCount++; }
            // Фаза Г — misconceptions accumulation
            if (r.misconceptions && Array.isArray(r.misconceptions)) {
                r.misconceptions.forEach(m => {
                    if (m.misconception && m.misconception !== "Непозната грешка" && m.misconception !== "Пресметковна грешка или случајно погодување") {
                        acc[key].misconceptions.push(m.misconception);
                    }
                });
            }
            return acc;
        }, {} as Record<string, { total: number; sum: number; passCount: number; students: Set<string>; quizTitle: string; confSum: number; confCount: number; misconceptions: string[] }>);

        const allConceptStats: ConceptStat[] = Object.entries(conceptStats).map(([conceptId, s]) => {
            const conceptTitle = getConceptDetails(conceptId).concept?.title || s.quizTitle;
            const masteredCount = masteryRecords.filter(m => m.conceptId === conceptId && m.mastered).length;
            
            // Group and count misconceptions
            const miscMap: Record<string, number> = {};
            s.misconceptions.forEach(m => miscMap[m] = (miscMap[m] || 0) + 1);
            const sortedMisconceptions = Object.entries(miscMap)
                .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
                .map(([text, count]) => ({ text, count }));

            return {
                conceptId,
                title: conceptTitle,
                avgPct: Math.round(s.sum / s.total),
                attempts: s.total,
                passRate: Math.round((s.passCount / s.total) * 100),
                uniqueStudents: s.students.size,
                masteredCount,
                avgConfidence: s.confCount > 0 ? s.confSum / s.confCount : undefined,
                misconceptions: sortedMisconceptions.length > 0 ? sortedMisconceptions : undefined,
            };
        }).sort((a, b) => a.avgPct - b.avgPct);

        const weakConcepts = allConceptStats.filter(c => c.avgPct < 70);

        const uniqueStudents = Array.from(
            new Set(localResults.filter(r => r.studentName).map(r => r.studentName!))
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
        if (localResults.length === 0) return [];
        const weeks: Record<string, { sum: number; count: number; label: string }> = {};
        results.forEach(r => {
            if (!r.playedAt) return;
            const d = r.playedAt.toDate ? r.playedAt.toDate() : new Date(r.playedAt as any);
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
        if (localResults.length === 0) return [];
        const grouped = groupBy(localResults.filter(r => r.studentName), r => r.studentName!);
        return Object.entries(grouped).map(([name, items]) => {
            const avg = Math.round(items.reduce((s, r) => s + r.percentage, 0) / items.length);
            const passedCount = items.filter(r => r.percentage >= 70).length;
            const mastery = masteryRecords.filter(m => m.studentName === name);
            // В2 — confidence average
            const confItems = items.filter(r => r.confidence != null);
            const avgConfidence = confItems.length > 0
                ? confItems.reduce((s, r) => s + r.confidence!, 0) / confItems.length
                : undefined;
            return {
                name,
                attempts: items.length,
                avg,
                passRate: Math.round((passedCount / items.length) * 100),
                masteredCount: mastery.filter(m => m.mastered).length,
                lastAttempt: items[0]?.playedAt,
                avgConfidence,
            };
        }).sort((a, b) => a.avg - b.avg);
    }, [results, masteryRecords]);

    const gradeStats = useMemo((): GradeStat[] => {
        if (localResults.length === 0) return [];
        const grouped = groupBy(results, r => String(r.gradeLevel ?? 'N/A'));
        return Object.entries(grouped).map(([grade, quizzes]) => {
            const avgs = quizzes.map(q => q.percentage);
            const avgPct = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
            const passRate = Math.round(quizzes.filter(q => q.percentage >= 70).length / quizzes.length * 100);
            const uniqueStudents = new Set(quizzes.map(q => q.studentName).filter(Boolean)).size;
            const masteredCount = masteryRecords.filter(m => m.gradeLevel === Number(grade) && m.mastered).length;
            return { grade, attempts: quizzes.length, avgPct, passRate, uniqueStudents, masteredCount };
        }).sort((a, b) => Number(a.grade) - Number(b.grade));
    }, [results, masteryRecords]);

    const standardsCoverage = useMemo(() => {
        if (localResults.length === 0) return { tested: [], notTested: [] };

        const testedConceptIds = Array.from(new Set(localResults.filter(r => r.conceptId).map(r => r.conceptId!)));
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
                    {/* Header skeleton */}
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gray-200 rounded-xl" />
                        <div className="h-10 bg-gray-200 rounded w-1/3" />
                    </div>
                    {/* Tabs skeleton */}
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-full overflow-hidden">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded-lg flex-1" />)}
                    </div>
                    {/* Stat cards skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 bg-gray-100 rounded-2xl p-4 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-2/3" />
                                <div className="h-7 bg-gray-200 rounded w-1/2" />
                                <div className="h-3 bg-gray-100 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                    {/* Chart area skeleton */}
                    <div className="h-64 bg-gray-100 rounded-2xl" />
                    {/* Table rows skeleton */}
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
                    </div>
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
                        {t('analytics.title')}
                    </h1>
                    <p className="text-lg text-gray-600 mt-2">
                        {t('analytics.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={localResults.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95 disabled:opacity-40"
                >
                    <Download className="w-4 h-4" />
                    {t('analytics.exportCsv')}
                </button>
                <button
                    type="button"
                    onClick={() => loadResults()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95"
                >
                    <RefreshCw className="w-4 h-4" />
                    Освежи
                </button>
                </div>
            </header>

            {error && (
                <Card className="mb-6 border-red-200 bg-red-50">
                    <p className="text-red-600 font-medium">{error instanceof Error ? error.message : "Не можеше да се вчитаат резултатите. Проверете ја врската."}</p>
                </Card>
            )}

            {localResults.length === 0 && !error ? (
                <Card className="text-center py-16">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-500">{t('analytics.noResultsTitle')}</h2>
                    <p className="text-gray-400 mt-2 max-w-sm mx-auto">
                        {t('analytics.noResultsDesc')}
                    </p>
                </Card>
            ) : (
                <>
                    {/* П27 — Огласна Табла */}
                    <Card className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Megaphone className="w-5 h-5 text-amber-500" />
                            <h3 className="font-bold text-gray-800">{t('analytics.bulletin')}</h3>
                            <span className="text-xs text-gray-400 ml-1">(Учениците ги гледаат во „Мој Прогрес")</span>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newMsg}
                                onChange={e => setNewMsg(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handlePostAnnouncement(); }}
                                placeholder={t("analytics.bulletinPlaceholder")}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                                maxLength={200}
                            />
                            <button
                                type="button"
                                onClick={handlePostAnnouncement}
                                disabled={!newMsg.trim() || isPostingAnnouncement}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 transition"
                            >
                                <Send className="w-4 h-4" />
                                Постави
                            </button>
                        </div>
                        {announcements.length > 0 && (
                            <ul className="space-y-1.5">
                                {announcements.map(a => (
                                    <li key={a.id} className="flex items-start justify-between gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        <p className="text-sm text-gray-700 flex-1">{a.message}</p>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAnnouncement(a.id)}
                                            title={t("analytics.deleteAd")}
                                            aria-label={t("analytics.deleteAd")}
                                            className="text-gray-300 hover:text-red-500 transition flex-shrink-0"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {announcements.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-1">{t('analytics.noActiveAds')}</p>
                        )}
                    </Card>

                    {/* Tab navigation — А2: 4 primary tabs + "More" dropdown */}
                    {(() => {
                        const PRIMARY_TABS = [
                            { id: 'overview' as const, label: t('analytics.tabs.overview') },
                            { id: 'students' as const, label: t('analytics.tabs.students') },
                            { id: 'concepts' as const, label: t('analytics.tabs.concepts') },
                            { id: 'alerts' as const, label: '⚠️ ' + t('analytics.tabs.alerts') },
                        ];
                        const SECONDARY_TABS = [
                            { id: 'trend' as const, label: t('analytics.tabs.trend') },
                            { id: 'grades' as const, label: t('analytics.tabs.grades') },
                            { id: 'standards' as const, label: t('analytics.tabs.standards') },
                            { id: 'groups' as const, label: '👥 ' + t('analytics.tabs.groups') },
                            { id: 'live' as const, label: '🔴 Live' },
                            { id: 'classes' as const, label: '🏫 Класи' },
                            { id: 'questionBank' as const, label: '📚 ' + t('analytics.tabs.questionBank') },
                            { id: 'coverage' as const, label: '📊 ' + t('analytics.tabs.coverage') },
                            { id: 'assignments' as const, label: '📋 ' + t('analytics.tabs.assignments') },
                            { id: 'league' as const, label: '🏆 ' + t('analytics.tabs.league') },
                        ];
                        const activeSecondary = SECONDARY_TABS.find(t => t.id === activeTab);
                        return (
                            <div className="mb-6 -mx-1">
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                                    {PRIMARY_TABS.map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => { setActiveTab(tab.id); setShowMoreTabs(false); }}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                                                activeTab === tab.id
                                                    ? 'bg-white text-slate-800 shadow'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                    {/* More button */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowMoreTabs(v => !v)}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
                                                activeSecondary
                                                    ? 'bg-white text-slate-800 shadow'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {activeSecondary ? activeSecondary.label : '+ Повеќе'}
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreTabs ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showMoreTabs && (
                                            <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                                                {SECONDARY_TABS.map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        onClick={() => { setActiveTab(tab.id); setShowMoreTabs(false); }}
                                                        className={`w-full text-left px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
                                                            activeTab === tab.id
                                                                ? 'bg-indigo-50 text-indigo-700'
                                                                : 'text-slate-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Summary stats — always visible */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            icon={<Users className="w-6 h-6 text-blue-600" />}
                            label={t("analytics.stat.totalAttempts")}
                            value={String(totalAttempts)}
                            sub={`${t("analytics.stat.refreshed")} ${lastRefresh.toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}`}
                            color="bg-blue-50"
                        />
                        <StatCard
                            icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
                            label={t("analytics.stat.avgResult")}
                            value={`${fmt(avgScore, 1)}%`}
                            sub={`\${t('analytics.stat.basedOn')} \${totalAttempts} \${totalAttempts === 1 ? t('analytics.stat.attemptSingular') : t('analytics.stat.attemptPlural')}`}
                            color="bg-indigo-50"
                        />
                        <StatCard
                            icon={<Award className="w-6 h-6 text-green-600" />}
                            label={t("analytics.stat.passRate")}
                            value={`${fmt(passRate, 1)}%`}
                            sub={`${results.filter(r => r.percentage >= 70).length} ${t("analytics.stat.from")} ${totalAttempts} ${t("analytics.stat.students")}`}
                            color="bg-green-50"
                        />
                        <StatCard
                            icon={<BarChart3 className="w-6 h-6 text-orange-500" />}
                            label={t("analytics.stat.distinctQuizzes")}
                            value={String(quizAggregates.length)}
                            sub={t("analytics.stat.quizzesWithResults")}
                            color="bg-orange-50"
                        />
                    </div>

                    {/* Tab content */}
                    {activeTab === 'overview' && (
                        <OverviewTab
                            masteryStats={masteryStats}
                            results={localResults}
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
                    {activeTab === 'grades' && <GradeTab gradeStats={gradeStats} />}
                    {activeTab === 'standards' && <StandardsTab standardsCoverage={standardsCoverage} />}
                    {activeTab === 'concepts' && <ConceptsTab allConceptStats={allConceptStats} onGenerateRemedial={handleGenerateRemedial} />}
                    {activeTab === 'alerts' && (
                        <AlertsTab
                            perStudentStats={perStudentStats}
                            weakConcepts={weakConcepts}
                            results={localResults}
                            onGenerateRemedial={handleGenerateRemedial}
                        />
                    )}
                    {activeTab === 'groups' && (
                        <GroupsTab perStudentStats={perStudentStats} teacherUid={firebaseUser?.uid} />
                    )}
                    {activeTab === 'live' && <LiveTab />}
                    {activeTab === 'classes' && (
                        <ClassesTab teacherUid={firebaseUser?.uid ?? ''} />
                    )}
                    {activeTab === 'questionBank' && (
                        <QuestionBankTab teacherUid={firebaseUser?.uid ?? ''} />
                    )}
                    {activeTab === 'coverage' && (
                        <QuizCoverageTab
                            allConceptStats={allConceptStats}
                            allConcepts={allConcepts ?? []}
                            onGenerateRemedial={handleGenerateRemedial}
                        />
                    )}

                    {activeTab === 'assignments' && firebaseUser?.uid && (
                        <AssignmentsTab teacherUid={firebaseUser.uid} />
                    )}
                    {activeTab === 'league' && firebaseUser?.uid && (
                        <LeagueTab teacherUid={firebaseUser.uid} />
                    )}

                    {/* П32 — Pagination: Load More */}
                    {hasMore && !['questionBank', 'live', 'classes', 'coverage', 'assignments', 'league'].includes(activeTab) && (
                        <div className="mt-6 flex flex-col items-center gap-1">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={isLoadingMore}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition"
                            >
                                {isLoadingMore
                                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('analytics.load.loading')}</>
                                    : <>↓ {t('analytics.load.loadMore')} ({localResults.length}</>
                                }
                            </button>
                            <p className="text-xs text-gray-400">{t('analytics.load.shown')} {localResults.length} {t('analytics.load.results')}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
