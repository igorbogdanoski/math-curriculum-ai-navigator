import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import { firestoreService, type QuizResult, type Announcement } from '../services/firestoreService';
import type { DocumentSnapshot } from 'firebase/firestore';
import { useNotification } from '../contexts/NotificationContext';
import { geminiService, isRecoveryWorksheetEnabled } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/common/Card';
import { BarChart3, Users, Award, TrendingUp, RefreshCw, Download, FileSpreadsheet, Brain } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { exportAnalyticsXlsx } from '../utils/exportExcel';
import { useCurriculum } from '../hooks/useCurriculum';
import { useTeacherAnalytics } from '../hooks/useTeacherAnalytics';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { useAnalyticsAggregations } from '../hooks/useAnalyticsAggregations';
import { useFeedbackBreakdown } from '../hooks/useFeedbackBreakdown';
import { isFeedbackTaxonomyRolloutEnabled, logFeedbackTaxonomyRolloutEvent } from '../services/feedbackTaxonomyRollout';
import { StatCard, fmt } from './analytics/shared';
import { AnnouncementBoard } from '../components/analytics/AnnouncementBoard';
import { AnalyticsTabNav, type AnalyticsTab } from '../components/analytics/AnalyticsTabNav';
import { OverviewTab } from './analytics/OverviewTab';
import { TrendTab } from './analytics/TrendTab';
import { StudentsTab } from './analytics/StudentsTab';
import { StandardsTab } from './analytics/StandardsTab';
import { ConceptsTab } from './analytics/ConceptsTab';
import { GradeTab } from './analytics/GradeTab';
import { AlertsTab } from './analytics/AlertsTab';
import { GroupsTab } from './analytics/GroupsTab';
import { LiveTab } from './analytics/LiveTab';
import { ClassesTab } from './analytics/ClassesTab';
import { QuestionBankTab } from './analytics/QuestionBankTab';
import { QuizCoverageTab } from './analytics/QuizCoverageTab';
import { AssignmentsTab } from './analytics/AssignmentsTab';
import { LeagueTab } from './analytics/LeagueTab';
import { CohortTab } from './analytics/CohortTab';
import { DoKHeatmapTab } from './analytics/DoKHeatmapTab';
import { ZPDRecommendationsCard } from '../components/analytics/ZPDRecommendationsCard';
import { MasteryTimelineCard } from '../components/analytics/MasteryTimelineCard';
import { LearningStyleCard } from '../components/analytics/LearningStyleCard';
import type { DifficultyLevel } from '../services/firestoreService.adaptiveDifficulty';
import { useReactToPrint } from 'react-to-print';
import { PrintableEDnevnikReport } from '../components/analytics/PrintableEDnevnikReport';
import type { SchoolClass } from '../services/firestoreService';
import type { AIMaterialFeedbackSummary } from '../services/firestoreService';
import { AssignRemedialModal } from '../components/analytics/AssignRemedialModal';
import { RecoveryWorksheetPreviewModal } from '../components/analytics/RecoveryWorksheetPreviewModal';
import { TabErrorBoundary } from '../components/common/TabErrorBoundary';


export const TeacherAnalyticsView: React.FC = () => {
  const { t } = useLanguage();
  const recoveryWorksheetEnabled = isRecoveryWorksheetEnabled();
  const feedbackTaxonomyEnabled = isFeedbackTaxonomyRolloutEnabled();
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
const { addNotification } = useNotification();
  const { data: analyticsData, isLoading, error, refetch: loadResults } = useTeacherAnalytics(firebaseUser?.uid);

  const masteryRecords = analyticsData?.mastery || [];

  // ── Pagination state ────────────────────────────────────────────────────────
  const [localResults, setLocalResults] = useState<QuizResult[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now()); // updated on manual refresh
  const [aiFeedbackSummary, setAiFeedbackSummary] = useState<AIMaterialFeedbackSummary | null>(null);

  useEffect(() => {
    if (analyticsData) {
      setLocalResults(analyticsData.results);
      setLastDoc(analyticsData.lastDoc);
      setHasMore(analyticsData.lastDoc !== null);
    }
  }, [analyticsData]);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setAiFeedbackSummary(null);
      return;
    }
    let active = true;
    firestoreService.fetchAIMaterialFeedbackSummary(firebaseUser.uid, 30)
      .then(summary => {
        if (active) setAiFeedbackSummary(summary);
      })
      .catch(() => {
        if (active) setAiFeedbackSummary(null);
      });
    return () => {
      active = false;
    };
  }, [firebaseUser?.uid, lastRefresh]);

  const { getConceptDetails, allConcepts, allNationalStandards } = useCurriculum();
  const { openGeneratorPanel } = useGeneratorPanel();
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [aiRecs, setAiRecs] = useState<any[] | null>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const printRef = React.useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `e-dnevnik-report-${new Date().toISOString().slice(0, 10)}` });

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  const { data: feedbackBreakdown, isLoading: isFeedbackBreakdownLoading } = useFeedbackBreakdown({
    uid: firebaseUser?.uid,
    periodDays: 30,
    enabled: Boolean(firebaseUser?.uid) && feedbackTaxonomyEnabled,
    refreshKey: lastRefresh,
  });

  useEffect(() => {
    if (feedbackTaxonomyEnabled && activeTab === 'overview' && feedbackBreakdown) {
      logFeedbackTaxonomyRolloutEvent('analytics_card_viewed');
    }
  }, [activeTab, feedbackBreakdown, feedbackTaxonomyEnabled]);

  // ── Announcements ───────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    let isMounted = true;
    firestoreService.fetchAnnouncements(firebaseUser.uid).then(data => {
      if (isMounted) setAnnouncements(data);
    });
    return () => { isMounted = false; };
  }, [firebaseUser?.uid]);

  const handlePostAnnouncement = async () => {
    if (!newMsg.trim() || !firebaseUser?.uid) return;
    setIsPostingAnnouncement(true);
    try {
      await firestoreService.addAnnouncement(firebaseUser.uid, newMsg);
      setNewMsg('');
      const updated = await firestoreService.fetchAnnouncements(firebaseUser.uid);
      setAnnouncements(updated);
      addNotification('Огласот е објавен! 📢', 'success');
    } catch (err) {
      logger.error('Error posting announcement:', err);
      addNotification('Грешка при објавување на огласот.', 'error');
    } finally {
      setIsPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await firestoreService.deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      logger.error('Error deleting announcement:', err);
      addNotification('Грешка при бришење на огласот.', 'error');
    }
  };

  // ── Assign Remedial state ───────────────────────────────────────────────────
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignRemedialState, setAssignRemedialState] = useState<{
    conceptId: string;
    title: string;
    students: string[];
    misconceptions: { text: string; count: number }[];
    topicId?: string;
    gradeLevel: number;
  } | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    firestoreService.fetchClasses(firebaseUser.uid).then(setClasses).catch(err => {
      logger.error('Failed to fetch classes:', err);
    });
  }, [firebaseUser?.uid]);

  const handleShowAssignRemedial = (
    conceptId: string,
    title: string,
    students: string[],
    misconceptions: { text: string; count: number }[],
  ) => {
    const { grade, topic } = getConceptDetails(conceptId);
    setAssignRemedialState({
      conceptId, title, students, misconceptions,
      topicId: topic?.id,
      gradeLevel: grade?.level ?? 1,
    });
  };

  // ── Analytics aggregations (all useMemo moved to hook) ─────────────────────
  const {
    totalAttempts, avgScore, passRate, quizAggregates, distribution,
    weakConcepts, allConceptStats, uniqueStudents,
    masteryStats, weeklyTrend, perStudentStats, gradeStats, standardsCoverage,
  } = useAnalyticsAggregations({
    localResults,
    masteryRecords,
    allConcepts: allConcepts ?? [],
    allNationalStandards,
    getConceptDetails,
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  // S28-К4: Assign remedial from student row — finds worst concept for that student
  const handleAssignRemedialForStudent = (studentName: string) => {
    const struggling = allConceptStats
      .filter(c => c.strugglingStudents?.includes(studentName))
      .sort((a, b) => a.avgPct - b.avgPct);
    const worst = struggling[0];
    if (worst) {
      handleShowAssignRemedial(worst.conceptId, worst.title, [studentName], worst.misconceptions ?? []);
    } else {
      setAssignRemedialState({
        conceptId: 'general',
        title: `Ремедијација — ${studentName}`,
        students: [studentName],
        misconceptions: [],
        gradeLevel: 1,
      });
    }
  };

  const handleGetRecommendations = async () => {
    if (isLoadingRecs || localResults.length === 0) return;
    setIsLoadingRecs(true);
    setAiRecs(null);
    try {
      const uniqueStudentSet = new Set(localResults.filter(r => r.studentName).map(r => r.studentName!));
      const recs = await geminiService.generateClassRecommendations({
        totalAttempts: localResults.length,
        avgScore: localResults.reduce((s, r) => s + r.percentage, 0) / localResults.length,
        passRate: (localResults.filter(r => r.percentage >= 70).length / localResults.length) * 100,
        weakConcepts,
        masteredCount: masteryStats?.mastered.length ?? 0,
        inProgressCount: masteryStats?.inProgress.length ?? 0,
        strugglingCount: masteryStats?.struggling.length ?? 0,
        uniqueStudentCount: uniqueStudentSet.size,
      });
      setAiRecs(recs);
    } catch (err) {
      logger.error('Error generating class recommendations:', err);
      addNotification('Грешка при генерирање препораки. Проверете ја AI квотата.', 'error');
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const handleGenerateRemedial = (conceptId: string, conceptTitle: string, avgPct: number) => {
    const { grade, topic } = getConceptDetails(conceptId);
    openGeneratorPanel({
      selectedGrade: grade?.id || '',
      selectedTopic: topic?.id || '',
      selectedConcepts: [conceptId],
      contextType: 'CONCEPT',
      materialType: 'ASSESSMENT',
      differentiationLevel: 'support',
      customInstruction: `РЕМЕДИЈАЛНА ВЕЖБА: Одделението постигна само ${avgPct}% за концептот "${conceptTitle}". Генерирај работен лист со ПОДДРШКА ниво — поедноставени прашања, чекор-по-чекор упатства, детални примери, и визуелни помагала каде е можно.`,
    });
  };

  const handleGenerateMisconceptionRemedial = (
    conceptId: string,
    conceptTitle: string,
    misconceptions: { text: string; count: number }[],
  ) => {
    const { grade, topic } = getConceptDetails(conceptId);
    const topMisconceptions = misconceptions
      .slice(0, 5)
      .map((m, i) => `${i + 1}. "${m.text}" (${m.count} ${m.count === 1 ? 'ученик' : 'ученици'})`)
      .join('\n');
    openGeneratorPanel({
      selectedGrade: grade?.id || '',
      selectedTopic: topic?.id || '',
      selectedConcepts: [conceptId],
      contextType: 'CONCEPT',
      materialType: 'ASSESSMENT',
      differentiationLevel: 'support',
      customInstruction: `РЕМЕДИЈАЦИЈА НА КОНЦЕПТУАЛНИ ГРЕШКИ за "${conceptTitle}".\n\nИдентификувани грешки кај учениците:\n${topMisconceptions}\n\nГенерирај квиз со прашања кои ДИРЕКТНО ги адресираат овие погрешни сфаќања. За секоја грешка вклучи барем едно прашање кое ја разоткрива и коригира. Додај кратки образложенија зошто одговорот е точен.`,
    });
  };

  const handleGenerateForDifficulty = (
    difficulty: DifficultyLevel,
    conceptId: string,
    conceptLabel: string,
  ) => {
    const { grade, topic } = getConceptDetails(conceptId);
    const diffLabel = difficulty === 'easy' ? 'ЛЕСНО (поддршка)' : difficulty === 'hard' ? 'ТЕШКО (збогатување)' : 'СРЕДНО';
    openGeneratorPanel({
      selectedGrade: grade?.id || '',
      selectedTopic: topic?.id || '',
      selectedConcepts: [conceptId],
      contextType: 'CONCEPT',
      materialType: 'ASSESSMENT',
      differentiationLevel: difficulty === 'easy' ? 'support' : difficulty === 'hard' ? 'advanced' : 'standard',
      customInstruction: `ЗПД АДАПТАЦИЈА: Генерирај квиз на ниво ${diffLabel} за концептот "${conceptLabel}". Прашањата да одговараат на тежина ${diffLabel}.`,
    });
  };

  const loadMore = async () => {
    if (!lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await firestoreService.fetchQuizResultsPage(firebaseUser?.uid, 200, lastDoc);
      setLocalResults(prev => [...prev, ...page.results]);
      setLastDoc(page.lastDoc);
      setHasMore(page.lastDoc !== null);
    } catch (err) {
      logger.error('Error loading more results:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const calculateGrade = (percentage: number): number => {
    if (percentage < 30) return 1;
    if (percentage < 50) return 2;
    if (percentage < 70) return 3;
    if (percentage < 85) return 4;
    return 5;
  };

  const handleEDnevnikExport = () => {
    const rows: string[][] = [
      ['Ученик / Идентификатор', 'Квиз / Тема', 'Поени', 'Макс. Поени', 'Процент', 'Оценка (Е-Дневник)', 'Датум'],
      ...localResults.map(r => {
        const perc = Math.round(r.percentage);
        return [
          r.studentName || 'Анонимен',
          r.quizTitle,
          String(r.correctCount),
          String(r.totalQuestions),
          `${perc}%`,
          String(calculateGrade(perc)),
          r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || '',
        ];
      }),
    ];
    exportCsv(rows, `e-dnevnik-ocenki-${new Date().toISOString().slice(0, 10)}.csv`);
    addNotification('Експортот за Е-Дневник е успешно преземен', 'success');
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Квиз', 'Ученик', 'Точни', 'Вкупно', 'Проценти', 'Датум', 'Концепт ID'],
      ...localResults.map(r => [
        r.quizTitle,
        r.studentName || 'Анонимен',
        String(r.correctCount),
        String(r.totalQuestions),
        `${Math.round(r.percentage)}%`,
        r.playedAt?.toDate?.()?.toLocaleDateString('mk-MK') || '',
        r.conceptId || '',
      ]),
    ];
    exportCsv(rows, `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportXlsx = async () => {
    if (isExportingXlsx) return;
    setIsExportingXlsx(true);
    try {
      await exportAnalyticsXlsx(localResults, masteryRecords, 'math-navigator-analitika');
      addNotification('Excel датотеката е подготвена (3 листови: резултати, по ученик, по концепт)', 'success');
    } finally {
      setIsExportingXlsx(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gray-200 rounded-xl" />
            <div className="h-10 bg-gray-200 rounded w-1/3" />
          </div>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-full overflow-hidden">
            {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-gray-200 rounded-lg flex-1" />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-2xl" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-8 animate-fade-in">
        <header className="mb-4 md:mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-brand-primary flex items-center gap-3">
              <BarChart3 className="w-7 h-7 md:w-9 md:h-9" />
              {t('analytics.title')}
            </h1>
            <p className="text-base md:text-lg text-gray-600 mt-2">{t('analytics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => navigate('/analytics/telemetry')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-medium transition active:scale-95"
              title="Когнитивна телеметрија — по чекори анализа"
            >
              <Brain className="w-4 h-4" />
              Телеметрија
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={localResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95 disabled:opacity-40"
              title="Извези резултати во CSV"
            >
              <Download className="w-4 h-4" />
              {t('analytics.exportCsv')}
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              disabled={localResults.length === 0 || isExportingXlsx}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-200 text-green-700 hover:bg-green-50 text-sm font-medium transition active:scale-95 disabled:opacity-40"
              title="Извези во Excel со 3 листови (резултати, по ученик, по концепт)"
            >
              {isExportingXlsx ? <><span className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin inline-block" />Извезувам…</> : <><FileSpreadsheet className="w-4 h-4" />Excel (.xlsx)</>}
            </button>
            <button
              type="button"
              onClick={handleEDnevnikExport}
              disabled={localResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-sm font-medium transition active:scale-95 disabled:opacity-40"
              title="Извези во формат за Е-Дневник (оценки)"
            >
              <Download className="w-4 h-4" />
              Е-Дневник
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={localResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95 disabled:opacity-40"
              title="Печати извештај"
            >
              🖨️ Печати
            </button>
            <button
              type="button"
              onClick={() => { loadResults(); setLastRefresh(Date.now()); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Освежи
            </button>
          </div>
        </header>

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <p className="text-red-600 font-medium">{error instanceof Error ? error.message : 'Не можеше да се вчитаат резултатите. Проверете ја врската.'}</p>
          </Card>
        )}

        <AnnouncementBoard
          announcements={announcements}
          newMsg={newMsg}
          isPosting={isPostingAnnouncement}
          onMsgChange={setNewMsg}
          onPost={handlePostAnnouncement}
          onDelete={handleDeleteAnnouncement}
        />

        <AnalyticsTabNav
          activeTab={activeTab}
          showMoreTabs={showMoreTabs}
          onTabChange={tab => { setActiveTab(tab); setShowMoreTabs(false); }}
          onToggleMore={() => setShowMoreTabs(v => !v)}
        />

        {localResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Users className="w-6 h-6 text-blue-600" />}
              label={t('analytics.stat.totalAttempts')}
              value={String(totalAttempts)}
              sub={`${t('analytics.stat.refreshed')} ${new Date(lastRefresh).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })}`}
              color="bg-blue-50"
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6 text-indigo-600" />}
              label={t('analytics.stat.avgResult')}
              value={`${fmt(avgScore, 1)}%`}
              sub={`${t('analytics.stat.basedOn')} ${totalAttempts} ${totalAttempts === 1 ? t('analytics.stat.attemptSingular') : t('analytics.stat.attemptPlural')}`}
              color="bg-indigo-50"
            />
            <StatCard
              icon={<Award className="w-6 h-6 text-green-600" />}
              label={t('analytics.stat.passRate')}
              value={`${fmt(passRate, 1)}%`}
              sub={`${localResults.filter(r => r.percentage >= 70).length} ${t('analytics.stat.from')} ${totalAttempts} ${t('analytics.stat.students')}`}
              color="bg-green-50"
            />
            <StatCard
              icon={<BarChart3 className="w-6 h-6 text-orange-500" />}
              label={t('analytics.stat.distinctQuizzes')}
              value={String(quizAggregates.length)}
              sub={t('analytics.stat.quizzesWithResults')}
              color="bg-orange-50"
            />
          </div>
        )}

        {activeTab === 'overview' && aiFeedbackSummary && aiFeedbackSummary.totalEvents > 0 && (
          <Card className="mb-8 border-indigo-200 bg-indigo-50/40">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-lg font-bold text-indigo-900">D4: Teacher Feedback Loop (30 дена)</h3>
              <span className="text-xs text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full">
                {aiFeedbackSummary.totalEvents} настани
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-indigo-900 border-b border-indigo-200">
                    <th className="py-2 pr-2">Material type</th>
                    <th className="py-2 pr-2">Вкупно</th>
                    <th className="py-2 pr-2">Edit</th>
                    <th className="py-2 pr-2">Reject</th>
                    <th className="py-2 pr-2">Accept</th>
                  </tr>
                </thead>
                <tbody>
                  {aiFeedbackSummary.byMaterialType.map(row => (
                    <tr key={row.materialType} className="border-b border-indigo-100 last:border-0">
                      <td className="py-2 pr-2 font-medium text-indigo-900">{row.materialType}</td>
                      <td className="py-2 pr-2 text-gray-800">{row.total}</td>
                      <td className="py-2 pr-2 text-gray-800">{row.editEvents}</td>
                      <td className="py-2 pr-2 text-gray-800">{row.rejectEvents}</td>
                      <td className="py-2 pr-2 text-gray-800">{row.acceptEvents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <TabErrorBoundary key={activeTab} tabName={activeTab}>
        {localResults.length === 0 && !(feedbackTaxonomyEnabled && feedbackBreakdown?.totalFeedback) && ['overview', 'trend', 'students', 'standards', 'concepts', 'grades', 'alerts', 'groups', 'coverage', 'league', 'cohort', 'dok'].includes(activeTab) ? (
          <Card className="text-center py-16">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-500">{t('analytics.noResultsTitle')}</h2>
            <p className="text-gray-400 mt-2 max-w-sm mx-auto">{t('analytics.noResultsDesc')}</p>
          </Card>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                masteryStats={masteryStats}
                masteryRecords={masteryRecords}
                results={localResults}
                weakConcepts={weakConcepts}
                uniqueStudents={uniqueStudents}
                distribution={distribution}
                quizAggregates={quizAggregates}
                aiRecs={aiRecs}
                isLoadingRecs={isLoadingRecs}
                copiedName={copiedName}
                feedbackBreakdown={feedbackBreakdown}
                isFeedbackBreakdownLoading={isFeedbackBreakdownLoading}
                showFeedbackTaxonomy={feedbackTaxonomyEnabled}
                onGetRecommendations={handleGetRecommendations}
                onGenerateRemedial={handleGenerateRemedial}
                onCopyName={name => { setCopiedName(name); setTimeout(() => setCopiedName(null), 2000); }}
              />
            )}
            {activeTab === 'trend' && <TrendTab weeklyTrend={weeklyTrend} />}
            {activeTab === 'students' && (
              <StudentsTab
                perStudentStats={perStudentStats}
                onAssignRemedialForStudent={handleAssignRemedialForStudent}
              />
            )}
            {activeTab === 'grades' && <GradeTab gradeStats={gradeStats} />}
            {activeTab === 'standards' && <StandardsTab standardsCoverage={standardsCoverage} />}
            {activeTab === 'concepts' && (
              <ConceptsTab
                allConceptStats={allConceptStats}
                onGenerateRemedial={handleGenerateRemedial}
                onGenerateMisconceptionRemedial={handleGenerateMisconceptionRemedial}
                onAssignRemedial={handleShowAssignRemedial}
              />
            )}
            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <AlertsTab
                  perStudentStats={perStudentStats}
                  weakConcepts={weakConcepts}
                  results={localResults}
                  onGenerateRemedial={handleGenerateRemedial}
                />
                <MasteryTimelineCard
                  results={localResults}
                  conceptLabels={Object.fromEntries(
                    (allConcepts ?? []).map(c => [c.id, c.title]),
                  )}
                />
                {firebaseUser?.uid && (
                  <ZPDRecommendationsCard
                    teacherUid={firebaseUser.uid}
                    conceptLabels={Object.fromEntries(
                      (allConcepts ?? []).map(c => [c.id, c.title]),
                    )}
                    onGenerateForDifficulty={handleGenerateForDifficulty}
                  />
                )}
                <LearningStyleCard results={localResults} />
              </div>
            )}
            {activeTab === 'groups' && (
              <GroupsTab perStudentStats={perStudentStats} teacherUid={firebaseUser?.uid} />
            )}
            {activeTab === 'live' && <LiveTab />}
            {activeTab === 'classes' && <ClassesTab teacherUid={firebaseUser?.uid ?? ''} />}
            {activeTab === 'questionBank' && <QuestionBankTab teacherUid={firebaseUser?.uid ?? ''} />}
            {activeTab === 'coverage' && (
              <QuizCoverageTab
                allConceptStats={allConceptStats}
                allConcepts={allConcepts ?? []}
                onGenerateRemedial={handleGenerateRemedial}
              />
            )}
            {activeTab === 'assignments' && firebaseUser?.uid && (
              <AssignmentsTab teacherUid={firebaseUser.uid} />
            )}
            {activeTab === 'league' && firebaseUser?.uid && (
              <LeagueTab teacherUid={firebaseUser.uid} />
            )}
            {activeTab === 'cohort' && (
              <CohortTab
                results={localResults}
                teacherUid={firebaseUser?.uid ?? ''}
                gradeLevel={
                  gradeStats.length > 0
                    ? Number(gradeStats.reduce((a, b) => a.attempts >= b.attempts ? a : b).grade) || 1
                    : 1
                }
              />
            )}
            {activeTab === 'dok' && (
              <DoKHeatmapTab results={localResults} />
            )}
          </>
        )}
        </TabErrorBoundary>

        {hasMore && !['questionBank', 'live', 'classes', 'coverage', 'assignments', 'league', 'cohort', 'dok'].includes(activeTab) && localResults.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition"
            >
              {isLoadingMore
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('analytics.load.loading')}</>
                : <>↓ {t('analytics.load.loadMore')} ({localResults.length})</>
              }
            </button>
            <p className="text-xs text-gray-400">{t('analytics.load.shown')} {localResults.length} {t('analytics.load.results')}</p>
          </div>
        )}
      </div>

      {/* Hidden print target */}
      <div className="hidden print:block">
        <PrintableEDnevnikReport ref={printRef} results={localResults} />
      </div>

      {assignRemedialState && recoveryWorksheetEnabled && (
        <RecoveryWorksheetPreviewModal
          conceptId={assignRemedialState.conceptId}
          conceptTitle={assignRemedialState.title}
          misconceptions={assignRemedialState.misconceptions}
          strugglingStudents={assignRemedialState.students}
          classes={classes}
          teacherUid={firebaseUser!.uid}
          gradeLevel={assignRemedialState.gradeLevel}
          topicId={assignRemedialState.topicId}
          onClose={() => setAssignRemedialState(null)}
          onSuccess={count => {
            addNotification(`✅ Recovery worksheet е одобрен и доделен на ${count} ученик${count === 1 ? '' : 'и'}!`, 'success');
            setAssignRemedialState(null);
          }}
        />
      )}
      {assignRemedialState && !recoveryWorksheetEnabled && (
        <AssignRemedialModal
          conceptId={assignRemedialState.conceptId}
          conceptTitle={assignRemedialState.title}
          misconceptions={assignRemedialState.misconceptions}
          strugglingStudents={assignRemedialState.students}
          classes={classes}
          teacherUid={firebaseUser!.uid}
          gradeLevel={assignRemedialState.gradeLevel}
          onClose={() => setAssignRemedialState(null)}
          onSuccess={count => {
            addNotification(`✅ Ремедијалниот квиз е доделен на ${count} ученик${count === 1 ? '' : 'и'}!`, 'success');
            setAssignRemedialState(null);
          }}
        />
      )}
    </>
  );
};

// ── File-local helper ──────────────────────────────────────────────────────────
function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map(row =>
    row.map(cell => cell.includes(',') || cell.includes('"') || /[\r\n]/.test(cell)
      ? `"${cell.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"` : cell,
    ).join(','),
  ).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
