import React from 'react';
import {
    ChevronLeft, BarChart2, Sparkles, Loader2,
    CheckCircle2, XCircle, AlertTriangle, BookOpen,
    RotateCcw, CalendarDays, Target,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { MathRenderer } from '../../components/common/MathRenderer';
import type { MaturaQuestion, MaturaExamMeta } from '../../services/firestoreService.matura';
import { formatTime, gradeFromPercent, examLabel } from './maturaSimUtils';
import type { SimResult, SimAnswers, QGrade } from './maturaSimUtils';

interface PartBreakdownItem {
    part: 1 | 2 | 3;
    score: number;
    max: number;
    count: number;
}

interface MaturaResultsPhaseProps {
    result: SimResult;
    selectedExam: MaturaExamMeta;
    questions: MaturaQuestion[];
    partBreakdown: PartBreakdownItem[] | null;
    topicBreakdown: Record<string, { score: number; max: number }>;
    aiAnalysis: string;
    aiLoading: boolean;
    requestAiAnalysis: () => void;
    expandedSolutions: Set<number>;
    setExpandedSolutions: React.Dispatch<React.SetStateAction<Set<number>>>;
    planCreated: boolean;
    planSaving: boolean;
    handleGeneratePlan: () => void;
    hasUser: boolean;
    onBack: () => void;
    onRetry: () => void;
    onGoStats: () => void;
    onGoPortal: () => void;
    answers: SimAnswers;
}

export function MaturaResultsPhase({
    result, selectedExam, questions, partBreakdown, topicBreakdown,
    aiAnalysis, aiLoading, requestAiAnalysis,
    expandedSolutions, setExpandedSolutions,
    planCreated, planSaving, handleGeneratePlan, hasUser,
    onBack, onRetry, onGoStats, onGoPortal, answers,
}: MaturaResultsPhaseProps) {
    const pct   = Math.round((result.totalScore / result.maxScore) * 100);
    const grade = gradeFromPercent(pct);

    const weakTopics = Object.entries(topicBreakdown)
        .filter(([, v]) => v.max > 0 && v.score / v.max < 0.6)
        .sort(([, a], [, b]) => (a.score / a.max) - (b.score / b.max))
        .slice(0, 3);

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            <button type="button" onClick={onBack}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-primary transition"
            >
                <ChevronLeft className="w-4 h-4" /> Назад кон избор
            </button>

            {/* Score hero */}
            <div className="bg-gradient-to-br from-brand-primary to-blue-700 rounded-3xl p-8 text-white text-center space-y-3 shadow-xl">
                <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider">{result.examTitle}</p>
                <div className="text-7xl font-black">{pct}%</div>
                <div className="text-2xl font-bold">{result.totalScore} / {result.maxScore} поени</div>
                <div className="inline-block bg-white/20 backdrop-blur px-4 py-2 rounded-full text-base font-bold">{grade.label}</div>
                <p className="text-blue-200 text-xs">
                    Траење: {formatTime(result.durationSeconds)} · {new Date(result.completedAt).toLocaleDateString('mk-MK')}
                </p>
            </div>

            {/* Part breakdown */}
            {partBreakdown && (
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart2 className="w-5 h-5 text-brand-primary" />
                        <h2 className="font-black text-gray-800">Резултати по делови</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {partBreakdown.map(({ part, score, max, count }) => {
                            const p  = max > 0 ? Math.round((score / max) * 100) : 0;
                            const color = p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
                            const bg    = p >= 75 ? 'bg-emerald-50 border-emerald-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                            return (
                                <div key={part} className={`rounded-2xl border p-4 text-center ${bg}`}>
                                    <p className="text-xs font-bold text-gray-500 mb-1">Дел {part === 1 ? 'I' : part === 2 ? 'II' : 'III'}</p>
                                    <p className={`text-2xl font-black ${color}`}>{p}%</p>
                                    <p className="text-xs text-gray-500 mt-1">{score}/{max} п · {count} пр.</p>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Topic breakdown */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="w-5 h-5 text-brand-primary" />
                    <h2 className="font-black text-gray-800">Резултати по теми</h2>
                </div>
                <div className="space-y-3">
                    {Object.entries(topicBreakdown).sort(([,a],[,b]) => (a.score/a.max) - (b.score/b.max)).map(([topic, { score, max }]) => {
                        const tPct   = max > 0 ? Math.round((score / max) * 100) : 0;
                        const barClr = tPct >= 75 ? 'bg-emerald-500' : tPct >= 50 ? 'bg-amber-500' : 'bg-red-500';
                        return (
                            <div key={topic}>
                                <div className="flex justify-between text-sm font-semibold mb-1">
                                    <span className="text-gray-700">{topic}</span>
                                    <span className={tPct >= 75 ? 'text-emerald-600' : tPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                                        {score}/{max} ({tPct}%)
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <progress
                                        className={`w-full h-full ${barClr === 'bg-emerald-500' ? 'accent-emerald-500' : barClr === 'bg-amber-500' ? 'accent-amber-500' : 'accent-red-500'}`}
                                        max={100}
                                        value={tPct}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* AI Analysis */}
            <Card className="bg-indigo-50 border-indigo-100">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        <h2 className="font-black text-indigo-800">AI Анализа</h2>
                    </div>
                    {!aiAnalysis && (
                        <button type="button" onClick={requestAiAnalysis} disabled={aiLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
                        >
                            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {aiLoading ? 'Анализира…' : 'Анализирај'}
                        </button>
                    )}
                </div>
                {aiAnalysis
                    ? <p className="mt-3 text-sm text-indigo-800 leading-relaxed">{aiAnalysis}</p>
                    : <p className="mt-2 text-sm text-indigo-500 italic">Притисни „Анализирај" за персонализиран AI коментар.</p>}
            </Card>

            {/* 7-day mission plan */}
            <Card className={planCreated ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-100'}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CalendarDays className={`w-5 h-5 ${planCreated ? 'text-emerald-600' : 'text-violet-600'}`} />
                        <h2 className={`font-black ${planCreated ? 'text-emerald-800' : 'text-violet-800'}`}>
                            {planCreated ? '7-дневен план создаден!' : 'Персонализиран 7-дневен план'}
                        </h2>
                    </div>
                    {!planCreated && hasUser && (
                        <button
                            type="button"
                            onClick={handleGeneratePlan}
                            disabled={planSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition disabled:opacity-60 shrink-0"
                        >
                            {planSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                            {planSaving ? 'Создава…' : 'Генерирај'}
                        </button>
                    )}
                </div>

                {planCreated ? (
                    <div className="mt-3 space-y-2">
                        <p className="text-sm text-emerald-700">
                            Планот е зачуван и ќе те чека во <strong>Матурскиот портал</strong>. Секој ден ќе имаш конкретна задача со зголемување на тежина (DoK 1 → 3).
                        </p>
                        <button type="button" onClick={onGoPortal}
                            className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition"
                        >
                            <CalendarDays className="w-3.5 h-3.5" /> Отвори го планот
                        </button>
                    </div>
                ) : weakTopics.length > 0 ? (
                    <div className="mt-3 space-y-2">
                        <p className="text-sm text-violet-700">Врз основа на резултатите, планот ќе фокусира на:</p>
                        <div className="flex flex-wrap gap-2">
                            {weakTopics.map(([topic, { score, max }]) => {
                                const tPct = Math.round((score / max) * 100);
                                return (
                                    <span key={topic} className="inline-flex items-center gap-1 bg-white border border-violet-200 text-violet-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                                        {topic}<span className="text-rose-500 font-black">{tPct}%</span>
                                    </span>
                                );
                            })}
                        </div>
                        {!hasUser && <p className="text-xs text-violet-500 italic mt-1">Влези со Google за да го зачуваш планот.</p>}
                    </div>
                ) : (
                    <p className="mt-2 text-sm text-violet-600 italic">Одличен резултат! Планот ќе те одржи во форма пред испитот.</p>
                )}
            </Card>

            {/* Per-question review */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-brand-primary" />
                    <h2 className="font-black text-gray-800">Преглед по прашања</h2>
                </div>
                <div className="space-y-2">
                    {questions.map((q, i) => {
                        const g: QGrade | undefined = result.grades[q.questionNumber];
                        const correct = g?.correct ?? (g ? g.score === g.maxPoints : false);
                        const rowBg   = correct ? 'bg-emerald-50' : g?.score ? 'bg-amber-50' : 'bg-red-50';
                        return (
                            <div key={q.questionNumber} className={`flex items-start gap-3 p-3 rounded-xl ${rowBg}`}>
                                <div className="flex-shrink-0 mt-0.5">
                                    {correct
                                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                        : g?.score ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        : <XCircle className="w-5 h-5 text-red-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-700 line-clamp-1">
                                        {i + 1}. <MathRenderer text={q.questionText} />
                                    </p>
                                    {q.part === 1 && (
                                        <p className="text-xs mt-0.5">
                                            <span className={correct ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                                                {answers.mc[q.questionNumber] ? `Твој: ${answers.mc[q.questionNumber]}` : 'Не одговорено'}
                                            </span>
                                            {!correct && (
                                                <span className="ml-2 text-emerald-600 font-semibold">· Точно: {q.correctAnswer}</span>
                                            )}
                                        </p>
                                    )}
                                    {(q.part === 2 || q.part === 3) && g?.feedback && (
                                        <p className="text-xs mt-0.5 text-gray-600 italic line-clamp-2">{g.feedback}</p>
                                    )}
                                    {q.aiSolution && (
                                        <button type="button"
                                            onClick={() => setExpandedSolutions(prev => {
                                                const s = new Set(prev);
                                                s.has(q.questionNumber) ? s.delete(q.questionNumber) : s.add(q.questionNumber);
                                                return s;
                                            })}
                                            className="text-xs text-indigo-600 hover:underline mt-1 font-semibold"
                                        >
                                            {expandedSolutions.has(q.questionNumber) ? '▲ Скриј решение' : '▼ Детално решение'}
                                        </button>
                                    )}
                                    {q.aiSolution && expandedSolutions.has(q.questionNumber) && (
                                        <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                                            <div className="text-xs text-gray-800 leading-relaxed">
                                                <MathRenderer text={q.aiSolution} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-black text-gray-500 flex-shrink-0">
                                    {g?.score ?? 0}/{q.points}п
                                </span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="button" onClick={onRetry}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-brand-primary to-blue-700 text-white font-bold hover:opacity-90 transition shadow-md"
                >
                    <RotateCcw className="w-4 h-4" /> Обиди се повторно
                </button>
                <button type="button" onClick={onGoStats}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 transition"
                >
                    <BarChart2 className="w-4 h-4" /> Отвори M5 Аналитика
                </button>
            </div>
        </div>
    );
}
