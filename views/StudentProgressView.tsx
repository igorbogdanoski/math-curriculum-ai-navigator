import React, { useEffect, useState, useMemo } from 'react';
import { ICONS } from '../constants';
import {
  Loader2, User, Star, Home, BarChart2, CheckCircle2,
  RefreshCw, Trophy, Flame, PlayCircle, Printer, AlertTriangle, RotateCcw, Target,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useStudentProgress } from '../hooks/useStudentProgress';
import { useStudentRealtime } from '../hooks/useStudentRealtime';
import { useCurriculum } from '../hooks/useCurriculum';
import { DailyQuestCard } from '../components/common/DailyQuestCard';
import { loadOrGenerateQuests, type DailyQuest } from '../utils/dailyQuests';
import { LogicMap } from '../components/LogicMap';
import { geminiService } from '../services/geminiService';
import { GamificationPanel } from '../components/student/GamificationPanel';
import { ActivityFeed } from '../components/student/ActivityFeed';

const formatDate = (ts: any): string => {
  if (!ts) return '�';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  /** Passed from URL query param ?name=... � enables read-only parent view */
  name?: string;
}

export const StudentProgressView: React.FC<Props> = ({ name: nameProp }) => {
  const { t } = useLanguage();
  const isReadOnly = !!nameProp;
  const { getConceptChain, getConceptDetails, allConcepts } = useCurriculum();

  const [studentName, setStudentName] = useState<string>(() => {
    try { return nameProp || localStorage.getItem('studentName') || ''; } catch { return nameProp || ''; }
  });
  const [nameInput, setNameInput] = useState<string>(() => {
    try { return nameProp || localStorage.getItem('studentName') || ''; } catch { return nameProp || ''; }
  });
  const { data, isLoading: loading, error } = useStudentProgress(studentName, isReadOnly);
  const results = data?.results || [];
  const masteryRecords = data?.mastery || [];
  const gamification = data?.gamification ?? null;
  const classRank = data?.classRank ?? null;
  const nextQuizIds = data?.nextQuizIds ?? {};

  // Real-time listeners — announcements and assignments update instantly
  // when the teacher posts, no manual refresh needed
  const { announcements, assignments } = useStudentRealtime(
    data?.teacherUid,
    studentName,
    data?.announcements,
    data?.assignments,
  );

  const [searched, setSearched] = useState(!!nameProp || !!(() => { try { return localStorage.getItem('studentName'); } catch { return null; } })());
  const [activeTab, setActiveTab] = useState<'activity' | 'map'>('map');
  const [reportPeriod, setReportPeriod] = useState<'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH'>('THIS_WEEK');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null);
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);

  // Update daily quests when mastery data arrives
  useEffect(() => {
    if (studentName && masteryRecords.length > 0) {
      setDailyQuests(loadOrGenerateQuests(studentName, allConcepts, masteryRecords));
    }
  }, [studentName, masteryRecords, allConcepts]);

  // Mark as searched when data loads
  useEffect(() => {
    if (data) setSearched(true);
  }, [data]);

  const handleExplain = async (conceptId: string, title: string, grade?: number) => {
    if (explanations[conceptId] || loadingExplanation === conceptId) return;
    setLoadingExplanation(conceptId);
    const text = await geminiService.explainConcept(title, grade);
    setExplanations(prev => ({ ...prev, [conceptId]: text || 'Нема текст за понудената генерација.' }));
    setLoadingExplanation(null);
  };

  const handleSearch = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (!isReadOnly) localStorage.setItem('studentName', trimmed);
    setStudentName(trimmed);
    setSearched(true);
  };

  const handleGenerateReport = async () => {
    if (aiReportLoading) return;
    setAiReportLoading(true);
    setAiReport(null);
    try {
      const text = await geminiService.generateParentReport(studentName, results, masteryRecords);
      setAiReport(text);
    } catch {
      setAiReport('Грешка при генерирање на извештај. Обидете се повторно.');
    } finally {
      setAiReportLoading(false);
    }
  };

  const totalQuizzes = results.length;
  const passed = results.filter(r => r.percentage >= 70).length;
  const avgPct = totalQuizzes > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalQuizzes)
    : 0;

  const masteredCount = masteryRecords.filter(m => m.mastered).length;
  const inProgressCount = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0).length;

  // -- Правец 13: Prerequisite Gap Analysis ---------------------------------
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

  // -- Правец 14: Spaced Repetition -----------------------------------------
  const reviewToday = useMemo(() => {
    const now = Date.now();
    return masteryRecords.filter(m => {
      if (!m.updatedAt) return false;
      const lastMs = ('toDate' in m.updatedAt ? (m.updatedAt as any).toDate() : new Date(m.updatedAt as any)).getTime();
      const daysSince = (now - lastMs) / 86_400_000;
      return m.mastered ? daysSince > 30 : (daysSince > 7 && m.attempts > 0);
    });
  }, [masteryRecords]);

  // -- Правец 21: Персонализирана патека "Следни чекори" --------------------
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

  // -- Правец 16: Period report data -----------------------------------------
  const { periodLabel, periodQuizzes, periodStats } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    let label: string;
    if (reportPeriod === 'THIS_WEEK') {
      start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
      label = 'Оваа Недела';
    } else if (reportPeriod === 'LAST_WEEK') {
      start = new Date(now); start.setDate(now.getDate() - now.getDay() - 7); start.setHours(0, 0, 0, 0);
      end = new Date(start); end.setDate(start.getDate() + 7);
      label = 'Минатата Недела';
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = now.toLocaleDateString('mk-MK', { month: 'long', year: 'numeric' });
    }
    const pq = results.filter(r => {
      if (!r.playedAt) return false;
      const d = ('toDate' in (r.playedAt as any)) ? (r.playedAt as any).toDate() : new Date(r.playedAt as any);
      return d >= start && d <= end;
    });
    const total = pq.length;
    const avg = total > 0 ? Math.round(pq.reduce((s, r) => s + r.percentage, 0) / total) : 0;
    const passedCount = pq.filter(r => r.percentage >= 70).length;
    const newlyMastered = masteryRecords.filter(m => {
      if (!m.mastered || !m.masteredAt) return false;
      const d = ('toDate' in (m.masteredAt as any)) ? (m.masteredAt as any).toDate() : new Date(m.masteredAt as any);
      return d >= start && d <= end;
    }).length;
    return { periodLabel: label, periodQuizzes: pq, periodStats: { total, avg, passed: passedCount, newlyMastered } };
  }, [results, masteryRecords, reportPeriod]);

  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter uppercase">
              {isReadOnly ? t('progress.parentTitle') : t('progress.myProgress')}
            </h1>
            {isReadOnly && (
              <p className="text-white/60 text-xs font-semibold">{t('progress.parentSubtitle')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap min-w-0 w-full sm:w-auto">
          {searched && totalQuizzes > 0 && (
            <div className="flex flex-row items-center gap-2 no-print flex-wrap w-full sm:w-auto">
              <select
                value={reportPeriod}
                onChange={e => setReportPeriod(e.target.value as 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH')}
                className="flex-1 sm:flex-none text-xs font-bold bg-white/10 border border-white/20 text-white px-3 py-2 rounded-full cursor-pointer h-11"
              >
                <option value="THIS_WEEK" className="text-slate-800 bg-white">{t('progress.thisWeek')}</option>
                <option value="LAST_WEEK" className="text-slate-800 bg-white">{t('progress.lastWeek')}</option>
                <option value="THIS_MONTH" className="text-slate-800 bg-white">{t('progress.thisMonth')}</option>
              </select>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition h-11"
              >
                <Printer className="w-4 h-4" /> {t('progress.print')}
              </button>
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={aiReportLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-purple-500/70 hover:bg-purple-500/90 px-4 py-2 rounded-full border border-purple-300/30 transition h-11 disabled:opacity-60"
              >
                {aiReportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '📄'} AI Извештај
              </button>
            </div>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => { window.location.hash = '/'; }}
              className="flex items-center justify-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition no-print h-11"
            >
              <Home className="w-4 h-4" /> {t('progress.home')}
            </button>
          )}
        </div>
      </div>

      {/* Search card � hidden in read-only (parent) mode */}
      {!isReadOnly && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-black text-slate-800">{t('progress.searchName')}</p>
              <p className="text-xs text-slate-400">{t('progress.nameSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Ime..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 md:py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-indigo-400 transition min-h-[48px]"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!nameInput.trim() || loading}
              className="flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-5 py-3 md:py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-40 min-h-[48px]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Провери
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
            <p className="text-xs text-slate-500 font-semibold">{t('progress.stat.quizzes')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-800">{passed}</p>
            <p className="text-xs text-slate-500 font-semibold">{t('progress.stat.passed')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{avgPct}%</p>
            <p className="text-xs text-slate-500 font-semibold">{t('progress.stat.average')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{masteredCount}</p>
            <p className="text-xs text-slate-500 font-semibold">{t('progress.stat.mastered')}</p>
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
            <Target className="w-4 h-4" /> {t('progress.tab.map')}
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 font-bold text-sm rounded-xl transition ${activeTab === 'activity' ? 'bg-white text-indigo-700 shadow' : 'text-white hover:bg-white/10'}`}
          >
            <BarChart2 className="w-4 h-4" /> {t('progress.tab.activity')}
          </button>
        </div>
      )}

      {searched && !loading && activeTab === 'map' && (
        <div className="w-full max-w-2xl no-print mb-8">
          <LogicMap masteryRecords={masteryRecords} nextQuizIds={nextQuizIds} />
        </div>
      )}

      {searched && !loading && activeTab === 'activity' && (
        <>

      {/* -- Правец 15: Gamification — XP + Streak + Achievements ------------ */}
      {gamification && (
        <GamificationPanel gamification={gamification} classRank={classRank} />
      )}

      {/* -- E1.2: Daily Quests ------------------------------------------------ */}
      {searched && !loading && !isReadOnly && dailyQuests.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <DailyQuestCard
            quests={dailyQuests}
            onPlayQuest={conceptId => {
              const nextId = nextQuizIds[conceptId];
              if (nextId) window.location.hash = `/play/${nextId}`;
            }}
          />
        </div>
      )}

      {/* -- Правец 14: Повтори денес (Spaced Repetition) --------------------- */}
      {searched && !loading && reviewToday.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw className="w-5 h-5 text-blue-600" />
              <p className="font-bold text-blue-800 text-sm">{t('progress.reviewToday')}</p>
              <span className="px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 text-xs font-bold">{reviewToday.length}</span>
            </div>
            <p className="text-xs text-blue-600 mb-3">{t('progress.reviewDesc')}</p>
            <div className="space-y-2">
              {reviewToday.map(m => {
                const nextId = nextQuizIds[m.conceptId];
                return (
                  <div key={m.conceptId} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{m.conceptTitle || m.conceptId}</p>
                      <p className="text-xs text-slate-400">
                        {m.mastered ? t('progress.masteredLongAgo') : `${m.consecutiveHighScores}/3 ${t('progress.moreToGo')} 85%`}
                      </p>
                    </div>
                    {nextId && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${nextId}`; }}
                        className="flex items-center gap-1 text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition flex-shrink-0"
                      >
                        <PlayCircle className="w-3 h-3" /> {t('progress.practice')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -- Правец 13: Prerequisite Gap Analysis ----------------------------- */}
      {searched && !loading && prereqGaps.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <p className="font-bold text-orange-800 text-sm">{t('progress.prereqGaps')}</p>
              <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 text-xs font-bold">{prereqGaps.length}</span>
            </div>
            <p className="text-xs text-orange-600 mb-3">{t('progress.prereqDesc')}</p>
            <div className="space-y-3">
              {prereqGaps.map((gap, i) => (
                <div key={i} className="bg-white rounded-xl px-3 py-2.5">
                  <p className="text-sm font-bold text-orange-900 mb-1">{gap.conceptTitle}</p>
                  <p className="text-xs text-slate-500 mb-1">{t('progress.prereqNeeded')}</p>
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

      {/* -- Правец 21: Следни чекори (Learning Path) -------------------------- */}
      {searched && !loading && nextUpConcepts.length > 0 && (
        <div className="w-full max-w-2xl mb-4">
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-teal-600" />
              <p className="font-bold text-teal-800 text-sm">{t('progress.nextSteps')}</p>
              <span className="px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 text-xs font-bold">{nextUpConcepts.length}</span>
            </div>
            <p className="text-xs text-teal-600 mb-3">{t('progress.nextStepsDesc')}</p>
            <div className="space-y-2">
              {nextUpConcepts.map(({ concept, mastery, grade }) => (
                <div key={concept.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-teal-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{concept.title}</p>
                    <p className="text-xs text-slate-400">
                      {grade ? `${grade.level}. ${t('progress.gradeLevel')}` : ''}
                      {mastery ? ` — ${mastery.consecutiveHighScores}/3 ${t('progress.moreToGo')} 85%` : ''}
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
                      {t('progress.practiceArrow')}
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-xs text-teal-400 font-semibold px-2">{t('progress.readyToLearn')}</span>
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
              <p className="font-bold text-slate-800 text-sm">{t('progress.masterySection')}</p>
            </div>
            <div className="space-y-2">
              {masteryRecords
                .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0) || b.consecutiveHighScores - a.consecutiveHighScores)
                .map((m) => {
                  const db = m.lastScore === undefined ? null
                    : m.lastScore < 60  ? { label: t('progress.levelBeginning'),  cls: 'text-blue-700 bg-blue-50 border-blue-100' }
                    : m.lastScore < 85  ? { label: t('progress.levelInProgress'), cls: 'text-slate-600 bg-slate-100 border-slate-200' }
                    :                    { label: t('progress.levelMastered'),    cls: 'text-red-700 bg-red-50 border-red-100' };
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
                            ? `${t('progress.levelMastered')}! ${t('progress.stat.average')}: ${m.bestScore}%`
                            : `${m.consecutiveHighScores}/3 ${t('progress.moreToGo')} 85% — ${t('progress.stat.average')}: ${m.lastScore}%`}
                        </p>
                      </div>
                      {db && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${db.cls}`} title={t('progress.masteryLevelTitle')}>{db.label}</span>
                      )}
                      {m.mastered && (
                        <span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex-shrink-0">{t('progress.masteredBadge')}</span>
                      )}
                      {!m.mastered && m.consecutiveHighScores > 0 && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {3 - m.consecutiveHighScores} {t('progress.moreToGo')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExplain(m.conceptId, conceptTitle, conceptGrade)}
                        title={t('progress.aiExplain')}
                        className="flex-shrink-0 text-xs px-2 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        {loadingExplanation === m.conceptId ? '...' : t('progress.explainAi')}
                      </button>
                      {!m.mastered && (
                        <button
                          type="button"
                          onClick={() => {
                            const enc = (s: string) => encodeURIComponent(s);
                            window.location.hash = `/tutor?student=${enc(studentName)}&concept=${enc(m.conceptId)}&title=${enc(conceptTitle)}`;
                          }}
                          title="Вежбај со AI тутор"
                          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition"
                        >
                          🤖 Тутор
                        </button>
                      )}
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
                {inProgressCount} {t('progress.levelInProgress')} — {t('progress.practice')}!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 mt-8">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white/70 text-sm font-bold">{t('progress.loading')}</p>
        </div>
      )}

      {/* П27 + Би2 + Results — ActivityFeed */}
      {searched && !loading && (
        <ActivityFeed
          announcements={announcements}
          assignments={assignments}
          results={results}
          studentName={studentName}
          nextQuizIds={nextQuizIds}
          isReadOnly={isReadOnly}
        />
      )}

        </>
      )}

      {/* AI Parent Report Modal */}
      {aiReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="font-bold text-slate-800">📄 AI Родителски Извештај — {studentName}</p>
              <button
                type="button"
                onClick={() => setAiReport(null)}
                className="text-slate-400 hover:text-slate-700 transition"
                aria-label="Затвори"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {aiReport}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition"
              >
                🖨️ Печати / PDF
              </button>
              <button
                type="button"
                onClick={() => setAiReport(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200 transition"
              >
                Затвори
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-10 text-white/50 text-xs font-bold uppercase tracking-widest no-print">
        Powered by Math Curriculum AI Navigator
      </footer>

      {/* -- Printable Parent Report (hidden on screen, visible on print) -- */}
      {searched && totalQuizzes > 0 && (
        <div className="printable-root hidden" aria-hidden="true">
          {/* Page header */}
          <div className="rpt-header">
            <div className="rpt-header-row">
              <div>
                <h1 className="rpt-title">
                  {reportPeriod === 'THIS_MONTH' ? 'Месечен' : 'Неделен'} извештај за напредок
                </h1>
                <p className="rpt-subtitle">Напредок — Math Curriculum AI Navigator</p>
                <p className="rpt-subtitle">Период: <strong>{periodLabel}</strong></p>
              </div>
              <div className="rpt-meta">
                <div>Датум: <strong>{printDate}</strong></div>
                <div className="rpt-meta-date">Системски генериран извештај</div>
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
              { label: 'Новосовладани', value: String(periodStats.newlyMastered) },
            ].map(s => (
              <div key={s.label} className="rpt-stat-card">
                <p className="rpt-stat-value">{s.value}</p>
                <p className="rpt-stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Period quiz history */}
          <div className="rpt-section">
            <h2 className="rpt-section-title">Резултати од квизови</h2>
            {periodQuizzes.length === 0 ? (
              <p className="rpt-empty-msg">Нема одиграни квизови во овој период.</p>
            ) : (
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-th rpt-th-left">Тест</th>
                    <th className="rpt-th rpt-th-center">Датум</th>
                    <th className="rpt-th rpt-th-center">Резултат</th>
                    <th className="rpt-th rpt-th-center">Оценка</th>
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
              <h2 className="rpt-section-title">Статус на совладување</h2>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-th rpt-th-left">Концепт</th>
                    <th className="rpt-th rpt-th-center">Обиди</th>
                    <th className="rpt-th rpt-th-center">Последен резултат</th>
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
                          {m.mastered ? '✓ Совладано' : `${m.consecutiveHighScores}/3 над 85%`}
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
              <h2 className="rpt-section-title">Препораки за понатамошно учење</h2>
              {prereqGaps.length > 0 && (
                <>
                  <p className="rpt-rec-prereq-heading">
                    Недостасуваат предуслови ({prereqGaps.length}):
                  </p>
                  {prereqGaps.map((gap, i) => (
                    <p key={i} className="rpt-rec-item">
                      • <strong>{gap.conceptTitle}</strong> — треба претходно: {gap.missing.join(', ')}
                    </p>
                  ))}
                </>
              )}
              {reviewToday.length > 0 && (
                <>
                  <p className="rpt-rec-review-heading">
                    Повтори денес ({reviewToday.length}):
                  </p>
                  {reviewToday.map((m, i) => (
                    <p key={i} className="rpt-rec-item">
                      • {m.conceptTitle || m.conceptId} {m.mastered ? '(совладано — повторување)' : '(не совладано — вежбање)'}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Print footer */}
          <div className="rpt-footer-bar">
            <span>Math Curriculum AI Navigator — извештај за родители и наставници</span>
            <span>Генерирано автоматски на {printDate}</span>
          </div>

          {/* Signature lines */}
          <div className="rpt-signatures">
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на родителот</p>
            </div>
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на ученикот / Наставникот</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


