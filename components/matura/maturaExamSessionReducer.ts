/**
 * Pure TypeScript state machine for the unified Matura exam session
 * (T2.1 — used by MaturaPracticeView + MaturaSimulationView).
 *
 * Phases:
 *   setup  → user picks topics/dok/count/duration
 *   exam   → answering; timer ticks (unless paused)
 *   review → readonly; per-topic / per-dok / per-part breakdown
 *
 * The reducer is intentionally framework-free so it can be unit-tested
 * without any DOM / React Testing Library scaffolding.
 */

import type { MaturaQuestion } from '../../services/firestoreService.matura';

export type MaturaExamMode = 'practice' | 'simulation';
export type MaturaExamPhase = 'setup' | 'exam' | 'review';

export interface MaturaSessionAnswer {
  /** For MC: the picked choice key ('А' | 'Б' | …). For open: free text. */
  value: string;
  /** AI grade (when graded). Score == correctness ∈ [0, q.points]. */
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: number;
}

export interface MaturaSessionSetup {
  topicAreas: string[];
  parts: number[];
  dokLevels: number[];
  questionCount: number;
  /** Duration in seconds; 0 disables the timer (practice). */
  durationSec: number;
}

export interface MaturaExamSessionState {
  phase: MaturaExamPhase;
  mode: MaturaExamMode;
  setup: MaturaSessionSetup;
  questions: MaturaQuestion[];
  /** keyed by questionNumber */
  answers: Record<number, MaturaSessionAnswer>;
  currentIndex: number;
  durationSec: number;
  elapsedSec: number;
  paused: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  /** Auto-submit fired once when the timer reaches durationSec. */
  autoSubmitted: boolean;
}

export type MaturaExamSessionAction =
  | { type: 'CONFIGURE'; setup: Partial<MaturaSessionSetup> }
  | { type: 'START'; questions: MaturaQuestion[]; startedAt?: number }
  | { type: 'ANSWER'; questionNumber: number; value: string }
  | { type: 'GRADE';  questionNumber: number; score: number; maxScore: number; feedback?: string }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'JUMP'; index: number }
  | { type: 'TICK'; seconds?: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SUBMIT'; finishedAt?: number; auto?: boolean }
  | { type: 'RESET' };

export interface MaturaSubmitPayload {
  answers: Record<number, MaturaSessionAnswer>;
  perTopic: Record<string, { correct: number; max: number; questions: number }>;
  perDoK:   Record<number, { correct: number; max: number; questions: number }>;
  perPart:  Record<number, { correct: number; max: number; questions: number }>;
  totalScore: number;
  maxScore: number;
  durationMs: number;
}

export const DEFAULT_SETUP: MaturaSessionSetup = {
  topicAreas: [],
  parts: [],
  dokLevels: [],
  questionCount: 10,
  durationSec: 0,
};

export function makeInitialState(mode: MaturaExamMode = 'practice'): MaturaExamSessionState {
  return {
    phase: 'setup',
    mode,
    setup: { ...DEFAULT_SETUP, durationSec: mode === 'simulation' ? 90 * 60 : 0 },
    questions: [],
    answers: {},
    currentIndex: 0,
    durationSec: mode === 'simulation' ? 90 * 60 : 0,
    elapsedSec: 0,
    paused: false,
    startedAt: null,
    finishedAt: null,
    autoSubmitted: false,
  };
}

export function maturaExamSessionReducer(
  state: MaturaExamSessionState,
  action: MaturaExamSessionAction,
): MaturaExamSessionState {
  switch (action.type) {
    case 'CONFIGURE':
      if (state.phase !== 'setup') return state;
      return { ...state, setup: { ...state.setup, ...action.setup } };

    case 'START': {
      if (action.questions.length === 0) return state;
      return {
        ...state,
        phase: 'exam',
        questions: action.questions,
        answers: {},
        currentIndex: 0,
        elapsedSec: 0,
        paused: false,
        startedAt: action.startedAt ?? Date.now(),
        finishedAt: null,
        autoSubmitted: false,
        durationSec: state.setup.durationSec,
      };
    }

    case 'ANSWER':
      if (state.phase !== 'exam') return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionNumber]: {
            ...state.answers[action.questionNumber],
            value: action.value,
          },
        },
      };

    case 'GRADE':
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionNumber]: {
            value: state.answers[action.questionNumber]?.value ?? '',
            score: action.score,
            maxScore: action.maxScore,
            feedback: action.feedback,
            gradedAt: Date.now(),
          },
        },
      };

    case 'NEXT': {
      if (state.phase !== 'exam') return state;
      const next = Math.min(state.currentIndex + 1, state.questions.length - 1);
      return next === state.currentIndex ? state : { ...state, currentIndex: next };
    }

    case 'PREV': {
      if (state.phase !== 'exam') return state;
      const prev = Math.max(state.currentIndex - 1, 0);
      return prev === state.currentIndex ? state : { ...state, currentIndex: prev };
    }

    case 'JUMP': {
      if (state.phase !== 'exam') return state;
      if (action.index < 0 || action.index >= state.questions.length) return state;
      return { ...state, currentIndex: action.index };
    }

    case 'TICK': {
      if (state.phase !== 'exam' || state.paused) return state;
      const inc = action.seconds ?? 1;
      const elapsedSec = state.elapsedSec + inc;
      // Auto-submit when budget exhausted (simulation mode).
      if (state.durationSec > 0 && elapsedSec >= state.durationSec && !state.autoSubmitted) {
        return {
          ...state,
          elapsedSec: state.durationSec,
          phase: 'review',
          finishedAt: Date.now(),
          autoSubmitted: true,
        };
      }
      return { ...state, elapsedSec };
    }

    case 'PAUSE':
      if (state.phase !== 'exam' || state.paused) return state;
      return { ...state, paused: true };

    case 'RESUME':
      if (state.phase !== 'exam' || !state.paused) return state;
      return { ...state, paused: false };

    case 'SUBMIT':
      if (state.phase !== 'exam') return state;
      return {
        ...state,
        phase: 'review',
        finishedAt: action.finishedAt ?? Date.now(),
        autoSubmitted: state.autoSubmitted || Boolean(action.auto),
      };

    case 'RESET':
      return makeInitialState(state.mode);

    default:
      return state;
  }
}

// ─── Submit aggregation helpers ───────────────────────────────────────────────

function isMcCorrect(q: MaturaQuestion, value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === (q.correctAnswer ?? '').trim().toLowerCase();
}

function scoreFor(q: MaturaQuestion, ans: MaturaSessionAnswer | undefined): number {
  if (!ans) return 0;
  if (typeof ans.score === 'number') return Math.min(Math.max(ans.score, 0), q.points ?? 1);
  // Auto-grade MC when no AI score is present.
  const isMc = q.questionType === 'mc' || (q.choices && Object.keys(q.choices).length > 0);
  if (isMc) return isMcCorrect(q, ans.value) ? (q.points ?? 1) : 0;
  return 0;
}

export function buildSubmitPayload(state: MaturaExamSessionState): MaturaSubmitPayload {
  const perTopic: Record<string, { correct: number; max: number; questions: number }> = {};
  const perDoK:   Record<number, { correct: number; max: number; questions: number }> = {};
  const perPart:  Record<number, { correct: number; max: number; questions: number }> = {};
  let totalScore = 0;
  let maxScore = 0;

  for (const q of state.questions) {
    const ans = state.answers[q.questionNumber];
    const score = scoreFor(q, ans);
    const max = q.points ?? 1;
    totalScore += score;
    maxScore += max;

    const topic = q.topicArea ?? q.topic ?? 'other';
    const tBucket = perTopic[topic] ?? { correct: 0, max: 0, questions: 0 };
    tBucket.correct += score; tBucket.max += max; tBucket.questions += 1;
    perTopic[topic] = tBucket;

    const dok = q.dokLevel ?? 1;
    const dBucket = perDoK[dok] ?? { correct: 0, max: 0, questions: 0 };
    dBucket.correct += score; dBucket.max += max; dBucket.questions += 1;
    perDoK[dok] = dBucket;

    const part = q.part ?? 1;
    const pBucket = perPart[part] ?? { correct: 0, max: 0, questions: 0 };
    pBucket.correct += score; pBucket.max += max; pBucket.questions += 1;
    perPart[part] = pBucket;
  }

  const durationMs = state.startedAt && state.finishedAt
    ? Math.max(0, state.finishedAt - state.startedAt)
    : state.elapsedSec * 1000;

  return {
    answers: state.answers,
    perTopic,
    perDoK,
    perPart,
    totalScore,
    maxScore,
    durationMs,
  };
}

export function remainingSec(state: MaturaExamSessionState): number {
  if (state.durationSec <= 0) return Infinity;
  return Math.max(0, state.durationSec - state.elapsedSec);
}

export function progressPercent(state: MaturaExamSessionState): number {
  if (!state.questions.length) return 0;
  const answered = Object.values(state.answers).filter(a => a.value && a.value.length > 0).length;
  return Math.round((answered / state.questions.length) * 100);
}
