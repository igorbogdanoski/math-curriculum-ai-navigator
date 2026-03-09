import React, { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { requestNotificationPermission, sendLocalPushNotification } from '../services/pushService';
import { StudentProgressView } from './StudentProgressView';
import { BookOpen, Loader2, BarChart2, CheckCircle2, Flame, Star, ExternalLink, AlertTriangle, Home } from 'lucide-react';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebaseConfig';

interface WeeklySummary {
  studentName: string;
  quizzesThisWeek: number;
  avgPct: number;
  masteredThisWeek: number;
  currentStreak: number;
  recentResults: QuizResult[];
  weakConcepts: { title: string; avgPct: number }[];
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Mon-based
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * П23 — Родителски Портал
 * Ако URL содржи ?name=... → директно покажи ги резултатите (read-only).
 * Ако нема → покажи форма за внесување на името на ученикот.
 * Public route — нема потреба од автентикација.
 */
export const ParentPortalView: React.FC = () => {
  const hashSearch = window.location.hash.includes('?')
    ? window.location.hash.split('?')[1]
    : '';
  const params = new URLSearchParams(hashSearch);
  const nameFromUrl = params.get('name');

  const [nameInput, setNameInput] = useState('');
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  if (nameFromUrl) {
    return <StudentProgressView name={decodeURIComponent(nameFromUrl)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    setLoadingSummary(true);
    setSummaryError('');
    setSummary(null);

    try {
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch { /* non-fatal */ }
      }
      const weekStart = getWeekStart();
      const [results, masteryData, gamification] = await Promise.all([
        firestoreService.fetchQuizResultsByStudentName(trimmed),
        firestoreService.fetchMasteryByStudent(trimmed),
        firestoreService.fetchStudentGamification(trimmed),
      ]);

      const weekResults = results.filter(r => {
        if (!r.playedAt) return false;
        const d = ('toDate' in (r.playedAt as any))
          ? (r.playedAt as any).toDate()
          : new Date(r.playedAt as any);
        return d >= weekStart;
      });

      const masteredThisWeek = masteryData.filter(m => {
        if (!m.mastered || !m.masteredAt) return false;
        const d = ('toDate' in (m.masteredAt as any))
          ? (m.masteredAt as any).toDate()
          : new Date(m.masteredAt as any);
        return d >= weekStart;
      }).length;

      const avgPct = weekResults.length > 0
        ? Math.round(weekResults.reduce((s, r) => s + r.percentage, 0) / weekResults.length)
        : 0;

      // Last 5 quiz results (most recent first)
      const recentResults = results.slice(0, 5);

      // Concepts with avg < 60% (from all mastery data, not mastered)
      const conceptMap: Record<string, { sum: number; count: number; title: string }> = {};
      results.filter(r => r.conceptId && r.quizTitle).forEach(r => {
        const key = r.conceptId!;
        if (!conceptMap[key]) conceptMap[key] = { sum: 0, count: 0, title: r.quizTitle };
        conceptMap[key].sum += r.percentage;
        conceptMap[key].count++;
      });
      const weakConcepts = Object.entries(conceptMap)
        .map(([, v]) => ({ title: v.title, avgPct: Math.round(v.sum / v.count) }))
        .filter(c => c.avgPct < 60)
        .sort((a, b) => a.avgPct - b.avgPct)
        .slice(0, 3);

      setSummary({
        studentName: trimmed,
        quizzesThisWeek: weekResults.length,
        avgPct,
        masteredThisWeek,
        currentStreak: gamification?.currentStreak ?? 0,
        recentResults,
        weakConcepts,
      });
    } catch {
      setSummaryError('Не можевме да ги вчитаме податоците. Проверете го името и обидете се повторно.');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 text-center">Родителски портал</h1>
            <p className="text-gray-500 text-center mt-2 text-sm">
              Следете го напредокот на вашето дете во математика
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Внесете го името на ученикот
              </label>
              <input
                id="student-name"
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="На пр. Марија Петрова"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!nameInput.trim() || loadingSummary}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {loadingSummary ? <><Loader2 className="w-4 h-4 animate-spin" /> Вчитувам...</> : 'Прикажи неделен преглед →'}
            </button>
          </form>

          {/* Hint */}
          <p className="text-center text-xs text-gray-400 mt-6">
            или скенирајте QR код добиен од наставникот
          </p>
        </div>

        {/* Error */}
        {summaryError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 text-center">
            {summaryError}
          </div>
        )}

        {/* E5.1 — Weekly Digest Card */}
        {summary && (
          <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-black text-gray-800">
                Неделен преглед — {summary.studentName}
              </h2>
            </div>
            <p className="text-xs text-gray-400 -mt-2">Оваа недела (понеделник → денес)</p>

            {summary.quizzesThisWeek === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">
                Нема активност оваа недела. Поттикнете го детето да вежба!
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-indigo-600">{summary.quizzesThisWeek}</p>
                  <p className="text-xs text-indigo-500 font-semibold">квизови</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${summary.avgPct >= 70 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className={`text-2xl font-black ${summary.avgPct >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{summary.avgPct}%</p>
                  <p className={`text-xs font-semibold ${summary.avgPct >= 70 ? 'text-green-500' : 'text-amber-500'}`}>просечен резултат</p>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-center flex flex-col items-center">
                  <CheckCircle2 className="w-5 h-5 text-teal-500 mb-0.5" />
                  <p className="text-xl font-black text-teal-600">{summary.masteredThisWeek}</p>
                  <p className="text-xs text-teal-500 font-semibold">совладани концепти</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center flex flex-col items-center">
                  <Flame className="w-5 h-5 text-orange-500 mb-0.5" />
                  <p className="text-xl font-black text-orange-600">{summary.currentStreak}</p>
                  <p className="text-xs text-orange-500 font-semibold">{summary.currentStreak === 1 ? 'ден' : 'дена'} по ред</p>
                </div>
              </div>
            )}

            {/* Summary message */}
            <div className={`text-xs rounded-xl px-3 py-2 ${
              summary.quizzesThisWeek === 0
                ? 'bg-gray-50 text-gray-500'
                : summary.avgPct >= 80
                  ? 'bg-green-50 text-green-700'
                  : summary.avgPct >= 60
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-amber-50 text-amber-700'
            }`}>
              <Star className="w-3 h-3 inline mr-1" />
              {summary.quizzesThisWeek === 0
                ? 'Нема активност оваа недела — поттикнете го детето да вежба дома!'
                : summary.avgPct >= 80
                  ? 'Одлично! Вашето дете постигна одлични резултати оваа недела.'
                  : summary.avgPct >= 60
                    ? 'Добар напредок! Продолжете со редовна вежба.'
                    : 'Детето треба малку помош. Разговарајте со наставникот за подршка.'}
            </div>

            {/* Recent quiz results */}
            {summary.recentResults.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-2">Последни квизови</p>
                <div className="space-y-1.5">
                  {summary.recentResults.map((r, i) => {
                    const d = r.playedAt && ('toDate' in (r.playedAt as any))
                      ? (r.playedAt as any).toDate()
                      : r.playedAt ? new Date(r.playedAt as any) : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 truncate max-w-[180px]">{r.quizTitle}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {d && <span className="text-gray-400">{d.toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit' })}</span>}
                          <span className={`font-bold px-1.5 py-0.5 rounded-md ${r.percentage >= 70 ? 'bg-green-100 text-green-700' : r.percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {Math.round(r.percentage)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Weak concepts */}
            {summary.weakConcepts.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-xs font-bold text-amber-700">Теми кои бараат внимание</p>
                </div>
                <div className="space-y-1">
                  {summary.weakConcepts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-amber-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-amber-800 font-medium">{c.title}</span>
                      <span className="text-amber-600 font-bold">{c.avgPct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Home support recommendation */}
            <div className="pt-2 border-t border-gray-100">
              <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 ${
                summary.avgPct >= 80 ? 'bg-green-50' : summary.avgPct >= 60 ? 'bg-blue-50' : 'bg-amber-50'
              }`}>
                <Home className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                  summary.avgPct >= 80 ? 'text-green-600' : summary.avgPct >= 60 ? 'text-blue-600' : 'text-amber-600'
                }`} />
                <p className={summary.avgPct >= 80 ? 'text-green-800' : summary.avgPct >= 60 ? 'text-blue-800' : 'text-amber-800'}>
                  {summary.avgPct >= 80
                    ? 'Вашето дете постигнува одлични резултати! Поттикнете го да пробува потешки задачи и да ги објасни концептите на гласно — тоа го зајакнува знаењето.'
                    : summary.avgPct >= 60
                      ? 'Добар напредок! Посветете 10–15 мин дневно на вежби. Прашајте го детето да ви ги објасни задачите кои ги решило — разговорот помага.'
                      : 'Детето има тешкотии со одредени теми. Контактирајте го наставникот за дополнителна поддршка и вежбајте заедно дома со задачи прилагодени на неговото ниво.'}
                </p>
              </div>
            </div>

            {/* Full report link */}
            <button
              type="button"
              onClick={() => { window.location.hash = `/parent?name=${encodeURIComponent(summary.studentName)}`; }}
              className="w-full py-2.5 border-2 border-indigo-200 text-indigo-600 rounded-xl font-semibold text-sm hover:bg-indigo-50 transition flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Целосен извештај →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
