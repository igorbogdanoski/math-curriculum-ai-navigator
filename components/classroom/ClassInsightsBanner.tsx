import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BookOpen, FlaskConical, AlertTriangle, Users } from 'lucide-react';
import { useClassInsights } from '../../hooks/useClassInsights';

interface ClassInsightsBannerProps {
  conceptIds: string[];
  teacherUid: string | undefined;
  /** Optional: navigates to the relevant lab Вежбај tab */
  onOpenLab?: (conceptId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avgColor(pct: number): string {
  if (pct === 0) return 'text-gray-400';
  if (pct >= 80) return 'text-emerald-700';
  if (pct >= 60) return 'text-amber-700';
  return 'text-red-700';
}

function avgBg(pct: number): string {
  if (pct === 0) return 'bg-gray-50 border-gray-200';
  if (pct >= 80) return 'bg-emerald-50 border-emerald-200';
  if (pct >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function TrendIcon({ trend }: { trend: number }) {
  if (Math.abs(trend) < 3) return <Minus className="w-3.5 h-3.5 text-gray-400" />;
  if (trend > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />;
  return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
}

// ─── ClassInsightsBanner ──────────────────────────────────────────────────────
export function ClassInsightsBanner({ conceptIds, teacherUid, onOpenLab }: ClassInsightsBannerProps) {
  const { data, isLoading } = useClassInsights(conceptIds, teacherUid);
  const [expanded, setExpanded] = useState(false);

  // Don't render if no teacherUid or no conceptIds
  if (!teacherUid || conceptIds.length === 0) return null;

  const hasData = data.regularSessions > 0 || data.labSessions > 0;

  // Auto-expand when there are weak spots
  const hasWeakSpots = data.weakConceptIds.length > 0;

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${avgBg(hasData ? data.regularAvg : 0)}`}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:brightness-95 transition-all"
      >
        <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
        <span className="text-[11px] font-black text-gray-600 uppercase tracking-wide flex-1">
          Класни инсајти
        </span>

        {isLoading ? (
          <span className="text-[10px] text-gray-400 animate-pulse">Вчитувам…</span>
        ) : hasData ? (
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-extrabold ${avgColor(data.regularAvg)}`}>
              {data.regularAvg}%
            </span>
            <TrendIcon trend={data.trend} />
            {hasWeakSpots && <AlertTriangle className="w-3 h-3 text-amber-500" />}
          </div>
        ) : (
          <span className="text-[10px] text-gray-400">Нема податоци</span>
        )}

        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-current/10">
          {!hasData && !isLoading && (
            <p className="text-[11px] text-gray-400 py-2 text-center">
              Нема квизови или лаб сесии за оваа тема уште.
            </p>
          )}

          {/* Regular quiz stats */}
          {data.regularSessions > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-indigo-500" />
                <span className="text-[11px] font-bold text-gray-600">Квизови</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Stat label="Сесии" value={String(data.regularSessions)} />
                <Stat label="Просек" value={`${data.regularAvg}%`} color={avgColor(data.regularAvg)} />
                <Stat
                  label="Тренд"
                  value={Math.abs(data.trend) < 3 ? '→' : data.trend > 0 ? `↑${data.trend}%` : `↓${Math.abs(data.trend)}%`}
                  color={data.trend >= 3 ? 'text-emerald-700' : data.trend <= -3 ? 'text-red-700' : 'text-gray-500'}
                />
              </div>
            </div>
          )}

          {/* Lab sessions stats */}
          {data.labSessions > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="w-3 h-3 text-violet-500" />
                <span className="text-[11px] font-bold text-gray-600">Лаб вежби</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Stat label="Сесии" value={String(data.labSessions)} />
                <Stat label="Просек" value={`${data.labAvg}%`} color={avgColor(data.labAvg)} />
              </div>
            </div>
          )}

          {/* Per-concept breakdown (if multiple concepts) */}
          {data.byConceptId.length > 1 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">По концепт</p>
              {data.byConceptId.map(c => (
                <div key={c.conceptId} className="flex items-center gap-2 py-0.5">
                  <span className="text-[10px] text-gray-500 font-mono flex-1 truncate">{c.conceptId}</span>
                  <span className={`text-[10px] font-bold ${avgColor(c.avgPercentage)}`}>
                    {c.avgPercentage}%
                  </span>
                  <span className="text-[10px] text-gray-400">({c.totalSessions})</span>
                </div>
              ))}
            </div>
          )}

          {/* Weak spots recommendation */}
          {hasWeakSpots && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span className="text-[11px] font-bold text-amber-800">Потребна поддршка</span>
              </div>
              <p className="text-[10px] text-amber-700 leading-relaxed">
                Просекот е под 70% за {data.weakConceptIds.length} концепт{data.weakConceptIds.length > 1 ? 'и' : ''}.
                Препорака: отвори ја соодветната лабораторија за практика.
              </p>
              {onOpenLab && (
                <button
                  type="button"
                  onClick={() => onOpenLab(data.weakConceptIds[0])}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-800 underline hover:no-underline"
                >
                  <FlaskConical className="w-3 h-3" /> Стартувај лаб →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────
function Stat({ label, value, color = 'text-gray-700' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-white/60 border border-current/10 p-1.5 text-center">
      <p className="text-[9px] text-gray-400 font-semibold uppercase">{label}</p>
      <p className={`text-sm font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
