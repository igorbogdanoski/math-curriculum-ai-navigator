/**
 * S98.1 — ClassroomView
 *
 * "Start Class" execution hub. Loaded from /classroom/:lessonPlanId.
 * Shows the 3-phase lesson structure (Вовод / Главен дел / Завршница) with:
 *  - Countdown timer auto-split by phase minutes
 *  - Scenario text from the saved lesson plan
 *  - Quick-launch buttons per phase (Gamma, Kahoot, Dugga, Math tools)
 *  - "End Class" → triggers post-class summary (S98.2)
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { usePlanner } from '../contexts/PlannerContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { getGradeHoursInfo } from '../services/gemini/plans';
import { saveClassroomExecution } from '../services/firestoreService.classroom';
import { Card } from '../components/common/Card';
import { Loader2, Lightbulb } from 'lucide-react';

interface ClassroomViewProps {
  lessonPlanId?: string;
}

// ── Phase config ──────────────────────────────────────────────────────────────

export interface PhaseConfig {
  key: 'intro' | 'main' | 'conclusion';
  label: string;
  emoji: string;
  minutes: number;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export function buildPhases(lessonMinutes: number): PhaseConfig[] {
  const intro = Math.round(lessonMinutes * 0.25);           // ~25%
  const conclusion = 5;                                      // always 5 min
  const main = lessonMinutes - intro - conclusion;           // rest

  return [
    {
      key: 'intro',
      label: 'Вовод',
      emoji: '🎯',
      minutes: intro,
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-300',
      textColor: 'text-sky-700',
    },
    {
      key: 'main',
      label: 'Главен дел',
      emoji: '📚',
      minutes: main,
      bgColor: 'bg-brand-primary/5',
      borderColor: 'border-brand-primary/30',
      textColor: 'text-brand-primary',
    },
    {
      key: 'conclusion',
      label: 'Завршница',
      emoji: '✅',
      minutes: conclusion,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-300',
      textColor: 'text-emerald-700',
    },
  ];
}

// ── Timer helpers ─────────────────────────────────────────────────────────────

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Phase action buttons per phase ────────────────────────────────────────────

function PhaseActions({
  phaseKey,
  topic,
  grade,
  onNavigate,
}: {
  phaseKey: 'intro' | 'main' | 'conclusion';
  topic: string;
  grade: number;
  onNavigate: (path: string) => void;
}) {
  const encoded = encodeURIComponent(topic);

  if (phaseKey === 'intro') {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => onNavigate(`/gamma?prefillTopic=${encoded}&prefillGrade=${grade}`)}
          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium transition-colors"
        >
          🎬 Gamma презентација
        </button>
        <button
          type="button"
          onClick={() => onNavigate(`/kahoot/make?prefillTopic=${encoded}&prefillGrade=${grade}`)}
          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-medium transition-colors"
        >
          🎮 Загревачки Kahoot
        </button>
      </div>
    );
  }

  if (phaseKey === 'main') {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => onNavigate('/math-tools')}
          className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg text-xs font-medium transition-colors"
        >
          🧮 Математички алатки
        </button>
        <button
          type="button"
          onClick={() => onNavigate(`/dugga/build?topic=${encoded}&grade=${grade}`)}
          className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-xs font-medium transition-colors"
        >
          📊 Dugga практика
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/geometry-2d')}
          className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-lg text-xs font-medium transition-colors"
        >
          📐 Геометрија лаб
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <button
        type="button"
        onClick={() => onNavigate(`/dugga/build?topic=${encoded}&grade=${grade}&testType=custom`)}
        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-medium transition-colors"
      >
        📋 Exit Ticket (3 прашања)
      </button>
      <button
        type="button"
        onClick={() => onNavigate(`/kahoot/make?prefillTopic=${encoded}&prefillGrade=${grade}`)}
        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-medium transition-colors"
      >
        🎮 Завршен Kahoot
      </button>
    </div>
  );
}

// ── Phase card ────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  scenarioText,
  isActive,
  isCompleted,
  remainingSeconds,
  topic,
  grade,
  onNavigate,
  onActivate,
}: {
  phase: PhaseConfig;
  scenarioText: string;
  isActive: boolean;
  isCompleted: boolean;
  remainingSeconds: number;
  topic: string;
  grade: number;
  onNavigate: (path: string) => void;
  onActivate: () => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-all ${
        isActive
          ? `${phase.bgColor} ${phase.borderColor} shadow-md`
          : isCompleted
          ? 'bg-slate-50 border-slate-200 opacity-60'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{phase.emoji}</span>
          <div>
            <h3 className={`font-bold text-base ${isActive ? phase.textColor : 'text-slate-700'}`}>
              {phase.label}
            </h3>
            <p className="text-xs text-slate-500">{phase.minutes} минути</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <span className={`text-2xl font-mono font-bold tabular-nums ${phase.textColor}`}>
              {formatTime(remainingSeconds)}
            </span>
          )}
          {isCompleted && (
            <span className="text-emerald-600 text-lg">✓</span>
          )}
          {!isActive && !isCompleted && (
            <button
              type="button"
              onClick={onActivate}
              className="text-xs text-slate-500 hover:text-brand-primary underline"
            >
              Активирај
            </button>
          )}
        </div>
      </div>

      {scenarioText && (
        <p className="text-sm text-slate-600 line-clamp-3 mb-2 bg-white/60 rounded-lg p-2">
          {scenarioText}
        </p>
      )}

      {isActive && (
        <PhaseActions
          phaseKey={phase.key}
          topic={topic}
          grade={grade}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ── Main ClassroomView ────────────────────────────────────────────────────────

export const ClassroomView: React.FC<ClassroomViewProps> = ({ lessonPlanId }) => {
  const { getLessonPlan } = usePlanner();
  const { navigate } = useNavigation();
  const { firebaseUser } = useAuth();

  const plan = lessonPlanId ? getLessonPlan(lessonPlanId) : undefined;
  const { lessonMinutes } = getGradeHoursInfo(plan?.grade ?? 8);
  // useMemo prevents phases from being a new array reference on every render
  const phases = useMemo(() => buildPhases(lessonMinutes), [lessonMinutes]);

  // Timer state
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(phases[0].minutes * 60);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());
  const [classStarted, setClassStarted] = useState(false);
  const [classEnded, setClassEnded] = useState(false);
  const [isSavingExecution, setIsSavingExecution] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const isMounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  // Reset timer when phase changes (phases is stable via useMemo)
  useEffect(() => {
    setSecondsLeft(phases[activePhaseIdx].minutes * 60);
  }, [activePhaseIdx, phases]);

  // Countdown
  useEffect(() => {
    if (!timerRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Phase done — auto-advance
          setCompletedPhases(cp => new Set([...cp, activePhaseIdx]));
          if (activePhaseIdx < phases.length - 1) {
            setActivePhaseIdx(i => i + 1);
          } else {
            setTimerRunning(false);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, activePhaseIdx, phases.length]);

  const handleStart = useCallback(() => {
    setClassStarted(true);
    setTimerRunning(true);
  }, []);

  const handlePauseResume = useCallback(() => {
    setTimerRunning(r => !r);
  }, []);

  const handleNextPhase = useCallback(() => {
    setCompletedPhases(cp => new Set([...cp, activePhaseIdx]));
    if (activePhaseIdx < phases.length - 1) {
      setActivePhaseIdx(i => i + 1);
      setTimerRunning(true);
    }
  }, [activePhaseIdx, phases.length]);

  const handleActivatePhase = useCallback((idx: number) => {
    setActivePhaseIdx(idx);
    setSecondsLeft(phases[idx].minutes * 60);
    if (classStarted) setTimerRunning(true);
  }, [phases, classStarted]);

  const handleEndClass = useCallback(async () => {
    setTimerRunning(false);
    setClassEnded(true);

    const topic = plan?.theme || plan?.title || '';
    const grade = plan?.grade ?? 8;

    if (plan && firebaseUser) {
      setIsSavingExecution(true);
      try {
        await saveClassroomExecution({
          lessonPlanId: plan.id ?? '',
          teacherUid: firebaseUser.uid,
          grade,
          topic,
          phasesCompleted: completedPhases.size,
          totalPhases: phases.length,
        });
      } catch { /* non-critical */ }
      finally { setIsSavingExecution(false); }
    }

    // S99.2 / S103-B — AI adaptive suggestion enriched with coverage gaps
    if (topic) {
      setLoadingAI(true);
      try {
        const { geminiService } = await import('../services/geminiService');
        const completion = completedPhases.size === phases.length ? 'целосно' : `${completedPhases.size}/${phases.length} фази`;

        // Build coverage gap context for primary grades
        let gapContext = '';
        const gradeNum = grade as number;
        if (!isNaN(gradeNum) && gradeNum <= 9) {
          const { detectCurriculumGaps } = await import('../utils/curriculumGapDetector');
          const topicTitles = [plan?.theme, plan?.title, plan?.topicId].filter(Boolean) as string[];
          if (topicTitles.length > 0) {
            const gaps = detectCurriculumGaps(topicTitles, gradeNum);
            if (gaps.uncovered.length > 0) {
              const topGaps = gaps.uncovered.slice(0, 3).map(s => s.description).join('; ');
              gapContext = `\nНепокриени БРО стандарди (топ 3): ${topGaps}.`;
            }
          }
        }

        const prompt = `Наставникот го заврши часот по "${topic}" (${grade}. одделение). Реализирано: ${completion}.${gapContext}
Дај точно 3 краткорочни препораки за следниот час (до 150 збора, на македонски). Форматирај со: "1. … 2. … 3. …". Препораките треба да покриваат: (а) што да се повтори или задлабочи врз основа на непокриените стандарди, (б) каква брза проверка (Exit ticket / Dugga тест / Kahoot), (в) еден нов педагошки пристап или активност.`;
        let text = '';
        for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
          text += chunk;
          if (isMounted.current) setAiSuggestion(text);
        }
      } catch {
        if (isMounted.current) setAiSuggestion('Не можев да генерирам препораки. Обиди се повторно.');
      } finally {
        if (isMounted.current) setLoadingAI(false);
      }
    }
  }, [plan, firebaseUser, completedPhases, phases.length]);

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <p className="text-4xl mb-4">🏫</p>
          <h2 className="text-xl font-bold text-slate-700 mb-2">
            {lessonPlanId ? 'Планот не е пронајден' : 'Нема избран план'}
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Отиди во Подготовка за час и кликни „▶ Стартувај час".
          </p>
          <button
            type="button"
            onClick={() => navigate('/planner/lesson')}
            className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium"
          >
            Кон подготовка за час
          </button>
        </Card>
      </div>
    );
  }

  const topic = plan.theme || plan.title || '';
  const grade = plan.grade ?? 8;
  const totalElapsed =
    completedPhases.size > 0
      ? phases.slice(0, activePhaseIdx).reduce((s, p) => s + p.minutes * 60, 0) +
        (phases[activePhaseIdx].minutes * 60 - secondsLeft)
      : 0;
  const totalSeconds = phases.reduce((s, p) => s + p.minutes * 60, 0);
  const progressPct = Math.round((totalElapsed / totalSeconds) * 100);

  const scenarioByPhase = {
    intro: plan.scenario?.introductory?.text ?? '',
    main: plan.scenario?.main?.map(m => m.text).join(' · ') ?? '',
    conclusion: plan.scenario?.concluding?.text ?? '',
  };

  // ── Class ended screen ─────────────────────────────────────────────────────

  if (classEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <Helmet>
          <title>Завршен час — {topic}</title>
        </Helmet>
        <div className="w-full max-w-lg space-y-4">
          <Card className="p-8 text-center">
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-2xl font-bold text-slate-700 mb-1">Часот е завршен!</h2>
            <p className="text-slate-500 text-sm mb-6">{topic} · {grade}. одд.</p>
            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <p className="text-emerald-700 font-semibold text-sm">
                ✓ {completedPhases.size}/{phases.length} фази реализирани
              </p>
              {isSavingExecution && (
                <p className="text-xs text-emerald-600 mt-1">Зачувувам извештај…</p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate(`/planner/lesson/${plan.id}`)}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium"
              >
                Назад кон планот
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium"
              >
                Почетна
              </button>
            </div>
          </Card>

          {/* S99.2 — Adaptive AI suggestion */}
          <Card className="p-5 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-800 text-sm">Препораки за следниот час</h3>
            </div>
            {loadingAI && !aiSuggestion && (
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Генерирам адаптивни препораки…</span>
              </div>
            )}
            {aiSuggestion && (
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
            )}
            {!loadingAI && !aiSuggestion && (
              <p className="text-xs text-amber-600 italic">Препораките ќе се прикажат откако ќе заврши зачувувањето.</p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── Main classroom UI ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>🏫 {topic} — Реализација на час</title>
      </Helmet>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800 text-base leading-tight">{topic}</h1>
            <p className="text-xs text-slate-500">{grade}. одд. · {lessonMinutes} мин</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Overall progress */}
            {classStarted && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{progressPct}%</span>
              </div>
            )}

            {!classStarted ? (
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white rounded-xl font-semibold text-sm shadow transition-colors"
              >
                <span>▶</span> Стартувај час
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePauseResume}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {timerRunning ? '⏸ Пауза' : '▶ Продолжи'}
                </button>
                {activePhaseIdx < phases.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextPhase}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Следна фаза →
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleEndClass}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors border border-red-200"
                >
                  ■ Заврши час
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase cards */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {!classStarted && (
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-4 text-center">
            <p className="text-brand-primary font-semibold text-sm">
              🏫 Кликни „▶ Стартувај час" за да го стартираш тајмерот
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Тајмерот автоматски ги следи фазите · Вкупно {lessonMinutes} мин
            </p>
          </div>
        )}

        {phases.map((phase, idx) => (
          <PhaseCard
            key={phase.key}
            phase={phase}
            scenarioText={scenarioByPhase[phase.key]}
            isActive={classStarted && activePhaseIdx === idx}
            isCompleted={completedPhases.has(idx)}
            remainingSeconds={activePhaseIdx === idx ? secondsLeft : phase.minutes * 60}
            topic={topic}
            grade={grade}
            onNavigate={navigate}
            onActivate={() => handleActivatePhase(idx)}
          />
        ))}

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          {[
            { label: '📊 Dugga тест', path: `/dugga/build?topic=${encodeURIComponent(topic)}&grade=${grade}` },
            { label: '🎮 Kahoot', path: `/kahoot/make?prefillTopic=${encodeURIComponent(topic)}&prefillGrade=${grade}` },
            { label: '🧮 Алатки', path: '/math-tools' },
            { label: '📊 DataViz', path: '/data-viz' },
          ].map(btn => (
            <button
              key={btn.path}
              type="button"
              onClick={() => navigate(btn.path)}
              className="px-3 py-2 bg-white border border-slate-200 hover:border-brand-primary hover:text-brand-primary rounded-xl text-xs font-medium text-slate-600 transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
