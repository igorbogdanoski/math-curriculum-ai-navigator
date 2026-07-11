/**
 * S65 P2-B — StudentDashboardView
 *
 * Минимален ученички dashboard на #/student.
 * Покажува:
 *   - Поздрав + XP/streak (gamification)
 *   - Активни задачи (real-time)
 *   - Брзи кратенки кон Matura, Tutor, Portfolio, Play
 *   - Лого-аут
 *
 * Ако нема `studentName` во localStorage → редирект кон #/student/login.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  Loader2, LogOut, Trophy, Flame, Star, BookOpen, Target,
  Sparkles, ClipboardList, ChevronRight, GraduationCap, RefreshCw, ScrollText, Brain,
  Share2, Copy, CheckCircle2, FileText, TrendingUp,
} from 'lucide-react';
import { auth } from '../firebaseConfig';
import { useNavigation } from '../contexts/NavigationContext';
import { useStudentProgress } from '../hooks/useStudentProgress';
import { aggregateCognitiveProfile } from '../hooks/useStudentCognitiveProfile';
import { useStudentRealtime } from '../hooks/useStudentRealtime';
import { fetchStudentDuggaSubmissionsByName } from '../services/firestoreService.dugga';
import type { DuggaSubmission } from '../services/firestoreService.dugga';
import { useTour } from '../hooks/useTour';
import { studentTourSteps } from '../tours/student-tour-steps';

interface QuickLink {
  href: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  bg: string;
  iconBg: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    href: '#/my-progress',
    label: 'Мој напредок',
    desc: 'Резултати, мастери, графикони',
    icon: <Target className="w-5 h-5" />,
    bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  {
    href: '#/matura-portal',
    label: 'Матура портал',
    desc: 'Вежби, симулации, мисии',
    icon: <GraduationCap className="w-5 h-5" />,
    bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-600',
  },
  {
    href: '#/tutor',
    label: 'AI Тутор',
    desc: 'Постави прашање, добиј помош',
    icon: <Sparkles className="w-5 h-5" />,
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    iconBg: 'bg-purple-100 text-purple-600',
  },
  {
    href: '#/portfolio',
    label: 'Портфолио',
    desc: 'Твоите достигнувања',
    icon: <BookOpen className="w-5 h-5" />,
    bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  {
    href: '#/dugga/play',
    label: 'Внеси код за тест (Дуга)',
    desc: 'Запиши го кодот од наставникот',
    icon: <ScrollText className="w-5 h-5" />,
    bg: 'bg-rose-50 hover:bg-rose-100 border-rose-200',
    iconBg: 'bg-rose-100 text-rose-600',
  },
  {
    href: '#/student/srs',
    label: 'Мои повторувања (SM-2)',
    desc: 'Концепти за обнова денес',
    icon: <Brain className="w-5 h-5" />,
    bg: 'bg-violet-50 hover:bg-violet-100 border-violet-200',
    iconBg: 'bg-violet-100 text-violet-600',
  },
];

const formatDate = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
};

export const StudentDashboardView: React.FC = () => {
  const { navigate } = useNavigation();

  const [studentName, setStudentName] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });

  useEffect(() => {
    if (!studentName.trim()) {
      navigate('/student/login');
    }
  }, [studentName, navigate]);

  useTour('student-intro', studentTourSteps, !!studentName.trim());

  const { data, isLoading, error, refetch, isRefetching } = useStudentProgress(studentName, false);
  const { announcements, assignments } = useStudentRealtime(
    data?.teacherUid,
    studentName,
    data?.announcements,
    data?.assignments,
  );

  const xp = data?.gamification?.totalXP ?? 0;
  const streak = data?.gamification?.currentStreak ?? 0;
  const level = useMemo(() => Math.floor(Math.sqrt(xp / 50)) + 1, [xp]);

  const cognitiveProfile = useMemo(() => {
    if (!data?.results?.length && !data?.mastery?.length) return null;
    return aggregateCognitiveProfile(studentName, data?.mastery ?? [], data?.results ?? []);
  }, [data?.mastery, data?.results, studentName]);

  const pendingAssignments = useMemo(
    () => (assignments ?? [])
      .filter(a => !(a.completedBy ?? []).includes(studentName.trim()))
      .slice(0, 5),
    [assignments, studentName],
  );

  // ── Dugga recent results ─────────────────────────────────────────────────
  const [duggaSubs, setDuggaSubs] = useState<DuggaSubmission[]>([]);
  useEffect(() => {
    if (!studentName.trim()) return;
    fetchStudentDuggaSubmissionsByName(studentName).then(subs => setDuggaSubs(subs.slice(0, 5))).catch(() => {});
  }, [studentName]);

  const [parentLinkCopied, setParentLinkCopied] = useState(false);

  const parentShareUrl = useMemo(() => {
    if (!studentName.trim()) return '';
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return `${origin}/#/portfolio?name=${encodeURIComponent(studentName.trim())}`;
    } catch {
      return `#/portfolio?name=${encodeURIComponent(studentName.trim())}`;
    }
  }, [studentName]);

  const handleCopyParentLink = async () => {
    if (!parentShareUrl) return;
    try {
      await navigator.clipboard.writeText(parentShareUrl);
      setParentLinkCopied(true);
      setTimeout(() => setParentLinkCopied(false), 2500);
    } catch { /* clipboard blocked */ }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch { /* ignore */ }
    try {
      localStorage.removeItem('studentName');
      localStorage.removeItem('student_google_uid');
      localStorage.removeItem('student_class_id');
    } catch { /* incognito */ }
    setStudentName('');
    navigate('/student/login');
  };

  if (!studentName.trim()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-gray-500">Здраво,</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{studentName} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Освежи
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <LogOut className="w-4 h-4" />
            Одјави се
          </button>
        </div>
      </div>

      {/* Gamification stats */}
      <div data-tour="student-stats" className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <Star className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">XP</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{xp}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-orange-700">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Streak</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{streak} <span className="text-sm font-normal text-gray-500">дена</span></div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Ниво</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{level}</div>
        </div>
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Се вчитуваат податоци…
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Грешка при вчитување: {error.message}
        </div>
      )}

      {/* Assignments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            Активни задачи
          </h2>
          {pendingAssignments.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              {pendingAssignments.length}
            </span>
          )}
        </div>
        {pendingAssignments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-sm text-gray-500">
            🎉 Нема активни задачи. Уживај во вежбата!
          </div>
        ) : (
          <div className="space-y-2">
            {pendingAssignments.map((a) => {
              const href = a.materialType === 'DUGGA' && a.duggaExamId
                ? `#/dugga/play?examId=${a.duggaExamId}&assignmentId=${a.id}`
                : a.cacheId
                  ? `#/play/${a.cacheId}`
                  : '#/my-progress';
              return (
                <a
                  key={a.id}
                  href={href}
                  className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 truncate">{a.title || 'Задача'}</p>
                      {a.materialType === 'DUGGA' && (
                        <span className="flex-shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">Dugga</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Доделена: {formatDate(a.createdAt)}
                      {a.dueDate ? ` · Рок: ${formatDate(a.dueDate)}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Dugga results */}
      {duggaSubs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-500" />
              Последни Дуга тестови
            </h2>
            <a href="#/portfolio" className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1">
              Виж сите <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="space-y-2">
            {duggaSubs.map(sub => {
              const pct = Math.round(sub.percentage ?? (sub.totalPoints > 0 ? (sub.score / sub.totalPoints) * 100 : 0));
              const color = pct >= 85 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                : pct >= 70 ? 'text-blue-600 bg-blue-50 border-blue-200'
                : pct >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200'
                : 'text-red-600 bg-red-50 border-red-200';
              const grade = pct >= 90 ? '5' : pct >= 75 ? '4' : pct >= 60 ? '3' : pct >= 50 ? '2' : '1';
              return (
                <div key={sub.id} className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg border ${color} flex-shrink-0`}>
                    {grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{sub.testTitle}</p>
                    <p className="text-xs text-gray-500">
                      {sub.score}/{sub.totalPoints} бода · {pct}%
                      {sub.submittedAt && ` · ${formatDate(sub.submittedAt)}`}
                    </p>
                  </div>
                  <TrendingUp className={`w-4 h-4 flex-shrink-0 ${pct >= 60 ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Известувања од наставникот
          </h2>
          <div className="space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <div key={a.id} className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-sm text-gray-800">{a.message}</p>
                <p className="text-xs text-purple-600 mt-1">{formatDate(a.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section data-tour="student-quick-links">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Брзи кратенки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map((q) => (
            <a
              key={q.href}
              href={q.href}
              className={`group flex items-center gap-3 p-4 rounded-2xl border transition-colors ${q.bg}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${q.iconBg}`}>
                {q.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{q.label}</p>
                <p className="text-xs text-gray-600">{q.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
            </a>
          ))}
        </div>
      </section>

      {/* Cognitive Map */}
      {cognitiveProfile && (
        <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-500" />
            <h3 className="font-semibold text-gray-800 text-sm">Мојата когнитивна карта</h3>
            <span className="ml-auto text-xs text-gray-400">{cognitiveProfile.overallMasteryPct}% совладано</span>
          </div>
          {/* Overall progress bar */}
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-700"
              style={{ width: `${cognitiveProfile.overallMasteryPct}%` }}
            />
          </div>
          {/* Strong / Weak topics */}
          <div className="grid grid-cols-2 gap-3">
            {cognitiveProfile.strongTopics.length > 0 && (
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wide mb-1.5">💪 Јаки страни</p>
                <ul className="space-y-0.5">
                  {cognitiveProfile.strongTopics.slice(0, 3).map(t => (
                    <li key={t} className="text-xs text-emerald-800 truncate">• {t}</li>
                  ))}
                </ul>
              </div>
            )}
            {cognitiveProfile.weakTopics.length > 0 && (
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-[11px] font-black text-red-500 uppercase tracking-wide mb-1.5">📌 Треба работа</p>
                <ul className="space-y-0.5">
                  {cognitiveProfile.weakTopics.slice(0, 3).map(t => (
                    <li key={t} className="text-xs text-red-700 truncate">• {t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {/* DoK distribution */}
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Ниво на мислење (DoK)</p>
            <div className="flex gap-1 h-5">
              {([1, 2, 3, 4] as const).map(d => {
                const total = Object.values(cognitiveProfile.dokDistribution).reduce((s, v) => s + v, 0) || 1;
                const pct = Math.round((cognitiveProfile.dokDistribution[d] / total) * 100);
                const colors = ['bg-sky-300', 'bg-blue-400', 'bg-indigo-500', 'bg-violet-600'];
                return pct > 0 ? (
                  <div key={d} title={`DoK ${d}: ${pct}%`} className={`h-full rounded ${colors[d - 1]} flex items-center justify-center text-[9px] font-bold text-white`} style={{ width: `${pct}%` }}>
                    {pct >= 12 ? `${d}` : ''}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </section>
      )}

      {/* Share with parent */}
      <section className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Сподели со родител</h3>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Линкот овозможува read-only преглед на твојот неделен напредок (без најава).
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={parentShareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 truncate"
          />
          <button
            type="button"
            onClick={handleCopyParentLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all flex-shrink-0"
          >
            {parentLinkCopied
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Копирано!</>
              : <><Copy className="w-3.5 h-3.5" /> Копирај</>}
          </button>
        </div>
      </section>
    </div>
  );
};

export default StudentDashboardView;
