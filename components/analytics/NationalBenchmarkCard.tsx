/**
 * NationalBenchmarkCard — Ж6.4
 *
 * Opt-in national percentile comparison for the teacher's class.
 * Zero personal data submitted — only aggregated class stats.
 *
 * States:
 *  - not_submitted: shows "Придонеси" button + privacy note
 *  - submitting: spinner
 *  - result: percentile gauge + national average comparison
 *  - error: error message
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Globe, Lock, Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Card } from '../common/Card';
import {
  nationalBenchmarkService,
  type BenchmarkResult,
} from '../../services/firestoreService.nationalBenchmark';
import type { QuizResult } from '../../services/firestoreService';

interface Props {
    teacherUid: string;
    results: QuizResult[];
    gradeLevel: number;       // most common grade in current results
}

type State = 'idle' | 'submitting' | 'result' | 'error';

function calcPayload(teacherUid: string, results: QuizResult[], gradeLevel: number) {
    const avgPercentage = results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length)
        : 0;
    const passing  = results.filter(r => r.percentage >= 70).length;
    const mastered = results.filter(r => r.percentage >= 85).length;
    const concepts = new Set(results.filter(r => r.conceptId).map(r => r.conceptId!));
    return {
        teacherUid,
        gradeLevel,
        avgPercentage,
        passRate:     Math.round((passing  / Math.max(results.length, 1)) * 100),
        masteryRate:  Math.round((mastered / Math.max(results.length, 1)) * 100),
        totalAttempts: results.length,
        conceptCount:  concepts.size,
    };
}

// ── Percentile gauge (simple arc text) ───────────────────────────────────────

function PercentileGauge({ value }: { value: number }) {
    const color = value >= 75 ? 'text-emerald-600' : value >= 50 ? 'text-blue-600' : 'text-amber-600';
    const Icon  = value >= 75 ? TrendingUp : value >= 50 ? Minus : TrendingDown;
    return (
        <div className="flex flex-col items-center">
            <div className={`text-5xl font-black ${color}`}>{value}<span className="text-2xl">%</span></div>
            <div className={`flex items-center gap-1 text-sm font-semibold ${color} mt-1`}>
                <Icon className="w-4 h-4" />
                перцентил
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export const NationalBenchmarkCard: React.FC<Props> = ({ teacherUid, results, gradeLevel }) => {
    const [state, setState]   = useState<State>('idle');
    const [bResult, setBResult] = useState<BenchmarkResult | null>(null);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    // Check if teacher already submitted previously
    useEffect(() => {
        if (!teacherUid) return;
        nationalBenchmarkService.getOwnEntry(teacherUid).then(entry => {
            if (entry) setAlreadySubmitted(true);
        });
    }, [teacherUid]);

    const handleSubmit = useCallback(async () => {
        if (results.length < 5) return; // need at least 5 attempts for meaningful data
        setState('submitting');
        try {
            const payload = calcPayload(teacherUid, results, gradeLevel);
            await nationalBenchmarkService.submitBenchmark(payload);
            const result = await nationalBenchmarkService.calcPercentile(
                teacherUid, gradeLevel, payload.avgPercentage,
            );
            setBResult(result);
            setState('result');
            setAlreadySubmitted(true);
        } catch {
            setState('error');
        }
    }, [teacherUid, results, gradeLevel]);

    const handleRefresh = useCallback(async () => {
        if (!bResult) { handleSubmit(); return; }
        setState('submitting');
        try {
            const updated = await nationalBenchmarkService.calcPercentile(
                teacherUid, gradeLevel, bResult.yourAvg,
            );
            setBResult(updated);
            setState('result');
        } catch {
            setState('error');
        }
    }, [bResult, teacherUid, gradeLevel, handleSubmit]);

    const payload = calcPayload(teacherUid, results, gradeLevel);

    return (
        <Card className="border-l-4 border-l-indigo-500">
            <div className="flex items-center gap-2 mb-3">
                <Globe className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <div>
                    <h3 className="font-bold text-gray-800 text-sm">Национален Бенчмарк</h3>
                    <p className="text-xs text-gray-500">{gradeLevel}. одделение · Македонија</p>
                </div>
            </div>

            {/* ── Not yet submitted ─────────────────────────────────────────── */}
            {(state === 'idle') && !alreadySubmitted && (
                <div className="space-y-3">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                        <p className="font-semibold mb-1">Споредете го вашиот клас со Македонија</p>
                        <p className="text-xs text-indigo-600">
                            Само агрегирани бројки — без имиња на ученици, без лични податоци.
                            Ваш просек: <strong>{payload.avgPercentage}%</strong> од {payload.totalAttempts} квиз обиди.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Lock className="w-3 h-3 flex-shrink-0" />
                        Само агрегат · ЗЗЛП-усогласено · Opt-in
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={results.length < 5}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-40"
                    >
                        <Globe className="w-4 h-4" />
                        Придонеси во бенчмарк
                    </button>
                    {results.length < 5 && (
                        <p className="text-xs text-gray-400 text-center">Потребни се барем 5 квиз обиди</p>
                    )}
                </div>
            )}

            {/* ── Submitting ────────────────────────────────────────────────── */}
            {state === 'submitting' && (
                <div className="flex items-center gap-3 py-4 text-gray-500 text-sm">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    Пресметувам перцентил…
                </div>
            )}

            {/* ── Already submitted, show refresh option ────────────────────── */}
            {state === 'idle' && alreadySubmitted && !bResult && (
                <div className="space-y-3">
                    <p className="text-xs text-gray-500">Веќе придонесовте. Освежете за нов перцентил.</p>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Ажурирај и прикажи перцентил
                    </button>
                </div>
            )}

            {/* ── Result ───────────────────────────────────────────────────── */}
            {state === 'result' && bResult && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <PercentileGauge value={bResult.percentile} />
                        <div className="text-right space-y-1">
                            <div>
                                <p className="text-xs text-gray-400">Вашиот просек</p>
                                <p className="text-2xl font-black text-gray-900">{bResult.yourAvg}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Национален просек</p>
                                <p className="text-lg font-bold text-gray-600">{bResult.nationalAvg}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 text-sm">
                        {bResult.percentile >= 75 ? (
                            <p className="text-emerald-700 font-semibold">
                                🏆 Вашиот клас е подобар од <strong>{bResult.percentile}%</strong> од наставниците во Македонија за {bResult.gradeLevel}. одделение.
                            </p>
                        ) : bResult.percentile >= 50 ? (
                            <p className="text-blue-700 font-semibold">
                                ✅ Вашиот клас е над просекот — подобар од <strong>{bResult.percentile}%</strong> на наставниците.
                            </p>
                        ) : (
                            <p className="text-amber-700 font-semibold">
                                ⚠️ Вашиот клас е под националниот просек. Просечна разлика: <strong>{bResult.nationalAvg - bResult.yourAvg}%</strong>.
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                            Базирано на {bResult.sampleSize} {bResult.sampleSize === 1 ? 'клас' : 'класа'} за {bResult.gradeLevel}. одделение
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Ажурирај бенчмарк
                    </button>
                </div>
            )}

            {/* ── Error ────────────────────────────────────────────────────── */}
            {state === 'error' && (
                <div className="text-sm text-red-600 py-2">
                    Грешка при поврзување. <button type="button" onClick={() => setState('idle')} className="underline">Обиди се повторно</button>
                </div>
            )}
        </Card>
    );
};
