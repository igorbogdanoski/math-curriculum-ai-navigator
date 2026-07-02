import React from 'react';
import { X, Lightbulb, Loader2 } from 'lucide-react';
import { useLessonExecution, formatTime } from '../../hooks/useLessonExecution';
import { useAuth } from '../../contexts/AuthContext';
import type { LessonPlan } from '../../types';

interface LessonExecutionOverlayProps {
  plan: LessonPlan;
  onClose: () => void;
}

// Quick-launch buttons per phase
function PhaseActions({
  phaseKey,
  topic,
  grade,
}: {
  phaseKey: 'intro' | 'main' | 'conclusion';
  topic: string;
  grade: number;
}) {
  const enc = encodeURIComponent(topic);
  const base = `${window.location.origin}${window.location.pathname}`;

  const open = (hash: string) => window.open(`${base}${hash}`, '_blank', 'width=1280,height=820,resizable=yes,scrollbars=yes');

  if (phaseKey === 'intro') return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" onClick={() => open(`#/gamma?prefillTopic=${enc}&prefillGrade=${grade}`)}
        className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium transition">
        🎬 Gamma презентација
      </button>
      <button type="button" onClick={() => open(`#/kahoot/make?prefillTopic=${enc}&prefillGrade=${grade}`)}
        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-medium transition">
        🎮 Загревачки Kahoot
      </button>
    </div>
  );

  if (phaseKey === 'main') return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" onClick={() => open('#/math-tools')}
        className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 rounded-lg text-xs font-medium transition">
        🧮 Математички алатки
      </button>
      <button type="button" onClick={() => open(`#/dugga/build?topic=${enc}&grade=${grade}`)}
        className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-xs font-medium transition">
        📊 Dugga практика
      </button>
      <button type="button" onClick={() => open(`#/data-viz?tab=geo2d`)}
        className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-lg text-xs font-medium transition">
        📐 2D Геометрија
      </button>
      <button type="button" onClick={() => open(`#/data-viz?tab=algebra`)}
        className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-xs font-medium transition">
        🧩 Алгебарски плочки
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" onClick={() => open(`#/dugga/build?topic=${enc}&grade=${grade}&testType=custom`)}
        className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-medium transition">
        📋 Exit Ticket (3 прашања)
      </button>
      <button type="button" onClick={() => open(`#/kahoot/make?prefillTopic=${enc}&prefillGrade=${grade}`)}
        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-medium transition">
        🎮 Завршен Kahoot
      </button>
    </div>
  );
}

export const LessonExecutionOverlay: React.FC<LessonExecutionOverlayProps> = ({ plan, onClose }) => {
  const { firebaseUser } = useAuth();
  const ex = useLessonExecution(plan, firebaseUser?.uid);

  const topic = plan.theme || plan.title || '';
  const grade = plan.grade ?? 8;
  const scenarioByPhase = {
    intro: plan.scenario?.introductory?.text ?? '',
    main: plan.scenario?.main?.map(m => m.text).join(' · ') ?? '',
    conclusion: plan.scenario?.concluding?.text ?? '',
  };

  const handleCloseGuard = () => {
    if (ex.classStarted && !ex.classEnded) {
      if (!window.confirm('Часот е во тек. Сигурно сакаш да го затвориш?')) return;
    }
    onClose();
  };

  // ── End-of-class screen ─────────────────────────────────────────────────────
  if (ex.classEnded) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 overflow-y-auto flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          {/* Summary card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-2xl font-bold text-slate-700 mb-1">Часот е завршен!</h2>
            <p className="text-slate-500 text-sm mb-6">{topic} · {grade}. одд.</p>

            <div className="bg-emerald-50 rounded-xl p-4 mb-6">
              <p className="text-emerald-700 font-semibold text-sm">
                ✓ {ex.completedPhases.size}/{ex.phases.length} фази реализирани
              </p>
              {ex.isSavingExecution && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Зачувувам извештај…
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button type="button" onClick={onClose}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition">
                Назад кон планот
              </button>
            </div>
          </div>

          {/* AI adaptive suggestions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-800 text-sm">Препораки за следниот час</h3>
            </div>
            {ex.loadingAI && !ex.aiSuggestion && (
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Генерирам адаптивни препораки…</span>
              </div>
            )}
            {ex.aiSuggestion && (
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{ex.aiSuggestion}</p>
            )}
            {!ex.loadingAI && !ex.aiSuggestion && (
              <p className="text-xs text-amber-600 italic">Препораките ќе се прикажат откако ќе заврши зачувувањето.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main execution overlay ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col overflow-hidden">
      {/* ── Sticky header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="font-bold text-slate-800 text-base leading-tight truncate">{topic}</h1>
            <p className="text-xs text-slate-500">{grade}. одд.</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Progress bar */}
            {ex.classStarted && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary rounded-full transition-all duration-500"
                    style={{ width: `${ex.progressPct}%` }} />
                </div>
                <span className="text-xs text-slate-500 tabular-nums">{ex.progressPct}%</span>
              </div>
            )}

            {/* Controls */}
            {!ex.classStarted ? (
              <button type="button" onClick={ex.handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white rounded-xl font-semibold text-sm shadow transition">
                <span>▶</span> Стартувај час
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={ex.handlePauseResume}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">
                  {ex.timerRunning ? '⏸ Пауза' : '▶ Продолжи'}
                </button>
                {ex.activePhaseIdx < ex.phases.length - 1 && (
                  <button type="button" onClick={ex.handleNextPhase}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">
                    Следна →
                  </button>
                )}
                <button type="button" onClick={ex.handleEndClass}
                  className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition">
                  ■ Заврши
                </button>
              </div>
            )}

            {/* Close */}
            <button type="button" onClick={handleCloseGuard}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Phase cards ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {!ex.classStarted && (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4 text-sm text-sky-700 font-medium text-center">
              Кликни <strong>▶ Стартувај час</strong> за да го почнеш тајмерот.
            </div>
          )}

          {ex.phases.map((phase, idx) => {
            const isActive    = ex.classStarted && ex.activePhaseIdx === idx;
            const isCompleted = ex.completedPhases.has(idx);

            return (
              <div key={phase.key}
                className={`rounded-2xl border-2 p-4 transition-all ${
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
                      <p className="text-xs text-slate-500">{phase.minutes} мин</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className={`text-2xl font-mono font-black tabular-nums ${phase.textColor}`}>
                        {formatTime(ex.secondsLeft)}
                      </span>
                    )}
                    {isCompleted && <span className="text-emerald-600 text-lg font-bold">✓</span>}
                    {!isActive && !isCompleted && ex.classStarted && (
                      <button type="button" onClick={() => ex.handleActivatePhase(idx)}
                        className="text-xs text-slate-500 hover:text-brand-primary underline">
                        Активирај
                      </button>
                    )}
                  </div>
                </div>

                {/* Phase scenario text */}
                {scenarioByPhase[phase.key] && (
                  <p className="text-sm text-slate-600 line-clamp-3 bg-white/60 rounded-xl p-2.5 mb-2">
                    {scenarioByPhase[phase.key]}
                  </p>
                )}

                {isActive && (
                  <PhaseActions phaseKey={phase.key} topic={topic} grade={grade} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
