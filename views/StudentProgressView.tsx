import React, { useEffect, useState, useMemo } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery, type StudentGamification, type Announcement, type Assignment, ACHIEVEMENTS } from '../services/firestoreService';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { ICONS } from '../constants';
import {
  Loader2, User, Star, BookOpen, Home, BarChart2, CheckCircle2, XCircle,
  Calendar, RefreshCw, Trophy, Flame, PlayCircle, Printer, AlertTriangle, RotateCcw, Target,
} from 'lucide-react';
import { useCurriculum } from '../hooks/useCurriculum';
import { GradeBadge } from '../components/common/GradeBadge';
import { LogicMap } from '../components/LogicMap';
import { geminiService } from '../services/geminiService';

const formatDate = (ts: any): string => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  /** Passed from URL query param ?name=... — enables read-only parent view */
  name?: string;
}

export const StudentProgressView: React.FC<Props> = ({ name: nameProp }) => {
  const isReadOnly = !!nameProp;
  const { getConceptChain, getConceptDetails, allConcepts } = useCurriculum();

  const [studentName, setStudentName] = useState<string>(() => {
    try { return nameProp || localStorage.getItem('studentName') || ''; } catch { return nameProp || ''; }
  });
  const [nameInput, setNameInput] = useState<string>(() => {
    try { return nameProp || localStorage.getItem('studentName') || ''; } catch { return nameProp || ''; }
  });
  const [results, setResults] = useState<QuizResult[]>([]);
  const [masteryRecords, setMasteryRecords] = useState<ConceptMastery[]>([]);
  // conceptId → quizId for "play again" self-navigation
  const [nextQuizIds, setNextQuizIds] = useState<Record<string, string>>({});
  const [gamification, setGamification] = useState<StudentGamification | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'map'>('map');
  const [reportPeriod, setReportPeriod] = useState<'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH'>('THIS_WEEK');
  // П27 — Teacher announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // П28 — AI Concept Explainer
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);
  // Б2 — Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const handleExplain = async (conceptId: string, title: string, grade?: number) => {
    if (explanations[conceptId] || loadingExplanation === conceptId) return;
    setLoadingExplanation(conceptId);
    const text = await geminiService.explainConcept(title, grade);
    setExplanations(prev => ({ ...prev, [conceptId]: text || 'Не можев да генерирам објаснување.' }));
    setLoadingExplanation(null);
  };

  const fetchResults = async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setSearched(true);
    // А1: Ensure anonymous Firebase Auth session so security rules pass.
    if (!auth.currentUser) {
      try { await signInAnonymously(auth); } catch { /* non-fatal */ }
    }
    try {
      const [quizData, masteryData] = await Promise.all([
        firestoreService.fetchQuizResultsByStudentName(name.trim()),
        firestoreService.fetchMasteryByStudent(name.trim()),
      ]);
      setResults(quizData);
      setMasteryRecords(masteryData);

      // Derive primary teacherUid from most frequent teacher in quiz results
      const teacherUidCounts: Record<string, number> = {};
      quizData.forEach(r => { if (r.teacherUid) teacherUidCounts[r.teacherUid] = (teacherUidCounts[r.teacherUid] ?? 0) + 1; });
      const topTeacherUid = Object.entries(teacherUidCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

      // А1: Fetch gamification with teacherUid scope (prevents name collisions across classes)
      const gamificationData = await firestoreService.fetchStudentGamification(name.trim(), topTeacherUid);
      setGamification(gamificationData);

      // П27 — Load announcements for the most frequent teacherUid in results
      if (topTeacherUid) {
        firestoreService.fetchAnnouncements(topTeacherUid, 3).then(setAnnouncements);
      }

      // Б2 — Load assignments for this student
      firestoreService.fetchAssignmentsByStudent(name.trim()).then(setAssignments);

      // Pre-fetch quiz links for failed concepts (self-navigation)
      const failedConceptIds = Array.from(
        new Set(quizData.filter(r => r.percentage < 70 && r.conceptId).map(r => r.conceptId!))
      );
      if (failedConceptIds.length > 0) {
        const quizLookups = await Promise.all(
          failedConceptIds.map(cid =>
            firestoreService.fetchLatestQuizByConcept(cid).then(q => ({ cid, id: q?.id }))
          )
        );
        const map: Record<string, string> = {};
        quizLookups.forEach(({ cid, id }) => { if (id) map[cid] = id; });
        setNextQuizIds(map);
      }
    } catch (err) {
      console.error('[StudentProgress] fetchResults failed:', err);
      setResults([]);
      setMasteryRecords([]);
      // Show inline error — visible without toast since this is a public/student page
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount if name is known
  useEffect(() => {
    if (studentName) {
      fetchResults(studentName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (!isReadOnly) localStorage.setItem('studentName', trimmed);
    setStudentName(trimmed);
    fetchResults(trimmed);
  };

  const totalQuizzes = results.length;
  const passed = results.filter(r => r.percentage >= 70).length;
  const avgPct = totalQuizzes > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalQuizzes)
    : 0;

  const masteredCount = masteryRecords.filter(m => m.mastered).length;
  const inProgressCount = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0).length;

  // ── Правец 13: Prerequisite Gap Analysis ─────────────────────────────────
  const prereqGaps = useMemo(() => {
    if (masteryRecords.length === 0) return [];
    const masteredIds = new Set(masteryRecords.filter(m => m.mastered).map(m => m.conceptId));
    return masteryRecords
      .filter(m => !m.mastered && m.attempts > 0)
      .flatMap(m => {
        const { priors } = getConceptChain(m.conceptId);
        const missing = priors.filter(p => !masteredIds.has(p.concept.id));
        return missing.length > 0
          ? [{ conceptTitle: m.conceptTitle || m.conceptId, missing: missing.map(p => p.concept.title) }]
          : [];
      });
  }, [masteryRecords, getConceptChain]);

  // ── Правец 14: Spaced Repetition ─────────────────────────────────────────
  const reviewToday = useMemo(() => {
    const now = Date.now();
    return masteryRecords.filter(m => {
      if (!m.updatedAt) return false;
      const lastMs = (m.updatedAt.toDate ? m.updatedAt.toDate() : new Date(m.updatedAt)).getTime();
      const daysSince = (now - lastMs) / 86_400_000;
      return m.mastered ? daysSince > 30 : (daysSince > 7 && m.attempts > 0);
    });
  }, [masteryRecords]);

  // ── Правец 21: Персонализирана патека „Следни чекори" ────────────────────
  const nextUpConcepts = useMemo(() => {
    if (!allConcepts || allConcepts.length === 0 || masteryRecords.length === 0) return [];
    const masteredIds = new Set(masteryRecords.filter(m => m.mastered).map(m => m.conceptId));
    const attemptedIds = new Set(masteryRecords.map(m => m.conceptId));
    const ready = allConcepts.filter(c => {
      if (masteredIds.has(c.id)) return false;
      const prereqs: string[] = c.priorKnowledgeIds || [];
      if (prereqs.length === 0) return attemptedIds.has(c.id); // foundational: only if student has tried it
      return prereqs.every(pid => masteredIds.has(pid));       // chained: all prereqs mastered
    });
    return ready
      .map(c => {
        const mastery = masteryRecords.find(m => m.conceptId === c.id);
        const { grade } = getConceptDetails(c.id);
        return { concept: c, mastery, grade };
      })
      .sort((a, b) => (b.mastery?.consecutiveHighScores ?? -1) - (a.mastery?.consecutiveHighScores ?? -1))
      .slice(0, 6);
  }, [allConcepts, masteryRecords, getConceptDetails]);

  // ── Правец 16: Period report data ─────────────────────────────────────────
  const { periodLabel, periodQuizzes, periodStats } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    let label: string;
    if (reportPeriod === 'THIS_WEEK') {
      start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      label = 'Оваа недела';
    } else if (reportPeriod === 'LAST_WEEK') {
      start = new Date(now); start.setDate(now.getDate() - now.getDay() - 7); start.setHours(0, 0, 0, 0);
      end = new Date(start); end.setDate(start.getDate() + 7);
      label = 'Минатата недела';
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = now.toLocaleDateString('mk-MK', { month: 'long', year: 'numeric' });
    }
    const pq = results.filter(r => {
      if (!r.playedAt) return false;
      const d = r.playedAt.toDate ? r.playedAt.toDate() : new Date(r.playedAt);
      return d >= start && d <= end;
    });
    const total = pq.length;
    const avg = total > 0 ? Math.round(pq.reduce((s, r) => s + r.percentage, 0) / total) : 0;
    const passedCount = pq.filter(r => r.percentage >= 70).length;
    const newlyMastered = masteryRecords.filter(m => {
      if (!m.mastered || !m.masteredAt) return false;
      const d = m.masteredAt.toDate ? m.masteredAt.toDate() : new Date(m.masteredAt);
      return d >= start && d <= end;
    }).length;
    return { periodLabel: label, periodQuizzes: pq, periodStats: { total, avg, passed: passedCount, newlyMastered } };
  }, [results, masteryRecords, reportPeriod]);

  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter uppercase">
              {isReadOnly ? 'Прогрес на Ученик' : 'Мој Прогрес'}
            </h1>
            {isReadOnly && (
              <p className="text-white/60 text-xs font-semibold">Приказ за родители — само за читање</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {searched && totalQuizzes > 0 && (
            <div className="flex items-center gap-2 no-print">
              <select
                value={reportPeriod}
                onChange={e => setReportPeriod(e.target.value as 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH')}
                aria-label="Избери период за извештај"
                className="text-xs font-bold bg-white/10 border border-white/20 text-white px-3 py-2 rounded-full cursor-pointer"
              >
                <option value="THIS_WEEK" className="text-slate-800 bg-white">Оваа недела</option>
                <option value="LAST_WEEK" className="text-slate-800 bg-white">Минатата недела</option>
                <option value="THIS_MONTH" className="text-slate-800 bg-white">Овој месец</option>
              </select>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition"
              >
                <Printer className="w-4 h-4" /> Печати извештај
              </button>
            </div>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => { window.location.hash = '/'; }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition no-print"
            >
              <Home className="w-4 h-4" /> Почетна
            </button>
          )}
        </div>
      </div>

      {/* Search card — hidden in read-only (parent) mode */}
      {!isReadOnly && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-black text-slate-800">Внеси го твоето ime</p>
              <p className="text-xs text-slate-400">Ги гледаш само твоите резултати</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ime и презиме..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-indigo-400 transition"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!nameInput.trim() || loading}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Прикажи
            </button>
          </div>
        </div>
      )}

      {/* Parent read-only header */}
      {isReadOnly && (
        <div className="w-full max-w-2xl bg-white/10 border border-white/20 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <User className="w-5 h-5 text-white/70 flex-shrink-0" />
          <p className="text-white font-bold">{studentName}</p>
        </div>
      )}

      {/* Stats summary */}
      {searched && !loading && totalQuizzes > 0 && (
        <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <BarChart2 className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-800">{totalQuizzes}</p>
            <p className="text-xs text-slate-500 font-semibold">Квизови</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-800">{passed}</p>
            <p className="text-xs text-slate-500 font-semibold">Положени</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{avgPct}%</p>
            <p className="text-xs text-slate-500 font-semibold">Просек</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{masteredCount}</p>
            <p className="text-xs text-slate-500 font-semibold">Совладани</p>
          </div>
        </div>
      )}

      {/* TABS */}
      {searched && !loading && (
        <div className="w-full max-w-2xl flex gap-2 mb-6 bg-white/20 p-1.5 rounded-2xl no-print">
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold text-sm rounded-xl transition ${activeTab === 'map' ? 'bg-white text-indigo-700 shadow' : 'text-white hover:bg-white/10'}`}
          >
            <Target className="w-4 h-4" /> Мапа на Знаење
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold text-sm rounded-xl transition ${activeTab === 'activity' ? 'bg-white text-indigo-700 shadow' : 'text-white hover:bg-white/10'}`}
          >
            <BarChart2 className="w-4 h-4" /> Активност и Резултати
          </button>
        </div>
      )}

      {searched && !loading && activeTab === 'map' && (
        <div className="w-full max-w-2xl no-print mb-8">
          <LogicMap masteryRecords={masteryRecords} />
        </div>
      )}

      {searched && !loading && activeTab === 'activity' && (
        <>

      {/* ── Правец 15: Gamification — XP + Streak + Achievements ──────────── */}
      {gamification && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-white rounded-2xl shadow p-4">
            {/* XP bar + streak */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <p className="font-black text-slate-800 text-sm">{gamification.totalXP} XP</p>
                  <p className="text-xs text-slate-400">вкупно поени</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div className="text-right">
                  <p className="font-black text-slate-800 text-sm">{gamification.currentStreak} {gamification.currentStreak === 1 ? 'ден' : 'дена'}</p>
                  <p className="text-xs text-slate-400">тековен стрик</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-600 text-sm">{gamification.totalQuizzes} квизови</p>
                <p className="text-xs text-slate-400">решени вкупно</p>
              </div>
            </div>
            {/* Achievements */}
            {gamification.achievements.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Достигнувања</p>
                <div className="flex flex-wrap gap-1.5">
                  {gamification.achievements.map(id => {
                    const a = ACHIEVEMENTS[id];
                    return a ? (
                      <span key={id} title={a.label} className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full">
                        {a.icon} {a.label}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Правец 14: Повтори денес (Spaced Repetition) ───────────────────── */}
      {searched && !loading && reviewToday.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              <p className="font-bold text-blue-800 text-sm">Повтори денес</p>
              <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold">{reviewToday.length}</span>
            </div>
            <p className="text-xs text-blue-600 mb-3">Овие концепти не сте ги вежбале долго — освежете го знаењето!</p>
            <div className="space-y-2">
              {reviewToday.map(m => {
                const nextId = nextQuizIds[m.conceptId];
                return (
                  <div key={m.conceptId} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{m.conceptTitle || m.conceptId}</p>
                      <p className="text-xs text-slate-400">
                        {m.mastered ? 'Совладан — освежи по 30+ дена' : `${m.consecutiveHighScores}/3 по ред — вежбај повторно`}
                      </p>
                    </div>
                    {nextId && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${nextId}`; }}
                        className="flex items-center gap-1 text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition flex-shrink-0"
                      >
                        <PlayCircle className="w-3 h-3" /> Вежбај
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Правец 13: Prerequisite Gap Analysis ───────────────────────────── */}
      {searched && !loading && prereqGaps.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <p className="font-bold text-orange-800 text-sm">Пропуштени предуслови</p>
              <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 text-xs font-bold">{prereqGaps.length}</span>
            </div>
            <p className="text-xs text-orange-600 mb-3">Овие концепти зависат од претходни теми кои сè уште не се совладани:</p>
            <div className="space-y-3">
              {prereqGaps.map((gap, i) => (
                <div key={i} className="bg-white rounded-xl px-3 py-2.5">
                  <p className="text-sm font-bold text-orange-900 mb-1">{gap.conceptTitle}</p>
                  <p className="text-xs text-slate-500 mb-1">Прво совладај:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gap.missing.map((pre, j) => (
                      <span key={j} className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {pre}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Правец 21: Следни чекори (Learning Path) ────────────────────────── */}
      {searched && !loading && nextUpConcepts.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-teal-600" />
              <p className="font-bold text-teal-800 text-sm">🎯 Следни чекори</p>
              <span className="px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 text-xs font-bold">{nextUpConcepts.length}</span>
            </div>
            <p className="text-xs text-teal-600 mb-3">Концепти за кои сте подготвени — сите предуслови се совладани!</p>
            <div className="space-y-2">
              {nextUpConcepts.map(({ concept, mastery, grade }) => (
                <div key={concept.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-teal-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{concept.title}</p>
                    <p className="text-xs text-slate-400">
                      {grade ? `${grade.level}. одделение` : ''}
                      {mastery ? ` · ${mastery.consecutiveHighScores}/3 по ред` : ' · Ново'}
                    </p>
                  </div>
                  {mastery && mastery.consecutiveHighScores > 0 && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`w-2 h-5 rounded-sm ${i < mastery.consecutiveHighScores ? 'bg-teal-500' : 'bg-teal-100'}`} />
                      ))}
                    </div>
                  )}
                  {nextQuizIds[concept.id] ? (
                    <button
                      type="button"
                      onClick={() => { window.location.hash = `/play/${nextQuizIds[concept.id]}`; }}
                      className="flex-shrink-0 text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-lg transition"
                    >
                      Вежбај →
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-xs text-teal-400 font-semibold px-2">Побарај квиз</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mastery section */}
      {searched && !loading && masteryRecords.length > 0 && (
        <div className="w-full max-w-2xl mb-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-500" fill="currentColor" />
              <p className="font-bold text-slate-800 text-sm">Совладување на концепти</p>
            </div>
            <div className="space-y-2">
              {masteryRecords
                .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0) || b.consecutiveHighScores - a.consecutiveHighScores)
                .map((m) => {
                  const db = m.lastScore === undefined ? null
                    : m.lastScore < 60  ? { label: '🔵 Поддршка',    cls: 'text-blue-700 bg-blue-50 border-blue-100' }
                    : m.lastScore < 85  ? { label: '⚪ Основно',      cls: 'text-slate-600 bg-slate-100 border-slate-200' }
                    :                    { label: '🔴 Збогатување',   cls: 'text-red-700 bg-red-50 border-red-100' };
                  const { grade } = getConceptDetails(m.conceptId);
                  const conceptGrade = (grade as any)?.level ?? m.gradeLevel;
                  const conceptTitle = m.conceptTitle || m.conceptId;
                  return (
                  <div key={m.conceptId} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.mastered ? 'bg-yellow-100' : 'bg-blue-50'}`}>
                        {m.mastered
                          ? <Trophy className="w-4 h-4 text-yellow-500" fill="currentColor" />
                          : <Flame className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{conceptTitle}</p>
                        <p className="text-xs text-slate-400">
                          {m.mastered
                            ? `Совладан! Најдобар резултат: ${m.bestScore}%`
                            : `${m.consecutiveHighScores}/3 по ред ≥85% — Последен: ${m.lastScore}%`}
                        </p>
                      </div>
                      {db && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${db.cls}`} title="Следно ниво">{db.label}</span>
                      )}
                      {m.mastered && (
                        <span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex-shrink-0">✓ Совладан</span>
                      )}
                      {!m.mastered && m.consecutiveHighScores > 0 && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {3 - m.consecutiveHighScores} уште
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExplain(m.conceptId, conceptTitle, conceptGrade)}
                        title="AI објаснување"
                        className="flex-shrink-0 text-xs px-2 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        {loadingExplanation === m.conceptId ? '...' : '💡'}
                      </button>
                    </div>
                    {explanations[m.conceptId] && (
                      <div className="mt-2 ml-11 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 leading-relaxed">
                        {explanations[m.conceptId]}
                      </div>
                    )}
                  </div>
                  );
                })}
            </div>
            {inProgressCount > 0 && (
              <p className="text-xs text-slate-400 mt-3 text-center">
                🔥 {inProgressCount} концепт{inProgressCount === 1 ? '' : 'и'} во напредок — продолжи со вежбање!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 mt-8">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white/70 text-sm font-bold">Вчитување...</p>
        </div>
      )}

      {/* П27 — Teacher Announcements Banner */}
      {announcements.length > 0 && searched && (
        <div className="w-full max-w-2xl mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
              📢 Пораки од наставникот
            </p>
            <ul className="space-y-1">
              {announcements.map(a => (
                <li key={a.id} className="text-sm text-amber-700">• {a.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Б2 — Assignments section */}
      {assignments.length > 0 && searched && !isReadOnly && (
        <div className="w-full max-w-2xl mb-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
            <p className="font-bold text-indigo-800 text-sm mb-3 flex items-center gap-1.5">
              📋 Мои задачи ({assignments.filter(a => !a.completedBy.includes(studentName)).length} нерешени)
            </p>
            <div className="space-y-2">
              {assignments.map(a => {
                const done = a.completedBy.includes(studentName);
                const today = new Date().toISOString().split('T')[0];
                const overdue = !done && a.dueDate < today;
                return (
                  <div key={a.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-white border ${overdue ? 'border-red-200' : done ? 'border-green-200' : 'border-indigo-100'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{a.title}</p>
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {done ? '✅ Завршено' : overdue ? `⚠️ Задоцнета — рок: ${a.dueDate}` : `Рок: ${a.dueDate}`}
                      </p>
                    </div>
                    {!done && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${a.cacheId}?assignId=${a.id}&tid=${a.teacherUid}`; }}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Игraj →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results list */}
      {searched && !loading && (
        <div className="w-full max-w-2xl space-y-3">
          {totalQuizzes === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">Нема пронајдено резултати за „{studentName}"</p>
              <p className="text-xs text-slate-400 mt-1">
                Провери дали името е точно напишано, или одиграј прв квиз.
              </p>
            </div>
          ) : (
            results.map((r, i) => {
              const isPassed = r.percentage >= 70;
              const nextQuizId = r.conceptId ? nextQuizIds[r.conceptId] : undefined;
              return (
                <div key={i} className="bg-white rounded-2xl p-4 shadow flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isPassed ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {isPassed
                      ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                      : <XCircle className="w-6 h-6 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{r.quizTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-400">{formatDate(r.playedAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <p className={`text-xl font-black ${isPassed ? 'text-green-600' : 'text-amber-500'}`}>
                      {r.percentage}%
                    </p>
                    <GradeBadge pct={r.percentage} showLabel={true} />
                    <p className="text-xs text-slate-400">{r.correctCount}/{r.totalQuestions}</p>
                    {r.confidence != null && (
                      <span title={`Самооценување: ${r.confidence}/5`} className="text-base leading-none">
                        {['😟','😐','🙂','😊','🤩'][r.confidence - 1]}
                      </span>
                    )}
                    {!isPassed && nextQuizId && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${nextQuizId}`; }}
                        className="flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition mt-0.5"
                      >
                        <PlayCircle className="w-3 h-3" /> Вежбај
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

        </>
      )}

      <footer className="mt-10 text-white/50 text-xs font-bold uppercase tracking-widest no-print">
        Powered by Math Curriculum AI Navigator
      </footer>

      {/* ── Printable Parent Report (hidden on screen, visible on print) ── */}
      {searched && totalQuizzes > 0 && (
        <div className="printable-root hidden" aria-hidden="true">
          {/* Page header */}
          <div className="rpt-header">
            <div className="rpt-header-row">
              <div>
                <h1 className="rpt-title">
                  {reportPeriod === 'THIS_MONTH' ? 'Месечен' : 'Неделен'} извештај за Напредок
                </h1>
                <p className="rpt-subtitle">Математика — Math Curriculum AI Navigator</p>
                <p className="rpt-subtitle">Период: <strong>{periodLabel}</strong></p>
              </div>
              <div className="rpt-meta">
                <div>Датум: <strong>{printDate}</strong></div>
                <div className="rpt-meta-date">Документ генериран автоматски</div>
              </div>
            </div>
          </div>

          {/* Student info */}
          <div className="rpt-student-box">
            <span className="rpt-student-label">Ученик</span>
            <p className="rpt-student-name">{studentName}</p>
          </div>

          {/* Period stats */}
          <div className="rpt-stats-grid">
            {[
              { label: `Квизови (${periodLabel})`, value: String(periodStats.total) },
              { label: 'Положени (≥70%)', value: String(periodStats.passed) },
              { label: 'Просечен резултат', value: periodStats.total > 0 ? `${periodStats.avg}%` : '—' },
              { label: 'Новосовладани концепти', value: String(periodStats.newlyMastered) },
            ].map(s => (
              <div key={s.label} className="rpt-stat-card">
                <p className="rpt-stat-value">{s.value}</p>
                <p className="rpt-stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Period quiz history */}
          <div className="rpt-section">
            <h2 className="rpt-section-title">Квизови за периодот</h2>
            {periodQuizzes.length === 0 ? (
              <p className="rpt-empty-msg">Нема решени квизови во овој период.</p>
            ) : (
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-th rpt-th-left">Квиз</th>
                    <th className="rpt-th rpt-th-center">Датум</th>
                    <th className="rpt-th rpt-th-center">Резултат</th>
                    <th className="rpt-th rpt-th-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {periodQuizzes.map((r, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'rpt-row-even' : 'rpt-row-odd'}>
                      <td className="rpt-td">{r.quizTitle}</td>
                      <td className="rpt-td rpt-td-center">{formatDate(r.playedAt)}</td>
                      <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                        {r.percentage}% ({r.correctCount}/{r.totalQuestions})
                      </td>
                      <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                        {r.percentage >= 70 ? 'Положен' : 'Не положен'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Mastery section */}
          {masteryRecords.length > 0 && (
            <div className="rpt-section">
              <h2 className="rpt-section-title">Вкупно совладување на концепти</h2>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-th rpt-th-left">Концепт</th>
                    <th className="rpt-th rpt-th-center">Обиди</th>
                    <th className="rpt-th rpt-th-center">Најдобар резултат</th>
                    <th className="rpt-th rpt-th-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {masteryRecords
                    .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0))
                    .map((m) => (
                      <tr key={m.conceptId}>
                        <td className="rpt-td">{m.conceptTitle || m.conceptId}</td>
                        <td className="rpt-td rpt-td-center">{m.attempts}</td>
                        <td className={`rpt-td rpt-td-center rpt-td-bold ${m.bestScore >= 85 ? 'rpt-td-green' : 'rpt-td-amber'}`}>{m.bestScore}%</td>
                        <td className={`rpt-td rpt-td-center rpt-td-bold ${m.mastered ? 'rpt-td-green' : 'rpt-td-blue'}`}>
                          {m.mastered ? '✓ Совладан' : `${m.consecutiveHighScores}/3 во тек`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recommendations */}
          {(prereqGaps.length > 0 || reviewToday.length > 0) && (
            <div className="rpt-section">
              <h2 className="rpt-section-title">Препораки за следниот период</h2>
              {prereqGaps.length > 0 && (
                <>
                  <p className="rpt-rec-prereq-heading">
                    Пропуштени предуслови ({prereqGaps.length}):
                  </p>
                  {prereqGaps.map((gap, i) => (
                    <p key={i} className="rpt-rec-item">
                      • <strong>{gap.conceptTitle}</strong> — прво совладај: {gap.missing.join(', ')}
                    </p>
                  ))}
                </>
              )}
              {reviewToday.length > 0 && (
                <>
                  <p className="rpt-rec-review-heading">
                    Концепти за повторување ({reviewToday.length}):
                  </p>
                  {reviewToday.map((m, i) => (
                    <p key={i} className="rpt-rec-item">
                      • {m.conceptTitle || m.conceptId} {m.mastered ? '(совладан — освежи)' : '(во напредок — вежбај)'}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Print footer */}
          <div className="rpt-footer-bar">
            <span>Math Curriculum AI Navigator — Педагошки систем за следење на напредок</span>
            <span>Извештај генериран на {printDate}</span>
          </div>

          {/* Signature lines */}
          <div className="rpt-signatures">
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на наставник</p>
            </div>
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на родител / старател</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
