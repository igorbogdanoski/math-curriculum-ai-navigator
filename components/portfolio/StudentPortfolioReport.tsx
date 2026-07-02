import React from 'react';
import { Award, BarChart2, BookOpen, Star, TrendingUp, Loader2, ExternalLink } from 'lucide-react';
import type { StudentPortfolioData } from '../../hooks/useStudentPortfolio';

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1).replace('.0', '') : '0';
}

function getScoreColor(pct: number): string {
  if (pct >= 85) return 'text-emerald-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

interface StudentPortfolioReportProps {
  data: StudentPortfolioData;
}

export const StudentPortfolioReport: React.FC<StudentPortfolioReportProps> = ({ data }) => {
  const {
    studentName, isLoading, results, masteredConcepts,
    avgPct, currentStreak, bestResults, weakConceptTitles,
    avatar, level, narrative, narrativeLoading, narrativeError,
  } = data;

  const portfolioUrl = `${window.location.origin}${window.location.pathname}#/portfolio?name=${encodeURIComponent(studentName)}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
        Нема доволно податоци за портфолио. Реши неколку квизови прво.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{avatar.emoji}</span>
          <div>
            <p className="font-extrabold text-gray-800 text-lg leading-tight">{studentName}</p>
            <p className="text-xs text-indigo-600 font-semibold">Ниво {level} · {avatar.title}</p>
          </div>
        </div>
        <a
          href={portfolioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Цело портфолио
        </a>
      </div>

      {/* ── KPI mini-cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Просек</p>
            <p className={`text-lg font-black ${getScoreColor(avgPct)}`}>{fmt(avgPct)}%</p>
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Совладани</p>
            <p className="text-lg font-black text-emerald-700">{masteredConcepts.length}</p>
          </div>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Квизови</p>
            <p className="text-lg font-black text-blue-700">{results.length}</p>
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Серија</p>
            <p className="text-lg font-black text-amber-700">{currentStreak}д</p>
          </div>
        </div>
      </div>

      {/* ── Top 3 results ────────────────────────────────────────────────────── */}
      {bestResults.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Најдобри резултати
          </p>
          <div className="space-y-1.5">
            {bestResults.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-700 font-medium truncate mr-2">{r.quizTitle || 'Квиз'}</span>
                <span className={`text-sm font-black tabular-nums shrink-0 ${getScoreColor(r.percentage)}`}>
                  {fmt(r.percentage)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Weak spots ───────────────────────────────────────────────────────── */}
      {weakConceptTitles.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-amber-700 mb-1.5">⚠ Области за дополнителна работа</p>
          <div className="flex flex-wrap gap-1.5">
            {weakConceptTitles.map((t, i) => (
              <span key={i} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── AI narrative excerpt ─────────────────────────────────────────────── */}
      {(narrative || narrativeLoading) && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-violet-600 mb-1.5 flex items-center gap-1">
            ✦ AI проценка
          </p>
          {narrativeLoading && (
            <div className="flex items-center gap-2 text-violet-500 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Генерирам…
            </div>
          )}
          {narrative && (
            <p className="text-xs text-violet-800 leading-relaxed line-clamp-4">{narrative}</p>
          )}
          {narrativeError && (
            <p className="text-xs text-violet-400 italic">AI проценката не е достапна.</p>
          )}
        </div>
      )}
    </div>
  );
};
