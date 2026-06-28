/**
 * StandardsCoverageView — S91
 * Heatmap: 27 БРО Математички стандарди (III-А.1–27) × корисникови годишни планови
 * Green = покриен / Red = непокриен
 */
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { MATH_STANDARDS } from '../data/allNationalStandardsComplete';
import type { AIGeneratedAnnualPlan } from '../types';
import { Download, ArrowLeft, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedPlan {
  id: string;
  grade: string;
  subject: string;
  planData: AIGeneratedAnnualPlan;
}

type Coverage = 'covered' | 'partial' | 'missing';

// ─── Keyword extraction ───────────────────────────────────────────────────────

const MK_STOP = new Set([
  'да', 'и', 'на', 'со', 'во', 'за', 'при', 'или', 'по', 'до', 'ги',
  'го', 'се', 'тоа', 'а', 'но', 'дека', 'ако', 'само', 'меѓу', 'врз',
  'над', 'под', 'од', 'кои', 'кога', 'дали', 'ги', 'ги', 'кои', 'не',
  'е', 'со', 'во', 'за', 'да', 'и', 'или', 'при', 'различни', 'едноставни',
  'различен', 'соодветни', 'соодветен', 'основни', 'различно', 'ги', 'го',
  'него', 'неа', 'нив', 'него',
]);

function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .split(/[\s,.:;()/]+/)
    .filter(w => w.length >= 4 && !MK_STOP.has(w))
    .slice(0, 8);
}

/** Build plan search text from all topic titles + objectives */
function buildPlanText(plan: AIGeneratedAnnualPlan): string {
  return (plan.topics ?? [])
    .flatMap(t => [t.title, ...(t.objectives ?? []), ...(t.suggestedActivities ?? [])])
    .join(' ')
    .toLowerCase();
}

function detectCoverage(planText: string, standardDesc: string): Coverage {
  const keywords = extractKeywords(standardDesc);
  const hits = keywords.filter(kw => planText.includes(kw));
  if (hits.length === 0) return 'missing';
  if (hits.length >= 2) return 'covered';
  return 'partial';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlatformBenchmark {
  avgCoveragePct: number;
  sampleSize: number;
}

async function fetchPlatformBenchmark(): Promise<PlatformBenchmark> {
  try {
    // Sample the latest 30 public annual plans (any user) to compute platform avg coverage
    const snap = await getDocs(
      query(collection(db, 'academic_annual_plans'), orderBy('createdAt', 'desc'), limit(30)),
    );
    const allPlans = snap.docs.map(d => d.data() as { planData: AIGeneratedAnnualPlan });
    if (!allPlans.length) return { avgCoveragePct: 0, sampleSize: 0 };

    const coveragePcts = allPlans.map(p => {
      const planText = buildPlanText(p.planData);
      const covered = MATH_STANDARDS.filter(std => detectCoverage(planText, std.description) !== 'missing').length;
      return Math.round((covered / MATH_STANDARDS.length) * 100);
    });
    const avg = Math.round(coveragePcts.reduce((a, b) => a + b, 0) / coveragePcts.length);
    return { avgCoveragePct: avg, sampleSize: allPlans.length };
  } catch {
    return { avgCoveragePct: 0, sampleSize: 0 };
  }
}

export const StandardsCoverageView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [benchmark, setBenchmark] = useState<PlatformBenchmark | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) { setIsLoading(false); return; }
    (async () => {
      try {
        const q = query(
          collection(db, 'academic_annual_plans'),
          where('userId', '==', firebaseUser.uid),
          orderBy('createdAt', 'desc'),
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SavedPlan, 'id'>) }));
        setPlans(loaded);
        // Select all by default (up to 5)
        setSelectedPlanIds(new Set(loaded.slice(0, 5).map(p => p.id)));
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    })();
    // Fetch platform benchmark in parallel (non-blocking)
    fetchPlatformBenchmark().then(setBenchmark).catch(() => {});
  }, [firebaseUser?.uid]);

  const visiblePlans = useMemo(
    () => plans.filter(p => selectedPlanIds.has(p.id)),
    [plans, selectedPlanIds],
  );

  // coverage[standardCode][planId] = Coverage
  const coverageMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, Coverage>> = {};
    for (const std of MATH_STANDARDS) {
      matrix[std.code] = {};
      for (const plan of visiblePlans) {
        matrix[std.code][plan.id] = detectCoverage(buildPlanText(plan.planData), std.description);
      }
    }
    return matrix;
  }, [visiblePlans]);

  // Per-standard summary
  const stdSummary = useMemo(() => {
    return MATH_STANDARDS.map(std => {
      const cells = Object.values(coverageMatrix[std.code] ?? {});
      const covered = cells.filter(c => c === 'covered').length;
      const partial = cells.filter(c => c === 'partial').length;
      return { code: std.code, covered, partial, total: cells.length };
    });
  }, [coverageMatrix]);

  const uncoveredStds = stdSummary.filter(s => s.covered === 0 && s.partial === 0);

  const handlePrint = () => window.print();

  const handleExportCsv = () => {
    const header = ['Стандард', 'Опис', ...visiblePlans.map(p => `${p.grade} (${p.subject})`)];
    const rows = MATH_STANDARDS.map(std => [
      std.code,
      std.description,
      ...visiblePlans.map(p => {
        const c = coverageMatrix[std.code]?.[p.id];
        return c === 'covered' ? '✓ Покриен' : c === 'partial' ? '~ Делумно' : '✗ Непокриен';
      }),
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bro-standards-coverage.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 print:hidden">
        <div>
          <button
            type="button"
            onClick={() => navigate('/annual-planner')}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Назад кон планирање
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            🎯 БРО Стандарди — Покриеност
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            27 математички стандарди (III-А.1–27) × твоите годишни планови
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={visiblePlans.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
          >
            🖨️ Печати
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
          <span className="ml-3 text-slate-500">Вчитување на планови...</span>
        </div>
      )}

      {!isLoading && plans.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500 text-lg">Сè уште немаш зачувани годишни планови.</p>
          <button
            type="button"
            onClick={() => navigate('/annual-planner')}
            className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
          >
            + Генерирај прв план
          </button>
        </div>
      )}

      {!isLoading && plans.length > 0 && (
        <>
          {/* Plan selector */}
          <div className="mb-4 print:hidden">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Прикажи планови</p>
            <div className="flex flex-wrap gap-2">
              {plans.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanIds(prev => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                    return next;
                  })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                    selectedPlanIds.has(p.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {p.grade} — {p.subject}
                </button>
              ))}
            </div>
          </div>

          {/* Alert: uncovered standards */}
          {uncoveredStds.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 print:hidden">
              <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {uncoveredStds.length} непокриени стандарди:
                <span className="font-normal">{uncoveredStds.map(s => s.code).join(', ')}</span>
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="mb-4 flex items-center gap-4 text-xs text-slate-500 print:hidden">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Покриен</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Делумно</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Непокриен</span>
          </div>

          {/* Heatmap table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2.5 font-bold text-slate-600 w-24 border-b border-r border-slate-200">Код</th>
                  <th className="text-left px-3 py-2.5 font-bold text-slate-600 border-b border-r border-slate-200 min-w-[300px]">Стандард (опис)</th>
                  {visiblePlans.map(p => (
                    <th key={p.id} className="text-center px-2 py-2.5 font-bold text-slate-600 border-b border-r border-slate-200 min-w-[90px] max-w-[120px]">
                      <div className="leading-tight">{p.grade}</div>
                      <div className="text-slate-400 font-normal text-[10px] truncate max-w-[90px] mx-auto">{p.subject}</div>
                    </th>
                  ))}
                  <th className="text-center px-2 py-2.5 font-bold text-slate-600 border-b border-slate-200 min-w-[70px]">Покриеност</th>
                </tr>
              </thead>
              <tbody>
                {MATH_STANDARDS.map((std, idx) => {
                  const summary = stdSummary[idx];
                  const allCovered = summary.covered === summary.total && summary.total > 0;
                  const noneCovered = summary.covered === 0 && summary.partial === 0;

                  return (
                    <tr
                      key={std.code}
                      className={`border-b border-slate-100 ${
                        noneCovered ? 'bg-red-50/30' : allCovered ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap">
                        {std.code}
                      </td>
                      <td className="px-3 py-2 text-slate-700 border-r border-slate-100 leading-relaxed max-w-xs">
                        {std.description.length > 100
                          ? std.description.slice(0, 100) + '…'
                          : std.description}
                      </td>
                      {visiblePlans.map(p => {
                        const cov = coverageMatrix[std.code]?.[p.id] ?? 'missing';
                        return (
                          <td key={p.id} className="border-r border-slate-100 text-center py-2">
                            {cov === 'covered' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : cov === 'partial' ? (
                              <HelpCircle className="w-4 h-4 text-amber-400 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-300 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-bold text-[11px] ${
                          allCovered ? 'bg-emerald-100 text-emerald-700' :
                          noneCovered ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {summary.covered}/{summary.total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Anonymous Benchmarking */}
          {benchmark && benchmark.sampleSize >= 3 && (() => {
            const userCovPct = Math.round((stdSummary.filter(s => s.covered > 0).length / MATH_STANDARDS.length) * 100);
            const diff = userCovPct - benchmark.avgCoveragePct;
            const isAhead = diff >= 0;
            return (
              <div className={`mt-4 rounded-xl border px-4 py-3 flex items-center gap-4 ${isAhead ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="text-2xl">{isAhead ? '🏆' : '📈'}</div>
                <div className="flex-1">
                  <p className={`text-xs font-black ${isAhead ? 'text-emerald-700' : 'text-amber-700'}`}>
                    Анонимна споредба со платформата
                  </p>
                  <p className={`text-sm mt-0.5 ${isAhead ? 'text-emerald-800' : 'text-amber-800'}`}>
                    Твоите планови покриваат <span className="font-black">{userCovPct}%</span> стандарди.
                    Платформа avg: <span className="font-bold">{benchmark.avgCoveragePct}%</span>
                    {' '}({benchmark.sampleSize} планови).
                    {isAhead
                      ? <span className="font-bold"> +{diff}% над просекот! 🎉</span>
                      : <span> Уште {Math.abs(diff)}% до просекот — додади повеќе теми.</span>
                    }
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Summary footer */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Покриени стандарди',
                value: stdSummary.filter(s => s.covered > 0).length,
                total: MATH_STANDARDS.length,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              },
              {
                label: 'Непокриени',
                value: uncoveredStds.length,
                total: MATH_STANDARDS.length,
                color: 'text-red-700 bg-red-50 border-red-200',
              },
              {
                label: 'Прегледани планови',
                value: visiblePlans.length,
                total: plans.length,
                color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
              },
              {
                label: 'Вкупна покриеност',
                value: Math.round((stdSummary.filter(s => s.covered > 0).length / MATH_STANDARDS.length) * 100),
                total: 100,
                suffix: '%',
                color: 'text-blue-700 bg-blue-50 border-blue-200',
              },
            ].map(stat => (
              <div key={stat.label} className={`rounded-xl border p-3 ${stat.color}`}>
                <p className="text-xs font-bold opacity-70">{stat.label}</p>
                <p className="text-2xl font-black mt-0.5">
                  {stat.value}{stat.suffix ?? `/${stat.total}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
