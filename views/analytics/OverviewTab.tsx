import React from 'react';
import {
    RefreshCw, Sparkles, ChevronRight,
    Trophy, AlertTriangle, Zap,
    QrCode, Copy, CheckCheck,
    XCircle, Clock, CheckCircle, Award,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useNavigation } from '../../contexts/NavigationContext';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { ScoreBar, QuizRow, fmt, formatDate, type ConceptStat, type QuizAggregate } from './shared';
import type { QuizResult } from '../../services/firestoreService';

interface MasteryStats {
    mastered: any[];
    inProgress: any[];
    struggling: any[];
    topMasteredConcepts: [string, { title: string; count: number; students: string[] }][];
}

interface OverviewTabProps {
    masteryStats: MasteryStats | null;
    results: QuizResult[];
    weakConcepts: ConceptStat[];
    uniqueStudents: string[];
    distribution: number[];
    quizAggregates: QuizAggregate[];
    aiRecs: any[] | null;
    isLoadingRecs: boolean;
    copiedName: string | null;
    onGetRecommendations: () => void;
    onGenerateRemedial: (conceptId: string, title: string, avgPct: number) => void;
    onCopyName: (name: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
    masteryStats,
    results,
    weakConcepts,
    uniqueStudents,
    distribution,
    quizAggregates,
    aiRecs,
    isLoadingRecs,
    copiedName,
    onGetRecommendations,
    onGenerateRemedial,
    onCopyName,
}) => {
    const { navigate } = useNavigation();
    const { getConceptDetails } = useCurriculum();
    const { openGeneratorPanel } = useGeneratorPanel();

    return (
        <>
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
                        onClick={onGetRecommendations}
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
                        Кликни „Генерирај препораки" за да добиеш конкретни совети базирани на реалните резултати на одделението.
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

                {/* Recent 15 attempts */}
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

            {/* Weak Concepts */}
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
                                        onClick={() => onGenerateRemedial(c.conceptId, c.title, c.avgPct)}
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

            {/* Parent QR Code section */}
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
                                                    onCopyName(name);
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
    );
};
