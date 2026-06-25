import { logger } from '../utils/logger';
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePlanning } from '../contexts/PlanningContext';
import { Card } from '../components/common/Card';
import type { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../types';

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

const MK_DAYS = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок'];
const MK_DAYS_SHORT = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет'];

const WEEK_TO_MONTH: Record<number, string> = {
  1: 'Септември', 2: 'Септември', 3: 'Септември', 4: 'Септември',
  5: 'Октомври',  6: 'Октомври',  7: 'Октомври',  8: 'Октомври',
  9: 'Ноември',  10: 'Ноември', 11: 'Ноември',  12: 'Ноември',
  13: 'Декември', 14: 'Декември', 15: 'Декември', 16: 'Декември',
  17: 'Јануари',  18: 'Јануари',  19: 'Јануари',  20: 'Јануари',
  21: 'Февруари', 22: 'Февруари', 23: 'Февруари', 24: 'Февруари',
  25: 'Март',     26: 'Март',     27: 'Март',     28: 'Март',
  29: 'Април',    30: 'Април',    31: 'Април',    32: 'Април',
  33: 'Мај',      34: 'Мај',      35: 'Мај',      36: 'Јуни',
};

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
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();
  const { annualPlanId, grade, setPlanningState } = usePlanning();

  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(annualPlanId ?? '');
  const [weekNumber, setWeekNumber] = useState(1);
  const [showScheduleConfig, setShowScheduleConfig] = useState(false);
  const [periodsPerDay, setPeriodsPerDay] = useState<[number, number, number, number, number]>([1, 1, 1, 1, 0]);

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
            )
          : query(collection(db, 'academic_annual_plans'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedPlan));
        setPlans(loaded);
        if (!selectedPlanId && loaded.length > 0) {
          setSelectedPlanId(loaded[0].id);
        }
      } catch (err) {
        logger.error('WeeklyPlanView: load plans error', err);
        addNotification('Грешка при вчитување на плановите.', 'error');
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

  const handleGenerateLesson = (slot: WeeklySlot) => {
    if (!selectedPlan) return;
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
    navigate(`/planner/lesson/new?${params.toString()}`);
  };

  const handlePeriodChange = (dayIdx: number, delta: number) => {
    setPeriodsPerDay(prev => {
      const next: [number, number, number, number, number] = [...prev] as [number, number, number, number, number];
      next[dayIdx] = Math.max(0, Math.min(4, next[dayIdx] + delta));
      return next;
    });
  };

  const handlePrint = () => window.print();

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

      {/* ── Header ── */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ICONS.calendar className="w-8 h-8 text-brand-primary flex-shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Неделен план</h1>
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
              aria-label="Избери годишен план"
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
              Недела {weekNumber}
            </span>
            <button
              type="button"
              onClick={() => setWeekNumber(w => Math.min(36, w + 1))}
              className="px-3 py-2 hover:bg-gray-100 transition-colors text-gray-700"
              disabled={weekNumber >= 36}
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
            Распоред
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-secondary"
          >
            <ICONS.printer className="w-4 h-4" />
            Испечати
          </button>
        </div>
      </div>

      {/* ── Period info bar ── */}
      <div className="no-print flex items-center gap-3 mb-4 text-sm text-gray-600">
        <ICONS.calendar className="w-4 h-4 text-gray-400" />
        <span>
          <strong>{WEEK_TO_MONTH[weekNumber] ?? 'Недела'}</strong>
          {' · '}Недела {weekNumber} од 36
          {' · '}
          <strong>{weeklyHours} ч/нед.</strong>
        </span>
        {topicForWeek && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">·</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${TOPIC_COLORS[topicForWeek.topicIdx % TOPIC_COLORS.length]}`}
            >
              {topicForWeek.topic.title}
            </span>
            <span className="text-gray-400 text-xs">
              (Нед. {topicForWeek.weekStart}–{topicForWeek.weekEnd})
            </span>
          </span>
        )}
      </div>

      {/* ── Schedule config panel ── */}
      {showScheduleConfig && (
        <Card className="no-print mb-4 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Број на часови по ден (вкупно: {weeklyHours} ч/нед.)
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
          Вчитување на плановите...
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center">
          <ICONS.calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Немате зачувани годишни планови.</p>
          <button
            type="button"
            onClick={() => navigate('/annual-planner')}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm"
          >
            Создај годишна програма
          </button>
        </Card>
      ) : !selectedPlan ? null : (
        <>
          {/* ── Print header (visible only on print) ── */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold text-center">НЕДЕЛЕН НАСТАВЕН ПЛАН</h1>
            <p className="text-center text-sm">
              {selectedPlan.subject} | {selectedPlan.grade} | Недела {weekNumber} | {WEEK_TO_MONTH[weekNumber]}
            </p>
          </div>

          {/* ── Weekly grid ── */}
          <div className="overflow-x-auto">
            <table className="weekly-grid-table w-full border-collapse min-w-[600px]">
              <colgroup>
                <col className="w-20" />
                {MK_DAYS.map(d => <col key={d} />)}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="border border-gray-300 bg-gray-50 p-2 text-xs text-gray-500 font-medium">Час</th>
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
                          {periodsPerDay[idx]} ч.
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
                      Час {periodIdx + 1}
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
                              Нема лекција
                            </div>
                          </td>
                        );
                      }

                      const colorClass = TOPIC_COLORS[slot.topicIdx % TOPIC_COLORS.length];
                      return (
                        <td key={dayIdx} className="border border-gray-200 p-2 align-top">
                          <div
                            className={`rounded-lg border p-2 min-h-[80px] flex flex-col gap-1 ${colorClass}`}
                          >
                            <span className="text-[10px] font-bold uppercase opacity-60">
                              Лекција {slot.lessonNumber}
                            </span>
                            <span className="text-sm font-semibold leading-tight flex-1">
                              {slot.topicTitle}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleGenerateLesson(slot)}
                              className="no-print mt-1 self-start text-[10px] flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                              title="Генерирај подготовка за овој час"
                            >
                              <ICONS.sparkles className="w-3 h-3" />
                              Генерирај час
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
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Теми во годишниот план</p>
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
                      <span className="ml-1 opacity-60">Нед.{r.weekStart}–{r.weekEnd}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Weekly summary ── */}
          <div className="no-print mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{weeklyHours}</div>
              <div className="text-xs text-blue-500 mt-1">Часови оваа недела</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
              <div className="text-2xl font-bold text-emerald-700">{slots.length}</div>
              <div className="text-xs text-emerald-500 mt-1">Планирани лекции</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{topicForWeek?.topicIdx != null ? topicForWeek.topicIdx + 1 : '—'}</div>
              <div className="text-xs text-amber-500 mt-1">Тема по ред</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
              <div className="text-2xl font-bold text-purple-700">{topicRanges.length}</div>
              <div className="text-xs text-purple-500 mt-1">Вкупно теми</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
