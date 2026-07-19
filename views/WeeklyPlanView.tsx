import { logger } from '../utils/logger';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePlanning } from '../contexts/PlanningContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { resolveGradeByLabel } from '../utils/gradeMatch';
import { Card } from '../components/common/Card';
import type { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../types';
import { loadThematicPlanEdit } from '../services/firestoreService.plans';
import { saveWeeklyPlan, loadWeeklyPlan } from '../services/firestoreService.weeklyPlans';
import { PedagogicalEnrichPanel } from '../components/planner/PedagogicalEnrichPanel';
import { PlanningChainBar } from '../components/planner/PlanningChainBar';
import { ParentLetterModal } from '../components/planner/ParentLetterModal';
import { WeeklyCollabModal } from '../components/planner/WeeklyCollabModal';
import type { SavedWeeklyPlan } from '../services/firestoreService.weeklyPlans';
import { useReactToPrint } from 'react-to-print';
import { PrintShell } from '../components/common/PrintShell';
import { useLanguage } from '../i18n/LanguageContext';

// ── Local types ────────────────────────────────────────────────────────────────

interface SavedPlan {
  id: string;
  grade: string;
  subject: string;
  authorName?: string;
  planData: AIGeneratedAnnualPlan;
}

interface TopicRange {
  topic: AIGeneratedAnnualPlanTopic;
  topicIdx: number;
  weekStart: number;
  weekEnd: number;
}

interface WeeklySlot {
  dayIdx: number;
  periodIdx: number;
  lessonNumber: number;
  topicTitle: string;
  topicIdx: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Day/month names are language-dependent — built inside the component from
// t() (see buildWeekDays/buildWeekToMonth below) rather than as module-level
// hardcoded MK constants (Wave 6.1b, audit_2026_07_18_full_app_review).

function buildWeekDays(t: (key: string) => string): string[] {
  return [t('weeklyPlan.days.mon'), t('weeklyPlan.days.tue'), t('weeklyPlan.days.wed'), t('weeklyPlan.days.thu'), t('weeklyPlan.days.fri')];
}

function buildWeekDaysShort(t: (key: string) => string): string[] {
  return [t('planner.days.mon'), t('planner.days.tue'), t('planner.days.wed'), t('planner.days.thu'), t('planner.days.fri')];
}

function buildWeekToMonth(t: (key: string) => string): Record<number, string> {
  const months = [
    t('weeklyPlan.months.sep'), t('weeklyPlan.months.oct'), t('weeklyPlan.months.nov'), t('weeklyPlan.months.dec'),
    t('weeklyPlan.months.jan'), t('weeklyPlan.months.feb'), t('weeklyPlan.months.mar'), t('weeklyPlan.months.apr'),
    t('weeklyPlan.months.may'), t('weeklyPlan.months.jun'),
  ];
  const map: Record<number, string> = {};
  // 4 weeks/month for the first 8 months (Sep-Apr), then May gets 4 and June
  // absorbs the remainder — matches the original 36-week academic-year layout.
  const weeksPerMonth = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  let week = 1;
  months.forEach((month, i) => {
    for (let w = 0; w < weeksPerMonth[i] && week <= 40; w++) {
      map[week] = month;
      week++;
    }
  });
  return map;
}

// Topic color by index (cycles)
const TOPIC_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-emerald-100 border-emerald-300 text-emerald-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-orange-100 border-orange-300 text-orange-800',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTopicRanges(plan: AIGeneratedAnnualPlan): TopicRange[] {
  let cumWeek = 0;
  return (plan.topics ?? []).map((topic, topicIdx) => {
    const dw = topic.durationWeeks ?? 1;
    const weekStart = cumWeek + 1;
    const weekEnd = cumWeek + dw;
    cumWeek = weekEnd;
    return { topic, topicIdx, weekStart, weekEnd };
  });
}

function computeSlots(
  topicRanges: TopicRange[],
  weekNumber: number,
  periodsPerDay: readonly [number, number, number, number, number],
): WeeklySlot[] {
  const entry = topicRanges.find(r => weekNumber >= r.weekStart && weekNumber <= r.weekEnd);
  if (!entry) return [];

  const weeklyHours = periodsPerDay.reduce((s, v) => s + v, 0);
  if (weeklyHours === 0) return [];

  const relativeWeek = weekNumber - entry.weekStart; // 0-based
  const startLesson = relativeWeek * weeklyHours + 1;

  const slots: WeeklySlot[] = [];
  let slotIdx = 0;
  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    for (let periodIdx = 0; periodIdx < periodsPerDay[dayIdx]; periodIdx++) {
      slots.push({
        dayIdx,
        periodIdx,
        lessonNumber: startLesson + slotIdx,
        topicTitle: entry.topic.title,
        topicIdx: entry.topicIdx,
      });
      slotIdx++;
    }
  }
  return slots;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const WeeklyPlanView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();
  const { annualPlanId, grade, setPlanningState } = usePlanning();
  const { curriculum } = useCurriculum();
  const { t } = useLanguage();

  const MK_DAYS = useMemo(() => buildWeekDays(t), [t]);
  const MK_DAYS_SHORT = useMemo(() => buildWeekDaysShort(t), [t]);
  const WEEK_TO_MONTH = useMemo(() => buildWeekToMonth(t), [t]);

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(annualPlanId ?? '');
  const [weekNumber, setWeekNumber] = useState(1);
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);
  const [periodsPerDay, setPeriodsPerDay] = useState<[number, number, number, number, number]>([1, 1, 1, 1, 0]);
  const [thematicLessonMap, setThematicLessonMap] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedWeek, setLastSavedWeek] = useState<number | null>(null);
  const [showParentLetter, setShowParentLetter] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabSharedPlan, setCollabSharedPlan] = useState<{ plan: SavedWeeklyPlan; ownerName: string } | null>(null);

  // Load plans from Firestore
  useEffect(() => {
    const load = async () => {
      setIsLoadingPlans(true);
      try {
        const q = firebaseUser
          ? query(
              collection(db, 'academic_annual_plans'),
              where('userId', '==', firebaseUser.uid),
              orderBy('createdAt', 'desc'),
              limit(50),
            )
          : query(collection(db, 'academic_annual_plans'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedPlan));
        setPlans(loaded);
        if (!selectedPlanId && loaded.length > 0) {
          setSelectedPlanId(loaded[0].id);
        }
      } catch (err) {
        logger.error('WeeklyPlanView: load plans error', err);
        addNotification(t('weeklyPlan.errors.loadPlans'), 'error');
      } finally {
        setIsLoadingPlans(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid]);

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  // Auto-load thematic lessons for the current week's topic
  useEffect(() => {
    setThematicLessonMap({});
    if (!firebaseUser?.uid || !selectedPlan || !curriculum) return;
    const topicEntry = buildTopicRanges(selectedPlan.planData).find(
      r => weekNumber >= r.weekStart && weekNumber <= r.weekEnd,
    );
    if (!topicEntry) return;

    // Match grade from plan string to curriculum grade
    const gradeObj = resolveGradeByLabel(curriculum.grades, selectedPlan.planData.grade);
    if (!gradeObj) return;

    const topicTitle = topicEntry.topic.title.toLowerCase();
    const topicObj =
      (topicEntry.topic.topicId ? gradeObj.topics.find(t => t.id === topicEntry.topic.topicId) : undefined) ??
      gradeObj.topics.find(t =>
        t.title.toLowerCase().includes(topicTitle.slice(0, 5)) ||
        topicTitle.includes(t.title.toLowerCase().slice(0, 5)),
      );
    if (!topicObj) return;

    loadThematicPlanEdit(firebaseUser.uid, gradeObj.id, topicObj.id).then(saved => {
      if (!saved) return;
      const map: Record<number, string> = {};
      saved.plan.lessons.forEach((l, i) => { map[i + 1] = l.lessonUnit; });
      setThematicLessonMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, selectedPlanId, weekNumber, curriculum]);

  const topicRanges = useMemo(
    () => (selectedPlan ? buildTopicRanges(selectedPlan.planData) : []),
    [selectedPlan],
  );

  const slots = useMemo(
    () => computeSlots(topicRanges, weekNumber, periodsPerDay),
    [topicRanges, weekNumber, periodsPerDay],
  );

  const maxPeriods = Math.max(1, ...periodsPerDay);

  const weeklyHours = periodsPerDay.reduce((s, v) => s + v, 0);

  const topicForWeek = useMemo(
    () => topicRanges.find(r => weekNumber >= r.weekStart && weekNumber <= r.weekEnd) ?? null,
    [topicRanges, weekNumber],
  );

  const gradeObj = resolveGradeByLabel(curriculum?.grades ?? [], selectedPlan?.planData.grade) ?? null;

  // 2026-07-19 (Wave 6.2, audit_2026_07_18_full_app_review): the week
  // navigator used to hard-cap at 36 regardless of the plan's actual length —
  // AnnualPlanGeneratorView lets teachers pick anywhere from 20 to 40 weeks,
  // so a 40-week plan's last 4 weeks were simply unreachable here. Derived
  // from the plan itself now, falling back to 36 only for legacy plans saved
  // before totalWeeks was recorded.
  const maxWeek = selectedPlan?.planData.totalWeeks ?? 36;

  const handleGenerateLesson = (slot: WeeklySlot) => {
    if (!selectedPlan) return;
    const lessonUnit = thematicLessonMap[slot.lessonNumber];
    setPlanningState({
      annualPlanId: selectedPlan.id,
      grade: grade ?? null,
      themeName: slot.topicTitle,
    });
    const params = new URLSearchParams({
      prefillTopic: slot.topicTitle,
      prefillGrade: selectedPlan.grade,
      prefillSubject: selectedPlan.subject,
    });
    if (lessonUnit) params.set('prefillLessonUnit', lessonUnit);
    params.set('prefillLessonNumber', String(slot.lessonNumber));
    navigate(`/planner/lesson/new?${params.toString()}`);
  };

  const handlePeriodChange = (dayIdx: number, delta: number) => {
    setPeriodsPerDay(prev => {
      const next: [number, number, number, number, number] = [...prev] as [number, number, number, number, number];
      next[dayIdx] = Math.max(0, Math.min(4, next[dayIdx] + delta));
      return next;
    });
  };

  const weeklyPrintRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: weeklyPrintRef,
    documentTitle: `Неделен_план_Нед${weekNumber}_${selectedPlan?.grade ?? ''}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 1cm 1.2cm; }
      * { box-sizing: border-box; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; }
      body > div { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; }
      table { border-collapse: collapse !important; width: 100% !important; }
      thead { display: table-header-group !important; }
      tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
      .print-header-bg, th { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `,
  });

  const handleSave = async () => {
    if (!firebaseUser?.uid || !selectedPlan || slots.length === 0) return;
    const gradeObj = resolveGradeByLabel(curriculum?.grades ?? [], selectedPlan.planData.grade);
    if (!gradeObj) { addNotification(t('weeklyPlan.errors.noGradeFound'), 'error'); return; }
    setIsSaving(true);
    try {
      await saveWeeklyPlan(
        firebaseUser.uid,
        gradeObj.id,
        gradeObj.level,
        weekNumber,
        selectedPlan.id,
        periodsPerDay,
        slots,
      );
      setLastSavedWeek(weekNumber);
      addNotification(`✅ ${t('weeklyPlan.title')} (${t('weeklyPlan.weekAbbrev')} ${weekNumber}) ${t('weeklyPlan.savedExclaim')}`, 'success');
    } catch {
      addNotification(t('weeklyPlan.errors.saveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Restore saved periodsPerDay when plan + week change
  useEffect(() => {
    if (!firebaseUser?.uid || !selectedPlan) return;
    const gradeObj = resolveGradeByLabel(curriculum?.grades ?? [], selectedPlan.planData.grade);
    if (!gradeObj) return;
    loadWeeklyPlan(firebaseUser.uid, gradeObj.id, weekNumber).then(saved => {
      if (saved) {
        setPeriodsPerDay(saved.periodsPerDay);
        setLastSavedWeek(weekNumber);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, selectedPlanId, weekNumber]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          @page { size: A4 landscape; margin: 1cm; }
          .weekly-grid-table { font-size: 10pt; }
        }
      ` }} />

      <PlanningChainBar currentStep="weekly" />

      {/* ── Header ── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ICONS.calendar className="w-8 h-8 text-brand-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">{t('weeklyPlan.title')}</h1>
            {selectedPlan && (
              <p className="text-sm text-gray-500">{selectedPlan.subject} — {selectedPlan.grade}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {/* Plan selector */}
          {plans.length > 1 && (
            <select
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
              aria-label={t('weeklyPlan.selectPlanAriaLabel')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.planData.grade ?? p.grade} — {p.planData.subject ?? p.subject}
                </option>
              ))}
            </select>
          )}

          {/* Week stepper */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setWeekNumber(w => Math.max(1, w - 1))}
              className="px-3 py-2 hover:bg-gray-100 transition-colors text-gray-700"
              disabled={weekNumber <= 1}
            >
              ←
            </button>
            <span className="px-3 py-2 font-semibold min-w-[90px] text-center text-sm border-l border-r border-gray-300">
              {t('weeklyPlan.weekPrefix')} {weekNumber}
            </span>
            <button
              type="button"
              onClick={() => setWeekNumber(w => Math.min(maxWeek, w + 1))}
              className="px-3 py-2 hover:bg-gray-100 transition-colors text-gray-700"
              disabled={weekNumber >= maxWeek}
            >
              →
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowScheduleConfig(v => !v)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <ICONS.settings className="w-4 h-4" />
            {t('weeklyPlan.scheduleButton')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedPlan || slots.length === 0}
            title={t('weeklyPlan.saveTitle')}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:bg-gray-300 transition-colors"
          >
            {isSaving
              ? <ICONS.spinner className="w-4 h-4 animate-spin" />
              : lastSavedWeek === weekNumber
                ? <ICONS.check className="w-4 h-4" />
                : <ICONS.bookmark className="w-4 h-4" />
            }
            {lastSavedWeek === weekNumber ? t('weeklyPlan.saved') : t('common.save')}
          </button>

          {topicForWeek && (
            <button
              type="button"
              onClick={() => setShowParentLetter(true)}
              className="flex items-center gap-2 px-3 py-2 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm transition-colors"
            >
              {t('weeklyPlan.parentLetterButton')}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCollabModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg text-sm transition-colors"
          >
            📡 Collab
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-secondary"
          >
            <ICONS.printer className="w-4 h-4" />
            {t('annualPlan.officialModal.print')}
          </button>
        </div>
      </div>

      {/* ── Period info bar ── */}
      <div className="no-print flex flex-wrap items-center gap-3 mb-4 text-sm text-gray-600">
        <ICONS.calendar className="w-4 h-4 text-gray-400 shrink-0" />
        <span>
          <strong>{WEEK_TO_MONTH[weekNumber] ?? t('weeklyPlan.weekPrefix')}</strong>
          {' · '}{t('weeklyPlan.weekPrefix')} {weekNumber} {t('weeklyPlan.of')} {maxWeek}
          {' · '}
          <strong>{weeklyHours} {t('weeklyPlan.hoursPerWeekAbbrev')}</strong>
        </span>
        {gradeObj && gradeObj.level <= 5 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
            {t('weeklyPlan.legalObligation')}
          </span>
        ) : null}
        {topicForWeek && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">·</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TOPIC_COLORS[topicForWeek.topicIdx % TOPIC_COLORS.length]}`}
            >
              {topicForWeek.topic.title}
            </span>
            <span className="text-gray-400 text-xs">
              ({t('weeklyPlan.weekAbbrev')} {topicForWeek.weekStart}–{topicForWeek.weekEnd})
            </span>
          </span>
        )}
      </div>

      {/* ── Schedule config panel ── */}
      {showScheduleConfig && (
        <Card className="no-print mb-4 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {t('weeklyPlan.periodsPerDayLabel')} ({t('weeklyPlan.periodsPerDayTotal')}: {weeklyHours} {t('weeklyPlan.hoursPerWeekAbbrev')})
          </p>
          <div className="flex flex-wrap gap-4">
            {MK_DAYS_SHORT.map((day, idx) => (
              <div key={day} className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600 w-7">{day}</span>
                <button
                  type="button"
                  onClick={() => handlePeriodChange(idx, -1)}
                  disabled={periodsPerDay[idx] <= 0}
                  className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center justify-center font-bold"
                >
                  −
                </button>
                <span className="w-5 text-center font-semibold">{periodsPerDay[idx]}</span>
                <button
                  type="button"
                  onClick={() => handlePeriodChange(idx, +1)}
                  disabled={periodsPerDay[idx] >= 4}
                  className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 flex items-center justify-center font-bold"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Loading state ── */}
      {isLoadingPlans ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <ICONS.spinner className="w-8 h-8 animate-spin mr-3" />
          {t('weeklyPlan.loadingPlans')}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center">
          <ICONS.calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{t('weeklyPlan.noPlans')}</p>
          <button
            type="button"
            onClick={() => navigate('/annual-planner')}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm"
          >
            {t('weeklyPlan.createAnnualPlan')}
          </button>
        </Card>
      ) : !selectedPlan ? null : (
        <>
          {/* ── Hidden PrintShell for useReactToPrint ── */}
          <div className="absolute -left-[9999px] top-0">
            <PrintShell
              ref={weeklyPrintRef}
              title={t('weeklyPlan.printTitle')}
              subtitle={`${selectedPlan.subject} · ${t('weeklyPlan.weekPrefix')} ${weekNumber} ${t('weeklyPlan.of')} ${maxWeek} · ${WEEK_TO_MONTH[weekNumber] ?? ''}`}
              teacherName={user?.name ?? ''}
              schoolName={user?.schoolName ?? ''}
              grade={selectedPlan.planData.grade?.replace(/\D/g, '') ?? ''}
              subject={selectedPlan.subject}
            >
              <table className="weekly-grid-table w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-500 bg-gray-200 px-2 py-1 font-bold text-left w-14 print-header-bg">{t('weeklyPlan.period')}</th>
                    {MK_DAYS.map((day, idx) => (
                      <th key={day} className="border border-gray-500 bg-gray-200 px-2 py-1 font-bold text-center print-header-bg">
                        {day}
                        {periodsPerDay[idx] > 0 && (
                          <div className="text-[8pt] font-normal text-gray-600">{periodsPerDay[idx]} {t('weeklyPlan.hoursAbbrev')}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxPeriods }, (_, periodIdx) => (
                    <tr key={periodIdx}>
                      <td className="border border-gray-500 px-2 py-1 text-center font-bold bg-gray-100 print-header-bg text-[8pt]">
                        {periodIdx + 1}
                      </td>
                      {[0, 1, 2, 3, 4].map(dayIdx => {
                        const slot = slots.find(s => s.dayIdx === dayIdx && s.periodIdx === periodIdx);
                        const noClass = periodsPerDay[dayIdx] === 0 || periodIdx >= periodsPerDay[dayIdx];
                        return (
                          <td key={dayIdx} className={`border border-gray-500 px-2 py-1 align-top min-h-[60px] ${noClass ? 'bg-gray-50' : 'bg-white'}`}>
                            {!noClass && slot ? (
                              <div>
                                <div className="text-[8pt] text-gray-500 mb-0.5">{t('weeklyPlan.period')} {slot.lessonNumber}</div>
                                <div className="text-[9pt] font-medium">{slot.topicTitle}</div>
                              </div>
                            ) : noClass ? (
                              <span className="text-gray-300 text-[8pt]">—</span>
                            ) : (
                              <span className="text-gray-400 text-[8pt] italic">{t('weeklyPlan.none')}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </PrintShell>
          </div>

          {/* ── Weekly grid (screen) ── */}
          <div className="overflow-x-auto">
            <table className="weekly-grid-table w-full border-collapse min-w-[600px]">
              <colgroup>
                <col className="w-20" />
                {MK_DAYS.map(d => <col key={d} />)}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="border border-gray-300 bg-gray-50 p-2 text-xs text-gray-500 font-medium">{t('weeklyPlan.period')}</th>
                  {MK_DAYS.map((day, idx) => (
                    <th
                      key={day}
                      className={`border border-gray-300 p-2 text-sm font-semibold text-center ${
                        periodsPerDay[idx] === 0 ? 'bg-gray-50 text-gray-300' : 'bg-brand-primary/5 text-brand-primary'
                      }`}
                    >
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{MK_DAYS_SHORT[idx]}</span>
                      {periodsPerDay[idx] > 0 && (
                        <span className="block text-xs font-normal text-gray-400">
                          {periodsPerDay[idx]} {t('weeklyPlan.hoursAbbrev')}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxPeriods }, (_, periodIdx) => (
                  <tr key={periodIdx}>
                    <td className="border border-gray-200 bg-gray-50 p-2 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                      {t('weeklyPlan.period')} {periodIdx + 1}
                    </td>
                    {[0, 1, 2, 3, 4].map(dayIdx => {
                      const slot = slots.find(
                        s => s.dayIdx === dayIdx && s.periodIdx === periodIdx,
                      );
                      const noClass = periodsPerDay[dayIdx] === 0 || periodIdx >= periodsPerDay[dayIdx];

                      if (noClass) {
                        return (
                          <td key={dayIdx} className="border border-gray-100 bg-gray-50/50 p-2 align-middle text-center">
                            {periodsPerDay[dayIdx] > 0 && (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </td>
                        );
                      }

                      if (!slot) {
                        return (
                          <td key={dayIdx} className="border border-gray-200 p-2 align-top">
                            <div className="min-h-[80px] flex items-center justify-center text-gray-300 text-xs border-2 border-dashed border-gray-200 rounded-lg">
                              {t('weeklyPlan.noLesson')}
                            </div>
                          </td>
                        );
                      }

                      const colorClass = TOPIC_COLORS[slot.topicIdx % TOPIC_COLORS.length];
                      const lessonTitle = thematicLessonMap[slot.lessonNumber];
                      return (
                        <td key={dayIdx} className="border border-gray-200 p-2 align-top">
                          <div
                            className={`rounded-lg border p-2 min-h-[80px] flex flex-col gap-1 ${colorClass}`}
                          >
                            <span className="text-[10px] font-bold uppercase opacity-60">
                              {t('weeklyPlan.lessonLabel')} {slot.lessonNumber}
                            </span>
                            <span className="text-sm font-semibold leading-tight flex-1">
                              {lessonTitle ?? slot.topicTitle}
                            </span>
                            {lessonTitle && (
                              <span className="text-[9px] opacity-50 italic">
                                📚 {slot.topicTitle}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleGenerateLesson(slot)}
                              className="no-print mt-1 self-start text-[10px] flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                              title={t('weeklyPlan.generateLessonTitle')}
                            >
                              <ICONS.sparkles className="w-3 h-3" />
                              {t('weeklyPlan.generateLessonButton')}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Topic legend ── */}
          {topicRanges.length > 1 && (
            <div className="no-print mt-6">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('weeklyPlan.topicsLegendTitle')}</p>
              <div className="flex flex-wrap gap-2">
                {topicRanges.map(r => {
                  const isCurrent = weekNumber >= r.weekStart && weekNumber <= r.weekEnd;
                  const colorClass = TOPIC_COLORS[r.topicIdx % TOPIC_COLORS.length];
                  return (
                    <button
                      key={r.topicIdx}
                      type="button"
                      onClick={() => setWeekNumber(r.weekStart)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${colorClass} ${
                        isCurrent ? 'ring-2 ring-offset-1 ring-current font-bold' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {r.topic.title}
                      <span className="ml-1 opacity-60">{t('weeklyPlan.weekAbbrev')}{r.weekStart}–{r.weekEnd}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Pedagogical enrichment ── */}
          {selectedPlan && (
            <div className="no-print mt-6">
              <PedagogicalEnrichPanel
                planType="weekly"
                planSummary={{
                  grade: selectedPlan.planData.grade ?? '',
                  title: `${t('weeklyPlan.weekPrefix')} ${weekNumber} — ${topicForWeek?.topic?.title ?? selectedPlan.subject}`,
                  topics: topicRanges.map(r => r.topic.title),
                  activities: Object.values(thematicLessonMap).filter(Boolean),
                  weeks: 1,
                }}
              />
            </div>
          )}

          {/* ── Weekly summary ── */}
          <div className="no-print mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{weeklyHours}</div>
              <div className="text-xs text-blue-500 mt-1">{t('weeklyPlan.stat.hoursThisWeek')}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">{slots.length}</div>
              <div className="text-xs text-emerald-500 mt-1">{t('weeklyPlan.stat.plannedLessons')}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{topicForWeek?.topicIdx != null ? topicForWeek.topicIdx + 1 : '—'}</div>
              <div className="text-xs text-amber-500 mt-1">{t('weeklyPlan.stat.topicOrder')}</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">{topicRanges.length}</div>
              <div className="text-xs text-purple-500 mt-1">{t('weeklyPlan.stat.totalTopics')}</div>
            </div>
          </div>
        </>
      )}

      {/* Parent Letter Modal */}
      {showParentLetter && topicForWeek && (
        <ParentLetterModal
          topicTitle={topicForWeek.topic.title}
          gradeLevel={selectedPlan?.planData.grade ? parseInt(String(selectedPlan.planData.grade), 10) || 6 : 6}
          objectives={topicForWeek.topic.objectives ?? []}
          weekNumber={weekNumber}
          onClose={() => setShowParentLetter(false)}
        />
      )}

      {/* Weekly Collab Modal */}
      {showCollabModal && firebaseUser?.uid && gradeObj && (
        <WeeklyCollabModal
          planId={`${firebaseUser.uid}_${gradeObj.id}_w${weekNumber}`}
          gradeId={gradeObj.id}
          weekNumber={weekNumber}
          ownerName={user?.name ?? t('common.teacher')}
          onViewShared={(plan, ownerName) => {
            setCollabSharedPlan({ plan, ownerName });
            setShowCollabModal(false);
          }}
          onClose={() => setShowCollabModal(false)}
        />
      )}

      {/* Collab shared plan banner */}
      {collabSharedPlan && (
        <div className="fixed bottom-4 right-4 z-40 bg-white rounded-2xl shadow-2xl border border-violet-200 p-4 max-w-xs w-full">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black text-violet-600 uppercase tracking-wide">{t('weeklyPlan.collabBanner.livePlanOf')} {collabSharedPlan.ownerName}</p>
              <p className="text-xs text-slate-600 mt-0.5">{t('weeklyPlan.weekAbbrev')} {collabSharedPlan.plan.weekNumber} · {collabSharedPlan.plan.slots.length} {t('weeklyPlan.hoursSuffixWord')}</p>
            </div>
            <button type="button" onClick={() => setCollabSharedPlan(null)} aria-label={t('common.close')} className="p-0.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
              <ICONS.close className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
