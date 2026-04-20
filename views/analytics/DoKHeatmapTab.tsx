/**
 * S37-C1 — DoK 1-4 Heatmap Tab
 *
 * Shows which students have practiced at which Depth-of-Knowledge level,
 * and their average score per DoK tier. Rows = students, columns = DoK 1–4.
 *
 * Data source: localResults (quiz_results) from TeacherAnalyticsView.
 * DoK inference priority:
 *   1. quizResult.dokLevel (explicit, stored on new quizzes)
 *   2. quizResult.differentiationLevel mapping (easy→1, medium→2, hard→3/4)
 */

import React, { useMemo } from 'react';
import { QuizResult } from '../../services/firestoreService.types';
import { DOK_META, DokLevel } from '../../types';

interface Props {
  results: QuizResult[];
}

const DOK_LEVELS: DokLevel[] = [1, 2, 3, 4];

const DOK_TEXT: Record<DokLevel, string> = {
  1: 'text-sky-600',
  2: 'text-emerald-600',
  3: 'text-amber-600',
  4: 'text-rose-600',
};

function inferDok(r: QuizResult): DokLevel | null {
  if (r.dokLevel && r.dokLevel >= 1 && r.dokLevel <= 4) return r.dokLevel as DokLevel;
  if (r.differentiationLevel === 'support') return 1;
  if (r.differentiationLevel === 'standard') return 2;
  if (r.differentiationLevel === 'advanced') return 3;
  return null;
}

interface CellData {
  count: number;
  avgPct: number;
}

function cellColor(avgPct: number, count: number): string {
  if (count === 0) return 'bg-gray-50 text-gray-300';
  if (avgPct >= 80) return 'bg-emerald-100 text-emerald-800';
  if (avgPct >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

export const DoKHeatmapTab: React.FC<Props> = ({ results }) => {
  // Build student × DoK matrix
  const { students, matrix, dokTotals } = useMemo(() => {
    const studentMap = new Map<string, Map<DokLevel, number[]>>();

    for (const r of results) {
      const dok = inferDok(r);
      if (!dok) continue;
      const name = r.studentName ?? 'Анонимен';
      if (!studentMap.has(name)) studentMap.set(name, new Map());
      const dokMap = studentMap.get(name)!;
      if (!dokMap.has(dok)) dokMap.set(dok, []);
      dokMap.get(dok)!.push(r.percentage);
    }

    const students = Array.from(studentMap.keys()).sort();

    const matrix = students.map(s => {
      const dokMap = studentMap.get(s)!;
      return DOK_LEVELS.map(dok => {
        const pcts = dokMap.get(dok) ?? [];
        const avg = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
        return { count: pcts.length, avgPct: avg } as CellData;
      });
    });

    // Column totals
    const dokTotals = DOK_LEVELS.map(dok => {
      const allPcts: number[] = [];
      for (const r of results) {
        if (inferDok(r) === dok) allPcts.push(r.percentage);
      }
      const avg = allPcts.length > 0 ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
      return { count: allPcts.length, avgPct: avg } as CellData;
    });

    return { students, matrix, dokTotals };
  }, [results]);

  const taggedCount = results.filter(r => inferDok(r) !== null).length;

  if (taggedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
        <span className="text-4xl">📊</span>
        <p className="font-medium">Нема квизови со DoK ознака</p>
        <p className="text-sm text-center max-w-xs">
          Генерирај квизови со поставена тежина (лесно/средно/тешко) или DoK ниво за да се прикаже хитмапата.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {DOK_LEVELS.map(dok => {
          const m = DOK_META[dok];
          return (
            <div key={dok} className="flex items-center gap-1.5 text-xs">
              <span className={`w-3 h-3 rounded-sm inline-block ${m.dot}`} />
              <span className="font-semibold text-gray-700">DoK {dok}</span>
              <span className="text-gray-400">{m.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-xs text-gray-400">{taggedCount}/{results.length} квизови со DoK</span>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 border-b border-gray-200 min-w-[150px]">
                Ученик
              </th>
              {DOK_LEVELS.map(dok => (
                <th key={dok} className="px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200 text-center min-w-[90px]">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${DOK_META[dok].dot}`} />
                  DoK {dok}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, si) => (
              <tr key={student} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-2 font-medium text-gray-800 truncate max-w-[200px]" title={student}>
                  {student}
                </td>
                {matrix[si].map((cell, di) => (
                  <td key={di} className="px-3 py-2 text-center">
                    {cell.count > 0 ? (
                      <span
                        className={`inline-flex flex-col items-center justify-center w-16 h-10 rounded-lg text-xs font-bold ${cellColor(cell.avgPct, cell.count)}`}
                        title={`${cell.count} квиз(ови) · ${cell.avgPct}% просек`}
                      >
                        <span className="text-base leading-tight">{cell.avgPct}%</span>
                        <span className="text-[10px] font-normal opacity-70">{cell.count}×</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-16 h-10 rounded-lg bg-gray-50 text-gray-300 text-lg">
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {/* Totals row */}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2.5 text-gray-600 text-xs uppercase tracking-wide">
                Просек на класот
              </td>
              {dokTotals.map((cell, di) => (
                <td key={di} className="px-3 py-2.5 text-center">
                  {cell.count > 0 ? (
                    <span
                      className={`inline-flex flex-col items-center justify-center w-16 h-10 rounded-lg text-xs font-bold ${cellColor(cell.avgPct, cell.count)}`}
                      title={`${cell.count} вкупно · ${cell.avgPct}% просек`}
                    >
                      <span className="text-base leading-tight">{cell.avgPct}%</span>
                      <span className="text-[10px] font-normal opacity-70">{cell.count}×</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-16 h-10 rounded-lg bg-gray-50 text-gray-300 text-lg">–</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* DoK coverage insight */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
        {DOK_LEVELS.map((dok, i) => {
          const cell = dokTotals[i];
          const m = DOK_META[dok];
          return (
            <div key={dok} className="rounded-xl border border-gray-200 p-3 text-center">
              <div className={`text-lg font-black ${cell.count > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                {cell.count > 0 ? `${cell.avgPct}%` : '–'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                <span className={`font-semibold ${DOK_TEXT[dok]}`}>DoK {dok}</span> · {m.label}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{cell.count} квиз(ови)</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
