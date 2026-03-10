import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, QrCode, TrendingDown, Clock, Bell } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { sendLocalNotification } from '../../services/pushService';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { GradeBadge } from '../../components/common/GradeBadge';
import { CopilotInsightBanner } from '../../components/ai/CopilotInsightBanner';
import { confidenceEmoji, confidenceColor, type PerStudentStat, type ConceptStat } from './shared';

interface AlertsTabProps {
    perStudentStats: PerStudentStat[];
    weakConcepts: ConceptStat[]; // avgPct < 70, further filtered to < 60 here
    results: any[];
    onGenerateRemedial: (conceptId: string, title: string, avgPct: number) => void;
}

// ── Risk helpers ─────────────────────────────────────────────────────────────

type RiskLevel = 'high' | 'medium' | 'low';

interface RiskSignal {
    label: string;
    icon: 'trend' | 'clock' | 'score' | 'confidence';
}

interface StudentRisk {
    name: string;
    level: RiskLevel;
    signals: RiskSignal[];
    trendSlope: number | null; // pts per quiz, negative = declining
    daysSinceActive: number | null;
    avg: number;
}

/** Simple linear regression slope over an array of values (y = mx + b → returns m) */
function linearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    const sumX = (n * (n - 1)) / 2;
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
    const sumY = values.reduce((s, v) => s + v, 0);
    const sumXY = values.reduce((s, v, i) => s + i * v, 0);
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function toMs(ts: any): number | null {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate().getTime();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.getTime();
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AlertsTab: React.FC<AlertsTabProps> = ({ perStudentStats, weakConcepts, results, onGenerateRemedial }) => {
    const [qrStudent, setQrStudent] = useState<string | null>(null);
    const [notifiedStudents, setNotifiedStudents] = useState<Set<string>>(new Set());

    const handleNotifyParent = (studentName: string, avg: number) => {
        sendLocalNotification(
            `⚠️ Ученик бара внимание: ${studentName}`,
            `Просечен резултат: ${avg}% — Контактирај го родителот.`,
            { icon: '/icons/icon-192x192.png' }
        );
        setNotifiedStudents(prev => new Set(prev).add(studentName));
    };
    const qrUrl = qrStudent
        ? `${window.location.origin}/#/my-progress?name=${encodeURIComponent(qrStudent)}`
        : '';

    const strugglingStudents = perStudentStats.filter(s => s.avg < 50 || s.passRate < 30);
    const criticalConcepts = weakConcepts.filter(c => c.avgPct < 60);
    const lowConfidenceStudents = perStudentStats.filter(s => s.avgConfidence !== undefined && s.avgConfidence < 2);

    // ── A3: Predictive Risk ────────────────────────────────────────────────────
    const predictiveRisks = useMemo((): StudentRisk[] => {
        if (!results || results.length === 0) return [];
        const now = Date.now();

        // Group results by student, sorted oldest→newest
        const byStudent: Record<string, any[]> = {};
        results.forEach(r => {
            if (!r.studentName) return;
            if (!byStudent[r.studentName]) byStudent[r.studentName] = [];
            byStudent[r.studentName].push(r);
        });
        Object.values(byStudent).forEach(arr =>
            arr.sort((a, b) => (toMs(a.playedAt) ?? 0) - (toMs(b.playedAt) ?? 0))
        );

        const risks: StudentRisk[] = [];

        perStudentStats.forEach(s => {
            const studentResults = byStudent[s.name] ?? [];
            const signals: RiskSignal[] = [];

            // Signal 1 — declining trend (last 5+ results, slope < -4 pts/quiz)
            const last5 = studentResults.slice(-5).map(r => r.percentage);
            const slope = last5.length >= 3 ? linearSlope(last5) : null;
            if (slope !== null && slope < -4) {
                signals.push({ label: `Опаѓачки тренд (${slope.toFixed(1)} пт/квиз)`, icon: 'trend' });
            }

            // Signal 2 — inactivity > 14 days and still not mastered much
            const lastMs = toMs(s.lastAttempt);
            const daysSinceActive = lastMs !== null ? Math.floor((now - lastMs) / 86_400_000) : null;
            if (daysSinceActive !== null && daysSinceActive > 14 && s.masteredCount < 3) {
                signals.push({ label: `Неактивен ${daysSinceActive} дена`, icon: 'clock' });
            }

            // Signal 3 — low overall performance
            if (s.avg < 50 || s.passRate < 30) {
                signals.push({ label: `Просек ${s.avg}% / Положиле ${s.passRate}%`, icon: 'score' });
            }

            // Signal 4 — low self-confidence
            if (s.avgConfidence !== undefined && s.avgConfidence < 2) {
                signals.push({ label: 'Ниска самодоверба', icon: 'confidence' });
            }

            if (signals.length === 0) return;

            const level: RiskLevel = signals.length >= 3 ? 'high' : signals.length === 2 ? 'medium' : 'low';
            risks.push({ name: s.name, level, signals, trendSlope: slope, daysSinceActive, avg: s.avg });
        });

        // Sort: high → medium → low
        const ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };
        return risks.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
    }, [perStudentStats, results]);

    return (
        <SilentErrorBoundary name="AlertsTab">
            <div className="space-y-6">

                {/* ── A3: Predictive Risk ─────────────────────────────────── */}
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                            Предиктивен ризик — ученици кои треба интервенција
                        </h2>
                        {predictiveRisks.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                {predictiveRisks.length}
                            </span>
                        )}
                    </div>

                    {predictiveRisks.length === 0 ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <p className="text-sm font-semibold">Нема ученици со предиктивни ризик-сигнали.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {predictiveRisks.map(r => {
                                const levelCfg = r.level === 'high'
                                    ? { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: '🔴 Висок' }
                                    : r.level === 'medium'
                                    ? { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', label: '🟠 Среден' }
                                    : { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', label: '🟡 Низок' };
                                return (
                                    <div key={r.name} className={`rounded-xl border px-4 py-3 ${levelCfg.bg}`}>
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${levelCfg.dot}`} />
                                                <p className="font-bold text-sm text-slate-800 truncate">{r.name}</p>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${levelCfg.badge}`}>
                                                    {levelCfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { window.location.hash = `/my-progress?name=${encodeURIComponent(r.name)}`; }}
                                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                                >
                                                    Прогрес →
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { window.location.hash = `/tutor?student=${encodeURIComponent(r.name)}`; }}
                                                    className="text-xs font-bold text-purple-600 hover:underline"
                                                >
                                                    🤖 Тутор →
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setQrStudent(r.name)}
                                                    title="QR за родители"
                                                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    <QrCode className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleNotifyParent(r.name, r.avg)}
                                                    title="Испрати известување"
                                                    className={`p-1 transition-colors ${notifiedStudents.has(r.name) ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                                                >
                                                    <Bell className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {r.signals.map((sig, i) => (
                                                <span key={i} className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-full">
                                                    {sig.icon === 'trend' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                                    {sig.icon === 'clock' && <Clock className="w-3 h-3 text-amber-500" />}
                                                    {sig.icon === 'score' && <AlertTriangle className="w-3 h-3 text-orange-500" />}
                                                    {sig.icon === 'confidence' && <span className="text-xs">😟</span>}
                                                    {sig.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>

                <CopilotInsightBanner
                    results={results}
                    weakConcepts={weakConcepts}
                    onGenerateRemedial={onGenerateRemedial}
                />
                {/* ── Struggling Students ──────────────────────────────── */}
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                            Ученици кои бараат внимание
                        </h2>
                        {strugglingStudents.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                {strugglingStudents.length}
                            </span>
                        )}
                    </div>

                    {strugglingStudents.length === 0 ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <p className="text-sm font-semibold">Сите ученици се на добро ниво!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                        <th className="py-2 px-3 font-semibold">Ученик</th>
                                        <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                        <th className="py-2 px-3 text-center font-semibold">Положиле</th>
                                        <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                        <th className="py-2 px-3 font-semibold">Акција</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {strugglingStudents.map(s => (
                                        <tr key={s.name} className="border-b border-gray-50 hover:bg-red-50 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                                {s.name}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="flex items-center justify-center gap-1.5">
                                                    <span className="font-bold text-red-600">{s.avg}%</span>
                                                    <GradeBadge pct={s.avg} />
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{s.passRate}%</td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{s.attempts}</td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { window.location.hash = `/my-progress?name=${encodeURIComponent(s.name)}`; }}
                                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                                    >
                                                        Прогрес →
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQrStudent(s.name)}
                                                        title="QR код за родители"
                                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <QrCode className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleNotifyParent(s.name, s.avg)}
                                                        title="Испрати известување"
                                                        className={`p-1 transition-colors ${notifiedStudents.has(s.name) ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                                                    >
                                                        <Bell className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* ── Critical Concepts ─────────────────────────────────── */}
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                            Концепти со слаби резултати
                        </h2>
                        {criticalConcepts.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                                {criticalConcepts.length}
                            </span>
                        )}
                    </div>

                    {criticalConcepts.length === 0 ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <p className="text-sm font-semibold">Сите концепти над 60%!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                        <th className="py-2 px-3 font-semibold">Концепт</th>
                                        <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                        <th className="py-2 px-3 text-center font-semibold">Ученици</th>
                                        <th className="py-2 px-3 text-center font-semibold">Обиди</th>
                                        <th className="py-2 px-3 font-semibold">Акција</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {criticalConcepts.map(c => (
                                        <tr key={c.conceptId} className="border-b border-gray-50 hover:bg-orange-50 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700">{c.title}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="flex items-center justify-center gap-1.5">
                                                    <span className="font-bold text-orange-600">{c.avgPct}%</span>
                                                    <GradeBadge pct={c.avgPct} />
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{c.uniqueStudents}</td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{c.attempts}</td>
                                            <td className="py-2.5 px-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onGenerateRemedial(c.conceptId, c.title, c.avgPct)}
                                                    className="text-xs font-bold text-orange-600 hover:underline whitespace-nowrap"
                                                >
                                                    Генерирај ремедијал →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                {/* ── Low Confidence Students ────────────────────────────── */}
                <Card>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                            Ученици со ниска самодоверба
                        </h2>
                        {lowConfidenceStudents.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                {lowConfidenceStudents.length}
                            </span>
                        )}
                    </div>

                    {lowConfidenceStudents.length === 0 ? (
                        <div className="flex items-center gap-2 py-6 justify-center text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <p className="text-sm font-semibold">Нема ученици со многу ниска самодоверба.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-gray-100">
                                        <th className="py-2 px-3 font-semibold">Ученик</th>
                                        <th className="py-2 px-3 text-center font-semibold">Просек</th>
                                        <th className="py-2 px-3 text-center font-semibold">Доверба</th>
                                        <th className="py-2 px-3 font-semibold">Акција</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowConfidenceStudents.map(s => (
                                        <tr key={s.name} className="border-b border-gray-50 hover:bg-amber-50 transition-colors">
                                            <td className="py-2.5 px-3 font-semibold text-slate-700">{s.name}</td>
                                            <td className="py-2.5 px-3 text-center text-gray-600">{s.avg}%</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`text-sm ${confidenceColor(s.avgConfidence)}`}>
                                                    {confidenceEmoji(s.avgConfidence)}
                                                </span>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            {/* QR Code overlay */}
            {qrStudent && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                    onClick={() => setQrStudent(null)}
                >
                    <div
                        className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center w-full">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-indigo-600" />
                                QR за родители
                            </h3>
                            <button
                                type="button"
                                onClick={() => setQrStudent(null)}
                                className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
                                aria-label="Затвори"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="text-sm font-semibold text-gray-700 text-center">{qrStudent}</p>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <QRCodeSVG value={qrUrl} size={200} />
                        </div>
                        <p className="text-xs text-gray-400 text-center break-all">{qrUrl}</p>
                        <div className="flex gap-2 w-full">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                            >
                                Печати QR
                            </button>
                            <button
                                type="button"
                                onClick={() => setQrStudent(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                            >
                                Затвори
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SilentErrorBoundary>
    );
};
