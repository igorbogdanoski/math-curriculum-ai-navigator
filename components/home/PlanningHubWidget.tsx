import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { usePlanning } from '../../contexts/PlanningContext';
import { usePlanner } from '../../contexts/PlannerContext';
import type { AIGeneratedAnnualPlan } from '../../types';

interface SavedPlan {
  id: string;
  grade: string;
  subject: string;
  planData: AIGeneratedAnnualPlan;
}

// Returns the current school week (1-based), or 0 if outside the school year.
function getCurrentSchoolWeek(): number {
  const now = new Date();
  const year = now.getFullYear();
  // School year starts September 1st
  const yearStart = now.getMonth() < 8 ? year - 1 : year;
  const start = new Date(yearStart, 8, 1);
  const diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.min(36, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function computePlanProgress(plan: AIGeneratedAnnualPlan, currentWeek: number): { done: number; total: number; pct: number } {
  const topics = plan.topics ?? [];
  const totalWeeks = plan.totalWeeks || topics.reduce((s, t) => s + (t.durationWeeks ?? 1), 0) || 36;
  let cumWeek = 0;
  let doneTopics = 0;
  for (const t of topics) {
    cumWeek += t.durationWeeks ?? 1;
    if (cumWeek < currentWeek) doneTopics++;
  }
  const pct = totalWeeks > 0 ? Math.round((currentWeek / totalWeeks) * 100) : 0;
  return { done: doneTopics, total: topics.length, pct: Math.min(100, pct) };
}

export const PlanningHubWidget: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { annualPlanId } = usePlanning();
  const { todaysLesson, tomorrowsLesson } = usePlanner();
  const [latestPlan, setLatestPlan] = useState<SavedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentWeek = getCurrentSchoolWeek();

  useEffect(() => {
    if (!firebaseUser?.uid) { setIsLoading(false); return; }
    (async () => {
      try {
        const q = query(
          collection(db, 'academic_annual_plans'),
          where('userId', '==', firebaseUser.uid),
          orderBy('createdAt', 'desc'),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          setLatestPlan({ id: d.id, ...(d.data() as Omit<SavedPlan, 'id'>) });
        }
      } catch {
        // silently fail — widget is non-critical
      } finally {
        setIsLoading(false);
      }
    })();
  }, [firebaseUser?.uid]);

  const nextLesson = todaysLesson ?? tomorrowsLesson;
  const progress = latestPlan ? computePlanProgress(latestPlan.planData, currentWeek) : null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse h-28">
        <div className="h-3 bg-slate-100 rounded w-1/4 mb-3" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
    );
  }

  // Only show if user has set up something
  if (!latestPlan && !nextLesson && currentWeek === 0) return null;

  const pct = progress?.pct ?? 0;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-blue-500' : 'bg-amber-400';

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
          Планирачки Центар
        </p>
        <span className="text-[10px] font-bold text-slate-400">
          {currentWeek > 0 ? `Недела ${currentWeek} / 36` : 'Надвор од учебна година'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Annual plan progress */}
        <button
          type="button"
          onClick={() => navigate('/annual-planner')}
          className="flex flex-col gap-1 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
        >
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <span>📅</span> Годишна програма
          </span>
          {latestPlan ? (
            <>
              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                {latestPlan.subject} — {latestPlan.grade}
              </p>
              <div className="mt-1">
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>{progress?.done} / {progress?.total} теми</span>
                  <span className="font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-indigo-600 font-semibold mt-1 group-hover:underline">
              + Генерирај годишна →
            </p>
          )}
        </button>

        {/* Next lesson */}
        <button
          type="button"
          onClick={() => navigate(nextLesson?.lessonPlanId ? `/planner/lesson/${nextLesson.lessonPlanId}` : '/planner/lesson/new')}
          className="flex flex-col gap-1 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
        >
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <span>✏️</span> {todaysLesson ? 'Час денес' : 'Следен час'}
          </span>
          {nextLesson ? (
            <p className="text-xs font-bold text-slate-800 line-clamp-2 group-hover:text-indigo-700 transition-colors">
              {nextLesson.title}
            </p>
          ) : (
            <p className="text-xs text-indigo-600 font-semibold mt-1 group-hover:underline">
              + Нова подготовка →
            </p>
          )}
        </button>

        {/* Weekly plan link */}
        <button
          type="button"
          onClick={() => navigate('/weekly-plan')}
          className="flex flex-col gap-1 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
        >
          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
            <span>🗓</span> Неделен план
          </span>
          <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
            {currentWeek > 0 ? `Недела ${currentWeek}` : 'Отвори планер'}
          </p>
          <p className="text-[10px] text-slate-400">
            {annualPlanId ? 'Распореди часови →' : 'Прво генерирај годишна →'}
          </p>
        </button>
      </div>

      {/* Standards coverage shortcut */}
      {latestPlan && (
        <button
          type="button"
          onClick={() => navigate('/standards-coverage')}
          className="mt-3 w-full flex items-center justify-between rounded-xl bg-indigo-600/5 border border-indigo-100 px-3 py-2 text-left hover:bg-indigo-50 transition group"
        >
          <span className="text-xs font-bold text-indigo-700">🎯 Провери БРО покриеност на стандардите →</span>
          <span className="text-[10px] text-indigo-400 group-hover:text-indigo-600">27 стандарди</span>
        </button>
      )}
    </div>
  );
};
