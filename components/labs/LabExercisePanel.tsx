import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Lightbulb, ChevronRight, RotateCcw, Shuffle, Trophy, Save, TrendingUp, TrendingDown } from 'lucide-react';
import type { useLabSession } from '../../hooks/useLabSession';
import { CURRICULUM_STANDARD_MAP } from '../../types/labTypes';

type LabSession = ReturnType<typeof useLabSession>;

interface LabExercisePanelProps {
  session: LabSession;
  /** Called when user clicks "Нов сет" — generate fresh exercises */
  onNewSet: (difficulty?: 1 | 2 | 3) => void;
  /** Current difficulty selection (controlled externally) */
  difficulty?: 1 | 2 | 3;
  onDifficultyChange?: (d: 1 | 2 | 3) => void;
  /** Optional: extra action buttons shown in the toolbar */
  headerSlot?: React.ReactNode;
}

const DIFF_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Основно',
  2: 'Средно',
  3: 'Напредно',
};
const DIFF_COLORS: Record<1 | 2 | 3, string> = {
  1: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  2: 'bg-amber-100  text-amber-700  border-amber-300',
  3: 'bg-red-100    text-red-700    border-red-300',
};

// ─── Stored name ──────────────────────────────────────────────────────────────
function getStoredName(): string {
  try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
}

function getScoreColor(pct: number): string {
  return pct >= 90 ? 'text-emerald-700' : pct >= 70 ? 'text-indigo-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600';
}

// ─── Continue banner — "Продолжи" ──────────────────────────────────────────────
function ContinueBanner({ labId }: { labId: string }) {
  const { data: lastSession } = useQuery({
    queryKey: ['lastLabSession', labId],
    queryFn: async () => {
      const { firestoreService } = await import('../../services/firestoreService');
      return firestoreService.fetchLastLabSession(labId);
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!lastSession) return null;
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-800 mb-3">
      Минатиот пат: <strong>{lastSession.score}/{lastSession.totalQuestions}</strong>
      {lastSession.difficulty && <> на ниво <strong>{lastSession.difficulty}</strong></>} ·
      <span className={`font-bold ${getScoreColor(lastSession.percentage)}`}> {lastSession.percentage}%</span>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total, correct }: { current: number; total: number; correct: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">{current + 1}/{total}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${Math.round((current / Math.max(total, 1)) * 100)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{correct} точни · {pct}%</span>
    </div>
  );
}

// ─── Difficulty hint ─────────────────────────────────────────────────────────
function DifficultyNudge({ streak }: { streak: { correct: number; wrong: number } }) {
  if (streak.correct >= 3) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        3 точни по ред — сакаш потешко ниво?
      </div>
    );
  }
  if (streak.wrong >= 2) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
        <TrendingDown className="w-3.5 h-3.5" />
        2 грешки — сакаш полесно ниво?
      </div>
    );
  }
  return null;
}

// ─── Answer input ─────────────────────────────────────────────────────────────
function AnswerInput({ session }: { session: LabSession }) {
  const { currentEx, userAnswer, setUserAnswer, submitted, submitAnswer } = session;
  if (!currentEx) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitted && userAnswer.trim()) submitAnswer();
  };

  if (currentEx.type === 'multiple_choice' && currentEx.options) {
    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {currentEx.options.map(opt => {
          const selected = userAnswer === opt;
          const isCorrect = opt === currentEx.correctAnswer;
          let cls = 'border-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-left transition-all cursor-pointer ';
          if (!submitted) {
            cls += selected
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 hover:border-indigo-300 text-gray-700 hover:bg-indigo-50';
          } else {
            if (isCorrect)    cls += 'border-emerald-500 bg-emerald-50 text-emerald-800';
            else if (selected) cls += 'border-red-400 bg-red-50 text-red-800';
            else               cls += 'border-gray-200 text-gray-400';
          }
          return (
            <button
              key={opt}
              type="button"
              disabled={submitted}
              onClick={() => setUserAnswer(opt)}
              className={cls}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  // numeric or fill_blank
  return (
    <div className="mt-4 flex gap-2">
      <input
        type="text"
        inputMode={currentEx.type === 'numeric' ? 'decimal' : 'text'}
        value={userAnswer}
        onChange={e => setUserAnswer(e.target.value)}
        onKeyDown={handleKey}
        disabled={submitted}
        placeholder={currentEx.type === 'numeric' ? 'Внеси број...' : 'Внеси одговор...'}
        className="flex-1 border-2 border-gray-300 rounded-xl px-4 py-2.5 text-base font-mono focus:border-indigo-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
        aria-label="Одговор"
      />
    </div>
  );
}

// ─── Session done screen ──────────────────────────────────────────────────────
function SessionDoneScreen({ session, onNewSet, difficulty, onDifficultyChange }: {
  session: LabSession;
  onNewSet: (d?: 1 | 2 | 3) => void;
  difficulty?: 1 | 2 | 3;
  onDifficultyChange?: (d: 1 | 2 | 3) => void;
}) {
  const { score, exercises, hintsUsed, saving, saveError, saveSession, resetSession, correctHistory } = session;
  const [name, setName] = useState(getStoredName);
  const [saved, setSaved] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pct = exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0;
  const emoji = pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : pct >= 50 ? '👍' : '📚';
  const weakQuestions = exercises.filter((_, i) => correctHistory[i] === false);
  const coveredStandards = [...new Set(exercises.map(e => e.curriculumRef))];

  const handleSave = async () => {
    setRetrying(false);
    await saveSession(name);
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-5 items-center py-6 px-4">
      <div className="text-5xl">{emoji}</div>
      <div className="text-center">
        <p className="text-2xl font-extrabold text-gray-800">
          {score}/{exercises.length} <span className="text-gray-500 text-base font-semibold">({pct}%)</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Hints употребени: {hintsUsed}
          {pct >= 90 && <span className="ml-2 text-emerald-600 font-bold">Одличен резултат!</span>}
        </p>
      </div>

      {weakQuestions.length > 0 && (
        <div className="w-full max-w-sm bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
          <p className="font-bold text-amber-800 mb-1">Области за понатамошна работа:</p>
          {weakQuestions.slice(0, 3).map((q, i) => (
            <p key={i} className="text-amber-700 truncate">· {q.question}</p>
          ))}
        </div>
      )}

      {coveredStandards.length > 0 && (
        <div className="w-full max-w-sm bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs">
          <p className="font-bold text-indigo-700 mb-1">Покриени наставни единици:</p>
          <div className="flex flex-wrap gap-1">
            {coveredStandards.map(s => (
              <span key={s} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-semibold">
                {CURRICULUM_STANDARD_MAP[s] ?? s}
              </span>
            ))}
          </div>
        </div>
      )}

      {!saved ? (
        <div className="w-full max-w-sm space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Твоето Иme</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Внеси го своето Иme..."
              className="flex-1 border-2 border-gray-300 rounded-xl px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              aria-label="Иme"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '…' : 'Зачувај'}
            </button>
          </div>
        </div>
      ) : saveError ? (
        <div className="w-full max-w-sm flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm font-semibold">
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">Зачувувањето не успеа.</span>
          <button type="button" onClick={() => setSaved(false)}
            className="underline hover:no-underline font-bold shrink-0">
            Обиди се пак
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Резултатот е зачуван!
        </div>
      )}

      <div className="flex gap-3 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => { setSaved(false); resetSession(); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Пробај пак
        </button>
        {onDifficultyChange && difficulty && (
          <>
            {difficulty > 1 && (
              <button type="button" onClick={() => { setSaved(false); onDifficultyChange((difficulty - 1) as 1 | 2 | 3); onNewSet((difficulty - 1) as 1 | 2 | 3); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-200 transition-colors">
                <TrendingDown className="w-4 h-4" /> Полесно
              </button>
            )}
            {difficulty < 3 && (
              <button type="button" onClick={() => { setSaved(false); onDifficultyChange((difficulty + 1) as 1 | 2 | 3); onNewSet((difficulty + 1) as 1 | 2 | 3); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors">
                <TrendingUp className="w-4 h-4" /> Потешко
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => { setSaved(false); onNewSet(difficulty); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Shuffle className="w-4 h-4" /> Нов сет
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function LabExercisePanel({
  session,
  onNewSet,
  difficulty = 1,
  onDifficultyChange,
  headerSlot,
}: LabExercisePanelProps) {
  const {
    labId, exercises, currentIdx, currentEx,
    userAnswer, submitted, correct, showHint,
    hintsUsed, score, sessionDone,
    submitAnswer, useHint, nextExercise, difficultyStreak,
  } = session;


  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-gray-400">
        <Trophy className="w-10 h-10 opacity-30" />
        <p className="text-sm">Избери тежина и притисни „Нов сет" за да почнеш.</p>
        <div className="w-full max-w-sm"><ContinueBanner labId={labId} /></div>
        {headerSlot}
      </div>
    );
  }

  if (sessionDone) {
    return (
      <SessionDoneScreen
        session={session}
        onNewSet={onNewSet}
        difficulty={difficulty}
        onDifficultyChange={onDifficultyChange}
      />
    );
  }

  if (!currentEx) return null;

  const canUpgrade = difficultyStreak.correct >= 2 && difficulty < 3;
  const canDowngrade = difficultyStreak.wrong >= 2 && difficulty > 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Difficulty chips */}
        <div className="flex gap-1.5">
          {([1, 2, 3] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => { onDifficultyChange?.(d); onNewSet(d); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                difficulty === d ? DIFF_COLORS[d] : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {DIFF_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {headerSlot}
        <button
          type="button"
          onClick={() => onNewSet(difficulty)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold hover:bg-gray-200 transition-colors"
        >
          <Shuffle className="w-3 h-3" /> Нов сет
        </button>
      </div>

      {/* Progress */}
      <ProgressBar current={currentIdx} total={exercises.length} correct={score} />

      {/* Difficulty nudge */}
      <DifficultyNudge streak={difficultyStreak} />

      {/* Exercise card */}
      <div className="rounded-2xl border-2 border-indigo-100 bg-white p-5 shadow-sm space-y-3">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wide">
            Прашање {currentIdx + 1} · {DIFF_LABELS[currentEx.difficulty]}
          </span>
          <span className="text-[10px] text-gray-400">{currentEx.curriculumRef}</span>
        </div>

        {/* Question */}
        <p className="text-base font-semibold text-gray-800 leading-snug">{currentEx.question}</p>

        {/* Answer input */}
        <AnswerInput session={session} />

        {/* Hint */}
        {showHint && !submitted && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{currentEx.hint}</span>
          </div>
        )}

        {/* Feedback after submit */}
        {submitted && (
          <div className={`rounded-xl p-3 border ${correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {correct
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <XCircle    className="w-4 h-4 text-red-500" />
              }
              <span className={`text-sm font-bold ${correct ? 'text-emerald-700' : 'text-red-700'}`}>
                {correct ? 'Точно!' : `Не е точно. Точниот одговор: ${currentEx.correctAnswer}`}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{currentEx.explanation}</p>
          </div>
        )}
      </div>

      {/* Adaptive difficulty suggestion */}
      {submitted && onDifficultyChange && (
        <>
          {canUpgrade && correct && (
            <button type="button" onClick={() => onDifficultyChange((difficulty + 1) as 1 | 2 | 3)}
              className="w-full py-2 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-300">
              ⬆ 2 точни по ред — оди на ниво {difficulty + 1}?
            </button>
          )}
          {canDowngrade && !correct && (
            <button type="button" onClick={() => onDifficultyChange((difficulty - 1) as 1 | 2 | 3)}
              className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold border border-amber-300">
              ⬇ Пробај на ниво {difficulty - 1} прво
            </button>
          )}
        </>
      )}

      {/* Action row */}
      <div className="flex gap-3 justify-between">
        {!submitted ? (
          <>
            {!showHint && (
              <button
                type="button"
                onClick={useHint}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors"
              >
                <Lightbulb className="w-4 h-4" /> Hint ({hintsUsed} употр.)
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={submitAnswer}
              disabled={!userAnswer.trim()}
              className="flex items-center gap-1.5 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Провери
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={nextExercise}
            className="ml-auto flex items-center gap-1.5 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            {currentIdx + 1 >= exercises.length ? 'Заврши' : 'Следно'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
