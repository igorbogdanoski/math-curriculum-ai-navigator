import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { ScoreBar } from './shared';
import { CheckCircle2, BookOpen, GraduationCap, AlertCircle, Download, ChevronDown, ChevronUp, Filter } from 'lucide-react';

interface FullStandardStatus {
    standard: { id: string; code: string; description: string; gradeLevel?: number };
    isCovered: boolean;
    isTested: boolean;
    avgScore: number;
    masteredCount: number;
    coveringConcepts: { id: string; title: string; avgPct?: number }[];
}

interface TestedStandard {
    standard: { id: string; code: string; description: string };
    avgScore: number;
    conceptCount: number;
}

interface StandardsTabProps {
    standardsCoverage: {
        tested: TestedStandard[];
        notTested: any[];
        all?: FullStandardStatus[];
    };
}

// Escapes user-facing strings before injecting into document.write HTML (prevents XSS)
const escHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const StandardsTab: React.FC<StandardsTabProps> = ({ standardsCoverage }) => {
    const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'covered' | 'tested' | 'mastered' | 'not_covered'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const allStandards = useMemo(() => standardsCoverage.all || [], [standardsCoverage.all]);

    const grades = useMemo(
        () => Array.from(new Set(allStandards.map(s => s.standard.gradeLevel).filter((g): g is number => typeof g === 'number'))).sort((a, b) => a - b),
        [allStandards]
    );

    const filtered = useMemo(() => allStandards.filter(s => {
        if (gradeFilter !== 'all' && s.standard.gradeLevel !== gradeFilter) return false;
        if (statusFilter === 'covered' && !s.isCovered) return false;
        if (statusFilter === 'tested' && !s.isTested) return false;
        if (statusFilter === 'mastered' && s.masteredCount === 0) return false;
        if (statusFilter === 'not_covered' && s.isCovered) return false;
        return true;
    }), [allStandards, gradeFilter, statusFilter]);

    const { coveredCount, testedCount, masteredStdCount } = useMemo(() => ({
        coveredCount: allStandards.filter(s => s.isCovered).length,
        testedCount: allStandards.filter(s => s.isTested).length,
        masteredStdCount: allStandards.filter(s => s.masteredCount > 0).length,
    }), [allStandards]);

    const handleExportPDF = useCallback(() => {
        try {
            const printStandards = gradeFilter !== 'all'
                ? allStandards.filter(s => s.standard.gradeLevel === gradeFilter)
                : allStandards;
            const rows = printStandards.map(s => {
                const status = s.isTested
                    ? (s.avgScore >= 70 ? '&#x2705; Совладано' : '&#x1F4CA; Тестирано')
                    : s.isCovered ? '&#x1F4DA; Во програма' : '&#x2B1C; Не покриено';
                const score = s.isTested ? `${s.avgScore}%` : '&mdash;';
                return `<tr>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;color:#4a5568;white-space:nowrap">${escHtml(s.standard.code)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${escHtml(s.standard.description)}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:center;white-space:nowrap">${status}</td>
                <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:center;font-weight:bold">${score}</td>
            </tr>`;
            }).join('');
            const gradeName = gradeFilter !== 'all' ? `${Number(gradeFilter)}-то Одделение` : 'Сите Одделенија (6&ndash;9)';
            const covPrint = printStandards.filter(s => s.isCovered).length;
            const testPrint = printStandards.filter(s => s.isTested).length;
            const mastPrint = printStandards.filter(s => s.masteredCount > 0).length;
            const html = `<!DOCTYPE html>
<html lang="mk">
<head><meta charset="UTF-8"><title>Потврда за покриеност на МОН стандарди</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a202c;padding:32px;margin:0}
  h1{font-size:20px;color:#2d3748;margin-bottom:4px}
  .subtitle{font-size:13px;color:#718096;margin-bottom:24px}
  .stats{display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap}
  .stat{background:#f7fafc;border-radius:8px;padding:12px 20px;min-width:100px}
  .stat-num{font-size:28px;font-weight:900;color:#2b6cb0}
  .stat-label{font-size:11px;color:#718096}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#2b6cb0;color:white;padding:8px 10px;font-size:12px;text-align:left}
  tr:nth-child(even){background:#f7fafc}
  .footer{margin-top:24px;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:12px}
  .print-btn{margin-top:20px;padding:10px 24px;background:#2b6cb0;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer}
  @media print{.no-print{display:none}}
</style></head>
<body>
<h1>&#x1F4CA; Потврда за покриеност на Национални МОН Стандарди</h1>
<p class="subtitle">Одделение: ${gradeName} | Датум: ${new Date().toLocaleDateString('mk-MK', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<div class="stats">
  <div class="stat"><div class="stat-num">${printStandards.length}</div><div class="stat-label">Вкупно стандарди</div></div>
  <div class="stat"><div class="stat-num">${covPrint}</div><div class="stat-label">Покриени во програма</div></div>
  <div class="stat"><div class="stat-num">${testPrint}</div><div class="stat-label">Тестирани (квизови)</div></div>
  <div class="stat"><div class="stat-num">${mastPrint}</div><div class="stat-label">Совладани (ученици)</div></div>
</div>
<table>
  <thead><tr><th>Код</th><th>Стандард</th><th>Статус</th><th>Резултат</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Извештај генериран од Math Curriculum AI Navigator | МОН Национални стандарди за основно образование</div>
<button class="print-btn no-print" onclick="window.print()">&#x1F5A8;&#xFE0F; Печати / Зачувај PDF</button>
</body></html>`;
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win) {
                URL.revokeObjectURL(url);
                alert('Popup блокиран. Дозволи popup-и за овој сајт за да го генерираш PDF извештајот.');
                return;
            }
            // Revoke after the window has loaded
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch {
            alert('Грешка при генерирање на PDF извештајот. Обиди се повторно.');
        }
    }, [allStandards, gradeFilter]);

    // Fallback to legacy view if `all` data not yet available
    if (allStandards.length === 0) {
        return (
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
                    </Card>
                </div>
            </SilentErrorBoundary>
        );
    }

    return (
        <SilentErrorBoundary name="StandardsTab">
            <div className="space-y-4">
                {/* Summary stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-slate-700">{allStandards.length}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">Вкупно МОН стандарди</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-blue-700">{coveredCount}</p>
                        <p className="text-xs font-semibold text-blue-500 mt-0.5">Покриени во програма</p>
                        <div className="mt-1.5 w-full bg-blue-100 rounded-full h-1.5">
                            <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width: `${allStandards.length > 0 ? Math.round(coveredCount / allStandards.length * 100) : 0}%` }} />
                        </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-amber-700">{testedCount}</p>
                        <p className="text-xs font-semibold text-amber-500 mt-0.5">Тестирани (квизови)</p>
                        <div className="mt-1.5 w-full bg-amber-100 rounded-full h-1.5">
                            <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${allStandards.length > 0 ? Math.round(testedCount / allStandards.length * 100) : 0}%` }} />
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-green-700">{masteredStdCount}</p>
                        <p className="text-xs font-semibold text-green-500 mt-0.5">Совладани (ученици)</p>
                        <div className="mt-1.5 w-full bg-green-100 rounded-full h-1.5">
                            <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: `${allStandards.length > 0 ? Math.round(masteredStdCount / allStandards.length * 100) : 0}%` }} />
                        </div>
                    </div>
                </div>

                <Card>
                    {/* Controls row */}
                    <div className="flex flex-wrap gap-3 mb-5 items-center justify-between">
                        {/* Grade filter */}
                        <div className="flex gap-1 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setGradeFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${gradeFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Сите одд.
                            </button>
                            {grades.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    onClick={() => setGradeFilter(g)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${gradeFilter === g ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {g}-то одд.
                                </button>
                            ))}
                        </div>
                        {/* Status filter + PDF export */}
                        <div className="flex gap-1 flex-wrap items-center">
                            <Filter className="w-3.5 h-3.5 text-gray-400 mr-0.5" />
                            {([['all', 'Сите'], ['covered', 'Покриени'], ['tested', 'Тестирани'], ['mastered', 'Совладани'], ['not_covered', 'Не покриени']] as const).map(([v, label]) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setStatusFilter(v)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${statusFilter === v ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {label}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleExportPDF}
                                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                                title="Генерирај PDF Потврда за покриеност"
                            >
                                <Download className="w-3.5 h-3.5" />
                                PDF Потврда
                            </button>
                        </div>
                    </div>

                    {/* Count badge */}
                    <p className="text-xs text-gray-400 mb-3">
                        Прикажани <span className="font-bold text-gray-600">{filtered.length}</span> од {allStandards.length} стандарди
                    </p>

                    {/* Standards list */}
                    <div className="space-y-1.5">
                        {filtered.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-10">Нема стандарди за избраниот филтер.</p>
                        )}
                        {filtered.map(({ standard, isCovered, isTested, avgScore, masteredCount: mCount, coveringConcepts }) => {
                            const isExpanded = expandedId === standard.id;
                            let statusBadge: React.ReactNode;
                            let rowBg: string;

                            if (isTested && avgScore >= 70) {
                                statusBadge = (
                                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                        <CheckCircle2 className="w-3 h-3" />Совладано
                                    </span>
                                );
                                rowBg = 'bg-green-50/50 border-green-100';
                            } else if (isTested) {
                                statusBadge = (
                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                        <BookOpen className="w-3 h-3" />Тестирано
                                    </span>
                                );
                                rowBg = 'bg-amber-50/40 border-amber-100';
                            } else if (isCovered) {
                                statusBadge = (
                                    <span className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                        <GraduationCap className="w-3 h-3" />Во програма
                                    </span>
                                );
                                rowBg = 'bg-blue-50/20 border-slate-100';
                            } else {
                                statusBadge = (
                                    <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                        <AlertCircle className="w-3 h-3" />Не покриено
                                    </span>
                                );
                                rowBg = 'bg-white border-slate-100';
                            }

                            return (
                                <div key={standard.id} className={`rounded-xl border ${rowBg} overflow-hidden`}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : standard.id)}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-black/5 transition"
                                    >
                                        <div className="flex-shrink-0 w-20 text-center">
                                            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 whitespace-nowrap">
                                                {standard.code}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 line-clamp-2">{standard.description}</p>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                            {statusBadge}
                                            {isTested && (
                                                <span className={`text-sm font-black w-10 text-right ${avgScore >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {avgScore}%
                                                </span>
                                            )}
                                            {isExpanded
                                                ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="px-4 pb-3 pt-2 border-t border-slate-100 bg-white/70">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Концепти кои го покриваат овој стандард:</p>
                                            {coveringConcepts.length === 0 ? (
                                                <p className="text-xs text-gray-400">Нема поврзани концепти во тековната наставна програма.</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {coveringConcepts.map(c => (
                                                        <div key={c.id} className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold text-slate-700 flex-1">{c.title}</span>
                                                            {c.avgPct !== undefined ? (
                                                                <div className="flex items-center gap-1.5 w-36">
                                                                    <ScoreBar pct={Math.max(c.avgPct, 3)} color={c.avgPct >= 70 ? 'bg-green-400' : 'bg-amber-400'} />
                                                                    <span className={`text-xs font-bold w-8 text-right ${c.avgPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{c.avgPct}%</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Не тестирано</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {mCount > 0 && (
                                                <p className="text-xs text-green-700 mt-2 font-semibold">
                                                    🎓 {mCount} {mCount === 1 ? 'ученик го' : 'ученици го'} совладале овој стандард
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                        Извор: МОН Национални стандарди за постигање на учениците на крај на основното образование (6–9 одделение).
                        Три нивоа — <span className="text-blue-600 font-semibold">Во програма</span> / <span className="text-amber-600 font-semibold">Тестирано</span> / <span className="text-green-600 font-semibold">Совладано</span>.
                    </p>
                </Card>
            </div>
        </SilentErrorBoundary>
    );
};
