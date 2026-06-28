import React, { useMemo } from 'react';
import { GradeEntry } from '../../types';
import { MATH_STANDARDS } from '../../data/allNationalStandardsComplete';
import { AlertTriangle, CheckCircle2, TrendingUp, BookOpen } from 'lucide-react';

interface BROCoveragePanelProps {
  entries: GradeEntry[];
  gradeLevel: number;
}

interface StandardCoverage {
  code: string;
  description: string;
  avgScore: number | null;
  count: number;
}

function computeCoverage(entries: GradeEntry[]): Map<string, { sum: number; count: number }> {
  const map = new Map<string, { sum: number; count: number }>();
  for (const entry of entries) {
    if (!entry.standardScores) continue;
    for (const [code, score] of Object.entries(entry.standardScores)) {
      const prev = map.get(code) ?? { sum: 0, count: 0 };
      map.set(code, { sum: prev.sum + score, count: prev.count + 1 });
    }
  }
  return map;
}

function scoreColor(avg: number | null): string {
  if (avg === null) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (avg < 2) return 'bg-red-100 text-red-700 border-red-300';
  if (avg < 3) return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-green-100 text-green-700 border-green-300';
}

function scoreIcon(avg: number | null) {
  if (avg === null) return null;
  if (avg < 2) return <AlertTriangle className="w-3 h-3" />;
  if (avg < 3) return <TrendingUp className="w-3 h-3" />;
  return <CheckCircle2 className="w-3 h-3" />;
}

function scoreLabel(avg: number | null): string {
  if (avg === null) return '—';
  return avg.toFixed(1);
}

export const BROCoveragePanel: React.FC<BROCoveragePanelProps> = ({ entries, gradeLevel }) => {
  const coverageMap = useMemo(() => computeCoverage(entries), [entries]);

  // Only math standards (III-А area), valid for primary (grade ≤ 9)
  const standards: StandardCoverage[] = useMemo(() =>
    MATH_STANDARDS.map(s => {
      const data = coverageMap.get(s.code);
      return {
        code: s.code,
        description: s.description,
        avgScore: data ? data.sum / data.count : null,
        count: data?.count ?? 0,
      };
    }),
    [coverageMap]
  );

  const gaps = standards.filter(s => s.avgScore !== null && s.avgScore < 2);
  const covered = standards.filter(s => s.avgScore !== null).length;
  const isPrimary = gradeLevel <= 9;

  if (!isPrimary) {
    return (
      <div className="text-xs text-gray-400 italic text-center py-2">
        БРО стандардите важат само за основно образование (одд. 1–9).
      </div>
    );
  }

  if (covered === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm space-y-1">
        <BookOpen className="w-8 h-8 mx-auto text-gray-300" />
        <p className="font-medium text-gray-500">Нема поврзани БРО стандарди</p>
        <p className="text-xs">Во SBG режим, кога внесуваш оценка по ученик одбери БРО стандарди и профициенција (1–4).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex gap-3 text-xs">
        <span className="bg-gray-100 rounded px-2 py-1 text-gray-600">
          Покриени стандарди: <strong>{covered}/{standards.length}</strong>
        </span>
        {gaps.length > 0 && (
          <span className="bg-red-100 text-red-700 rounded px-2 py-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <strong>{gaps.length}</strong> стандарди под 2.0
          </span>
        )}
      </div>

      {/* Gap alert */}
      {gaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">⚠ Стандарди кои бараат интервенција:</p>
          <ul className="space-y-0.5">
            {gaps.map(g => (
              <li key={g.code} className="text-xs text-red-700">
                <span className="font-mono font-bold mr-1">{g.code}</span>
                <span className="text-red-600">(просек {g.avgScore!.toFixed(1)})</span>
                {' — '}
                <span className="text-red-800 line-clamp-1">{g.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Standards grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {standards.map(s => (
          <div
            key={s.code}
            title={s.description}
            className={`border rounded p-1.5 text-xs flex items-center justify-between gap-1 cursor-default ${scoreColor(s.avgScore)}`}
          >
            <span className="font-mono font-semibold truncate flex-1 text-[10px]">{s.code}</span>
            <span className="flex items-center gap-0.5 font-bold shrink-0">
              {scoreIcon(s.avgScore)}
              {scoreLabel(s.avgScore)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 text-right">
        БРО стандарди III-А · <span className="text-green-600">≥3</span> = добро · <span className="text-amber-600">2–3</span> = во напредок · <span className="text-red-600">&lt;2</span> = интервенција
      </p>
    </div>
  );
};

export { computeCoverage };
