/**
 * DuggaResultsTab — S91
 * Teacher ResultsPanel: Дуга тестови × класа — 3 под-таба:
 *   1. По тест (avg резултат, % полагање)
 *   2. По оценка (дистрибуција 1-5)
 *   3. Тренд (месечно)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  subscribeMyDuggaTests,
  getTestSubmissions,
  type DuggaTest,
  type DuggaSubmission,
} from '../../services/firestoreService.dugga';
import { BarChart, TrendingUp, Users } from 'lucide-react';

type SubTab = 'byTest' | 'grades' | 'trend';

interface Props {
  teacherUid: string;
}

function gradeFrom(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct < 30) return 1;
  if (pct < 50) return 2;
  if (pct < 70) return 3;
  if (pct < 85) return 4;
  return 5;
}

function monthKey(ts: any): string {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch { return 'N/A'; }
}

// ─────────────────────────────────────────────────────────────────────────────

export const DuggaResultsTab: React.FC<Props> = ({ teacherUid }) => {
  const [tests, setTests] = useState<DuggaTest[]>([]);
  const [allSubs, setAllSubs] = useState<DuggaSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subTab, setSubTab] = useState<SubTab>('byTest');

  // Subscribe to teacher's tests
  useEffect(() => {
    const unsub = subscribeMyDuggaTests(teacherUid, async (loadedTests) => {
      setTests(loadedTests);
      // Fetch submissions for all tests (parallel)
      const subsArrays = await Promise.all(
        loadedTests.map(t => getTestSubmissions(t.id).catch(() => [] as DuggaSubmission[])),
      );
      setAllSubs(subsArrays.flat());
      setIsLoading(false);
    });
    return unsub;
  }, [teacherUid]);

  // ── Per-test aggregate ────────────────────────────────────────────────────
  const testRows = useMemo(() => {
    return tests.map(t => {
      const subs = allSubs.filter(s => s.testId === t.id);
      const avg = subs.length > 0
        ? Math.round(subs.reduce((a, s) => a + s.percentage, 0) / subs.length)
        : null;
      const passCount = subs.filter(s => s.percentage >= 50).length;
      return { test: t, subs, avg, passCount };
    }).sort((a, b) => b.subs.length - a.subs.length);
  }, [tests, allSubs]);

  // ── Grade distribution ────────────────────────────────────────────────────
  const gradeDist = useMemo(() => {
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of allSubs) counts[gradeFrom(s.percentage)]++;
    return counts;
  }, [allSubs]);

  const maxGradeCount = Math.max(...Object.values(gradeDist), 1);

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const byMonth: Record<string, { count: number; totalPct: number }> = {};
    for (const s of allSubs) {
      const key = monthKey(s.submittedAt);
      if (!byMonth[key]) byMonth[key] = { count: 0, totalPct: 0 };
      byMonth[key].count++;
      byMonth[key].totalPct += s.percentage;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, d]) => ({ month, count: d.count, avg: Math.round(d.totalPct / d.count) }));
  }, [allSubs]);

  const maxCount = Math.max(...trendData.map(d => d.count), 1);

  const GRADE_LABELS: Record<number, string> = { 1: 'Недоволен (1)', 2: 'Доволен (2)', 3: 'Добар (3)', 4: 'Многу добар (4)', 5: 'Одличен (5)' };
  const GRADE_COLORS: Record<number, string> = { 1: 'bg-red-400', 2: 'bg-orange-400', 3: 'bg-amber-400', 4: 'bg-blue-400', 5: 'bg-emerald-500' };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mr-3" />
        <span className="text-slate-500 text-sm">Вчитување на Дуга резултати...</span>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-semibold">Немаш креирани Дуга тестови.</p>
        <p className="text-sm mt-1">Одди на /dugga за да создадеш прв тест.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-indigo-700">{tests.length}</p>
          <p className="text-xs text-indigo-500 mt-0.5">Вкупно тестови</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-emerald-700">{allSubs.length}</p>
          <p className="text-xs text-emerald-500 mt-0.5">Поднесени одговори</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-blue-700">
            {allSubs.length > 0 ? Math.round(allSubs.reduce((a, s) => a + s.percentage, 0) / allSubs.length) : '—'}%
          </p>
          <p className="text-xs text-blue-500 mt-0.5">Просечен резултат</p>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: 'byTest', label: 'По тест', icon: BarChart },
          { id: 'grades', label: 'По оценка', icon: Users },
          { id: 'trend', label: 'Тренд', icon: TrendingUp },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              subTab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab: By test */}
      {subTab === 'byTest' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-bold">Тест</th>
                <th className="px-4 py-2.5 font-bold text-center">Одд.</th>
                <th className="px-4 py-2.5 font-bold text-center">Поднесени</th>
                <th className="px-4 py-2.5 font-bold text-center">Avg %</th>
                <th className="px-4 py-2.5 font-bold text-center">Полагање</th>
              </tr>
            </thead>
            <tbody>
              {testRows.map(({ test, subs, avg, passCount }) => (
                <tr key={test.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-slate-800 max-w-xs truncate">{test.title}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{test.grade}. одд.</td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-700">{subs.length}</td>
                  <td className="px-4 py-2.5 text-center">
                    {avg !== null ? (
                      <span className={`font-bold ${avg >= 70 ? 'text-emerald-600' : avg >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {avg}%
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">
                    {subs.length > 0 ? `${passCount}/${subs.length}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-tab: Grade distribution */}
      {subTab === 'grades' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Дистрибуција на оценки (1–5)</h3>
          <div className="space-y-2.5">
            {([5, 4, 3, 2, 1] as const).map(g => {
              const count = gradeDist[g];
              const pct = allSubs.length > 0 ? Math.round((count / allSubs.length) * 100) : 0;
              const barPct = Math.round((count / maxGradeCount) * 100);
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-36 flex-shrink-0">{GRADE_LABELS[g]}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${GRADE_COLORS[g]} rounded-full transition-all duration-700`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-16 text-right flex-shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tab: Trend */}
      {subTab === 'trend' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Месечен тренд на поднесувања</h3>
          {trendData.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">Нема доволно податоци за тренд.</p>
          ) : (
            <div className="space-y-2">
              {trendData.map(({ month, count, avg }) => (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-20 flex-shrink-0">{month}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full transition-all duration-700"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-24 text-right flex-shrink-0">
                    {count} pol. · {avg}% avg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
