/**
 * StudentPortfolioView — Ж7.5
 *
 * Student's personal learning portfolio:
 * 1. Overview KPIs (avg score, mastered concepts, total quizzes, streak)
 * 2. Best quiz performances (top 5 by percentage)
 * 3. Mastered concepts timeline
 * 4. Metacognitive reflections written by the student
 * 5. AI narrative assessment (generated once, cached in state)
 * 6. Print/PDF export
 *
 * Public route — accessible via /#/portfolio?name=...
 * or reads studentName from localStorage.
 *
 * Педагошка основа: Portfolio Assessment (Paulson 1991), Metacognitive reflection
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, BookOpen, BarChart2, Star, Printer,
  TrendingUp, MessageSquare, Loader2, Sparkles, AlertCircle,
  CheckCircle2, User,
} from 'lucide-react';
import { useStudentProgress } from '../hooks/useStudentProgress';
import { geminiService } from '../services/geminiService';
import { calcFibonacciLevel, getAvatar } from '../utils/gamification';
import type { QuizResult, ConceptMastery } from '../services/firestoreService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1).replace('.0', '') : '0';
}

function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function getScoreColor(pct: number): string {
  if (pct >= 85) return 'text-emerald-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function getScoreBg(pct: number): string {
  if (pct >= 85) return 'bg-emerald-50 border-emerald-200';
  if (pct >= 70) return 'bg-blue-50 border-blue-200';
  if (pct >= 50) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

// ── KPI card ─────────────────────────────────────────────────────────────────

const KPICard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; color: string }> = ({ label, value, sub, icon, color }) => (
  <div className={`rounded-2xl border p-4 flex items-center gap-4 ${color}`}>
    <div className="shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const StudentPortfolioView: React.FC = () => {
  // Read name from ?name= query param or localStorage
  const nameFromQuery = useMemo(() => {
    const hash = window.location.hash; // e.g. #/portfolio?name=Јована
    const qi = hash.indexOf('?');
    if (qi < 0) return '';
    const params = new URLSearchParams(hash.slice(qi + 1));
    return params.get('name') || '';
  }, []);

  const [studentName, setStudentName] = useState<string>(() => {
    try { return nameFromQuery || localStorage.getItem('studentName') || ''; } catch { return nameFromQuery; }
  });
  const [nameInput, setNameInput] = useState(studentName);

  const { data, isLoading } = useStudentProgress(studentName);
  const results: QuizResult[] = data?.results || [];
  const mastery: ConceptMastery[] = data?.mastery || [];
  const gamification = data?.gamification ?? null;

  // ── AI narrative ──────────────────────────────────────────────────────────
  const [narrative, setNarrative] = useState<string>('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState(false);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const avgPct = useMemo(() =>
    results.length > 0 ? results.reduce((s, r) => s + r.percentage, 0) / results.length : 0,
  [results]);

  const masteredConcepts = useMemo(() =>
    mastery.filter(m => m.mastered).sort((a, b) => {
      const ta = a.updatedAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.updatedAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    }),
  [mastery]);

  const bestResults = useMemo(() => {
    // Deduplicate: keep best score per conceptId (or quizId if no concept)
    const best = new Map<string, QuizResult>();
    for (const r of results) {
      const key = r.conceptId || r.quizId;
      const existing = best.get(key);
      if (!existing || r.percentage > existing.percentage) {
        best.set(key, r);
      }
    }
    return Array.from(best.values())
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 8);
  }, [results]);

  const metacognitiveNotes = useMemo(() =>
    results
      .filter(r => r.metacognitiveNote && r.metacognitiveNote.trim().length > 10)
      .sort((a, b) => {
        const ta = a.playedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.playedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, 6),
  [results]);

  const topConceptTitles = useMemo(() =>
    masteredConcepts.slice(0, 5).map(m => m.conceptTitle || m.conceptId),
  [masteredConcepts]);

  const weakConceptTitles = useMemo(() => {
    const failed = mastery
      .filter(m => !m.mastered && (m.attempts ?? 0) > 1)
      .sort((a, b) => (a.consecutiveHighScores ?? 0) - (b.consecutiveHighScores ?? 0));
    return failed.slice(0, 3).map(m => m.conceptTitle || m.conceptId);
  }, [mastery]);

  const levelInfo = gamification ? calcFibonacciLevel(gamification.totalXP) : null;
  const level = levelInfo?.level ?? 1;
  const avatar = getAvatar(level);

  // Generate narrative once we have enough data
  useEffect(() => {
    if (!studentName || results.length < 3 || narrative || narrativeLoading) return;
    setNarrativeLoading(true);
    setNarrativeError(false);
    geminiService.generateStudentNarrative(
      studentName,
      masteredConcepts.length,
      avgPct,
      results.length,
      topConceptTitles,
      weakConceptTitles,
      metacognitiveNotes.map(r => r.metacognitiveNote!),
    ).then(text => {
      setNarrative(text);
    }).catch(() => {
      setNarrativeError(true);
    }).finally(() => {
      setNarrativeLoading(false);
    });
  }, [studentName, results.length, masteredConcepts.length]);

  const handlePrint = () => window.print();

  // ── No name → name entry screen ───────────────────────────────────────────
  if (!studentName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <User className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Портфолио</h1>
          <p className="text-gray-500 text-sm mb-6">Внеси го своето ime за да го видиш своето портфолио.</p>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Твоето ime..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim().length >= 2) setStudentName(nameInput.trim()); }}
          />
          <button
            type="button"
            disabled={nameInput.trim().length < 2}
            onClick={() => setStudentName(nameInput.trim())}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            Прикажи портфолио
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (results.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <BookOpen className="w-14 h-14 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-600 mb-2">Нема квиз резултати</h2>
        <p className="text-sm text-gray-400">Реши неколку квизови за да видиш своето портфолио.</p>
        <button
          type="button"
          onClick={() => setStudentName('')}
          className="mt-6 text-xs text-indigo-600 underline"
        >
          Смени ime
        </button>
      </div>
    );
  }

  // ── Full portfolio ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{avatar.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{studentName}</h1>
              <p className="text-sm text-indigo-600 font-medium">Ниво {level} {avatar.title} · Портфолио</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm px-4 py-2 rounded-xl hover:bg-gray-50 transition shadow-sm"
          >
            <Printer className="w-4 h-4" /> Печати / PDF
          </button>
        </div>

        {/* Print header — only visible in print */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Учениково Портфолио</h1>
          <p className="text-lg text-gray-600 mt-1">{studentName}</p>
          <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* ── KPI overview ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Просечен резултат"
            value={`${fmt(avgPct)}%`}
            icon={<BarChart2 className="w-7 h-7 text-indigo-500" />}
            color="bg-indigo-50 border border-indigo-200"
          />
          <KPICard
            label="Совладани концепти"
            value={masteredConcepts.length.toString()}
            sub={`/ ${mastery.length} обработени`}
            icon={<Award className="w-7 h-7 text-emerald-500" />}
            color="bg-emerald-50 border border-emerald-200"
          />
          <KPICard
            label="Вкупно квизови"
            value={results.length.toString()}
            icon={<BookOpen className="w-7 h-7 text-blue-500" />}
            color="bg-blue-50 border border-blue-200"
          />
          <KPICard
            label="Серија (денови)"
            value={(gamification?.currentStreak ?? 0).toString()}
            sub={`Рекорд: ${gamification?.longestStreak ?? 0}`}
            icon={<Star className="w-7 h-7 text-amber-500" />}
            color="bg-amber-50 border border-amber-200"
          />
        </div>

        {/* ── AI Narrative ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="font-bold text-gray-800">AI Оценка на напредокот</h2>
          </div>
          {narrativeLoading && (
            <div className="flex items-center gap-2 text-sm text-indigo-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Генерирање нарација…
            </div>
          )}
          {narrativeError && !narrativeLoading && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              Не можевме да ја генерираме нарацијата. Обиди се повторно подоцна.
            </div>
          )}
          {narrative && (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{narrative}</div>
          )}
          {!narrative && !narrativeLoading && !narrativeError && results.length < 3 && (
            <p className="text-sm text-gray-400">Потребни се барем 3 квиза за AI нарација.</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Best performances ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-gray-800">Најдобри резултати</h2>
            </div>
            <div className="space-y-3">
              {bestResults.map((r, i) => (
                <div
                  key={r.quizId + i}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${getScoreBg(r.percentage)}`}
                >
                  <span className="text-lg font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {r.quizTitle || r.conceptId || 'Квиз'}
                    </p>
                    {r.playedAt && (
                      <p className="text-xs text-gray-400">{formatDate(r.playedAt)}</p>
                    )}
                  </div>
                  <span className={`text-lg font-bold shrink-0 ${getScoreColor(r.percentage)}`}>
                    {r.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Mastered concepts timeline ────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <h2 className="font-bold text-gray-800">Совладани концепти</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                {masteredConcepts.length}
              </span>
            </div>
            {masteredConcepts.length === 0 ? (
              <p className="text-sm text-gray-400">Сè уште нема совладани концепти. Напред!</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {masteredConcepts.map(m => (
                  <div key={m.conceptId} className="flex items-center gap-3">
                    <span className="text-emerald-500 text-base">🏆</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.conceptTitle || m.conceptId}</p>
                      {m.updatedAt && (
                        <p className="text-xs text-gray-400">{formatDate(m.updatedAt)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Metacognitive reflections ──────────────────────────────────────── */}
        {metacognitiveNotes.length > 0 && (
          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-violet-500" />
              <h2 className="font-bold text-gray-800">Мои рефлексии</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                {metacognitiveNotes.length}
              </span>
            </div>
            <div className="space-y-3">
              {metacognitiveNotes.map((r, i) => (
                <div key={r.quizId + i} className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-700 italic">"{r.metacognitiveNote}"</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-violet-500 font-medium">{r.quizTitle || r.conceptId}</span>
                    {r.playedAt && (
                      <span className="text-xs text-gray-400">· {formatDate(r.playedAt)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="text-center text-xs text-gray-300 pb-8 print:hidden">
          Генерирано со Math Curriculum AI Navigator
        </div>

      </div>
    </div>
  );
};
