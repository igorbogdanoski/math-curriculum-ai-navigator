/**
 * MaturaExamSession (T2.1)
 *
 * Unified session orchestrator for both Matura Practice and Matura Simulation
 * flows. Owns the state machine (`maturaExamSessionReducer`), the timer,
 * pause-on-hidden behaviour, and a localStorage autosave draft.
 *
 * Children (e.g. MaturaQuestionCard) receive only the data + callbacks they
 * need — no props drilling for global session state.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import {
  buildSubmitPayload,
  makeInitialState,
  maturaExamSessionReducer,
  progressPercent,
  remainingSec,
  type MaturaExamMode,
  type MaturaExamSessionState,
  type MaturaSubmitPayload,
} from './maturaExamSessionReducer';

const DRAFT_PREFIX = 'matura_session_draft_v1::';

interface DraftSnapshot {
  answers: MaturaExamSessionState['answers'];
  currentIndex: number;
  elapsedSec: number;
  startedAt: number | null;
}

function draftKey(mode: MaturaExamMode, sessionId: string): string {
  return `${DRAFT_PREFIX}${mode}::${sessionId}`;
}

function readDraft(key: string): DraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

function writeDraft(key: string, snap: DraftSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(snap));
  } catch {
    // quota / private mode — non-critical.
  }
}

function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export interface MaturaExamSessionProps {
  mode: MaturaExamMode;
  /** Stable identifier used to scope the localStorage draft. */
  sessionId: string;
  /** Initial pool of questions; the orchestrator picks first N per setup. */
  questions: MaturaQuestion[];
  /** Override the default duration (overrides the simulation 90-min default). */
  durationSec?: number;
  /** Pause the timer when `document.visibilityState === 'hidden'` (default: true for simulation). */
  pauseOnHidden?: boolean;
  /** Called when the user (or auto-submit) finishes the session. */
  onSubmit?: (payload: MaturaSubmitPayload) => void | Promise<void>;
  /** Optional: render the per-question content; defaults to a minimal input/MC selector. */
  renderQuestion?: (ctx: MaturaExamSessionRenderContext) => React.ReactNode;
}

export interface MaturaExamSessionRenderContext {
  question: MaturaQuestion;
  index: number;
  total: number;
  value: string;
  setValue: (v: string) => void;
  next: () => void;
  prev: () => void;
  jumpTo: (i: number) => void;
}

/**
 * Custom hook exposed for tests + view-level reuse: starts the session reducer
 * with a draft restore + ticking timer (pauses when document is hidden).
 */
export function useMaturaExamSessionMachine(
  mode: MaturaExamMode,
  sessionId: string,
  questions: MaturaQuestion[],
  opts: { durationSec?: number; pauseOnHidden?: boolean } = {},
) {
  const [state, dispatch] = useReducer(
    maturaExamSessionReducer,
    null,
    () => makeInitialState(mode),
  );

  const key = draftKey(mode, sessionId);
  const draftRef = useRef<DraftSnapshot | null>(null);

  // Restore from autosave on first mount (or when sessionId changes).
  useEffect(() => {
    draftRef.current = readDraft(key);
  }, [key]);

  // Auto-start: when the parent passes ≥1 question and we're still in setup,
  // boot into exam phase using the draft (if any) or a fresh state.
  useEffect(() => {
    if (state.phase !== 'setup') return;
    if (questions.length === 0) return;

    if (opts.durationSec != null) {
      dispatch({ type: 'CONFIGURE', setup: { durationSec: opts.durationSec } });
    }
    dispatch({ type: 'START', questions });
    // The next tick will read draftRef and re-hydrate via JUMP/ANSWER replays.
  }, [questions, state.phase, opts.durationSec]);

  // Re-hydrate from draft (idempotent, runs once after START).
  useEffect(() => {
    if (state.phase !== 'exam') return;
    const draft = draftRef.current;
    if (!draft) return;

    // Replay answers
    for (const [qNum, ans] of Object.entries(draft.answers)) {
      if (ans?.value) dispatch({ type: 'ANSWER', questionNumber: Number(qNum), value: ans.value });
    }
    // Restore index + elapsed (clamp to current question pool)
    const targetIndex = Math.min(draft.currentIndex, state.questions.length - 1);
    if (targetIndex !== state.currentIndex) {
      dispatch({ type: 'JUMP', index: Math.max(0, targetIndex) });
    }
    if (draft.elapsedSec > 0) dispatch({ type: 'TICK', seconds: draft.elapsedSec });

    draftRef.current = null; // consumed
    // We intentionally only re-hydrate once after entering exam phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Persist draft on every state change while in exam phase.
  useEffect(() => {
    if (state.phase !== 'exam') return;
    writeDraft(key, {
      answers: state.answers,
      currentIndex: state.currentIndex,
      elapsedSec: state.elapsedSec,
      startedAt: state.startedAt,
    });
  }, [key, state.phase, state.answers, state.currentIndex, state.elapsedSec, state.startedAt]);

  // Tick the timer once a second.
  useEffect(() => {
    if (state.phase !== 'exam') return;
    if (state.paused) return;
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, [state.phase, state.paused]);

  // Pause-on-hidden (default true for simulation).
  const pauseOnHidden = opts.pauseOnHidden ?? mode === 'simulation';
  useEffect(() => {
    if (!pauseOnHidden) return;
    if (typeof document === 'undefined') return;

    const handler = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'PAUSE' });
      else dispatch({ type: 'RESUME' });
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [pauseOnHidden]);

  // Clear draft once the session is in review phase.
  useEffect(() => {
    if (state.phase === 'review') clearDraft(key);
  }, [state.phase, key]);

  return { state, dispatch };
}

// ─── Default minimal renderer (used when caller doesn't pass renderQuestion) ──

function DefaultQuestionRenderer({
  question, index, total, value, setValue, next, prev,
}: MaturaExamSessionRenderContext) {
  const choices = question.choices && Object.keys(question.choices).length
    ? Object.entries(question.choices)
    : null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3" data-testid="matura-question">
      <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
        <span>Прашање {index + 1} / {total}</span>
        <span>{question.points} {question.points === 1 ? 'поен' : 'поени'}</span>
      </div>
      <div className="text-sm text-gray-800">{question.questionText}</div>
      {choices ? (
        <div className="space-y-1">
          {choices.map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setValue(k)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                value === k
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200'
              }`}
              aria-pressed={value === k}
            >
              <strong className="mr-2">{k}.</strong>{t}
            </button>
          ))}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Внеси одговор…"
          aria-label="Одговор"
        />
      )}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={prev} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200" disabled={index === 0}>
          ← Претходно
        </button>
        <button type="button" onClick={next} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700" disabled={index === total - 1}>
          Следно →
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export const MaturaExamSession: React.FC<MaturaExamSessionProps> = ({
  mode, sessionId, questions, durationSec, pauseOnHidden,
  onSubmit, renderQuestion,
}) => {
  const { state, dispatch } = useMaturaExamSessionMachine(mode, sessionId, questions, {
    durationSec,
    pauseOnHidden,
  });

  const submitOnce = useRef(false);
  const handleSubmit = useCallback(async (auto = false) => {
    if (submitOnce.current) return;
    submitOnce.current = true;
    dispatch({ type: 'SUBMIT', auto });
  }, []);

  // Side effect: when phase flips to review (manual or auto), invoke onSubmit.
  useEffect(() => {
    if (state.phase !== 'review') return;
    if (!onSubmit) return;
    void Promise.resolve(onSubmit(buildSubmitPayload(state)));
  }, [state.phase, state, onSubmit]);

  const ctx = useMemo<MaturaExamSessionRenderContext | null>(() => {
    const q = state.questions[state.currentIndex];
    if (!q) return null;
    return {
      question: q,
      index: state.currentIndex,
      total: state.questions.length,
      value: state.answers[q.questionNumber]?.value ?? '',
      setValue: (v: string) => dispatch({ type: 'ANSWER', questionNumber: q.questionNumber, value: v }),
      next: () => dispatch({ type: 'NEXT' }),
      prev: () => dispatch({ type: 'PREV' }),
      jumpTo: (i: number) => dispatch({ type: 'JUMP', index: i }),
    };
  }, [state]);

  if (state.phase === 'setup') {
    return (
      <div className="p-4 bg-white rounded-2xl border border-gray-200" data-testid="matura-setup">
        <p className="text-sm text-gray-700">Подготовка на сесија… ({questions.length} прашања)</p>
      </div>
    );
  }

  if (state.phase === 'review') {
    const payload = buildSubmitPayload(state);
    return (
      <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3" data-testid="matura-review">
        <h3 className="font-bold text-gray-800">Завршена сесија</h3>
        <p className="text-sm text-gray-600">
          Резултат: <strong>{payload.totalScore}</strong> / {payload.maxScore} поени
          {' · '}
          Време: {Math.round(payload.durationMs / 1000)}s
          {state.autoSubmitted && <span className="ml-2 text-amber-600">(автоматско предавање)</span>}
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESET' })}
          className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Започни нова сесија
        </button>
      </div>
    );
  }

  // exam phase
  const remaining = remainingSec(state);
  const showTimer = state.durationSec > 0 && Number.isFinite(remaining);
  const mm = showTimer ? String(Math.floor(remaining / 60)).padStart(2, '0') : '';
  const ss = showTimer ? String(remaining % 60).padStart(2, '0') : '';
  const pct = progressPercent(state);

  return (
    <div className="space-y-3" data-testid="matura-exam">
      <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        <span className="text-xs font-semibold text-gray-600">
          Прогрес: {pct}% · {state.currentIndex + 1} / {state.questions.length}
        </span>
        <div className="flex items-center gap-2">
          {showTimer && (
            <span className="text-sm font-mono font-bold text-indigo-700" data-testid="matura-timer">
              {mm}:{ss}
            </span>
          )}
          {state.paused && (
            <span className="text-xs font-semibold text-amber-600" data-testid="matura-paused">
              ⏸ паузирано
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="px-3 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            data-testid="matura-submit"
          >
            Предај
          </button>
        </div>
      </div>
      {ctx && (renderQuestion ? renderQuestion(ctx) : <DefaultQuestionRenderer {...ctx} />)}
    </div>
  );
};
