/**
 * Tests for components/matura/maturaExamSessionReducer.ts (T2.1).
 */
import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  maturaExamSessionReducer,
  buildSubmitPayload,
  remainingSec,
  progressPercent,
  type MaturaExamSessionState,
} from './maturaExamSessionReducer';
import type { MaturaQuestion } from '../../services/firestoreService.matura';

function q(over: Partial<MaturaQuestion> & { questionNumber: number }): MaturaQuestion {
  return {
    examId: 'e1',
    year: 2024,
    session: 'june',
    language: 'mk',
    part: 1,
    points: 1,
    questionType: 'mc',
    questionText: 'Q',
    choices: { А: 'a', Б: 'b' },
    correctAnswer: 'А',
    topicArea: 'algebra',
    dokLevel: 1,
    ...over,
  };
}

function startedState(over: Partial<MaturaExamSessionState> = {}): MaturaExamSessionState {
  const s = makeInitialState('practice');
  return {
    ...s,
    phase: 'exam',
    questions: [q({ questionNumber: 1 }), q({ questionNumber: 2 }), q({ questionNumber: 3 })],
    startedAt: 1_000,
    ...over,
  };
}

describe('makeInitialState', () => {
  it('returns setup phase with practice defaults (no timer)', () => {
    const s = makeInitialState('practice');
    expect(s.phase).toBe('setup');
    expect(s.durationSec).toBe(0);
    expect(s.setup.durationSec).toBe(0);
  });

  it('returns 90-min budget for simulation mode', () => {
    const s = makeInitialState('simulation');
    expect(s.durationSec).toBe(5400);
    expect(s.setup.durationSec).toBe(5400);
  });
});

describe('CONFIGURE', () => {
  it('updates setup partials in setup phase', () => {
    const s = makeInitialState('practice');
    const next = maturaExamSessionReducer(s, {
      type: 'CONFIGURE', setup: { topicAreas: ['algebra'], questionCount: 5 },
    });
    expect(next.setup.topicAreas).toEqual(['algebra']);
    expect(next.setup.questionCount).toBe(5);
  });

  it('is ignored outside setup phase', () => {
    const s = startedState();
    const next = maturaExamSessionReducer(s, {
      type: 'CONFIGURE', setup: { questionCount: 99 },
    });
    expect(next).toBe(s);
  });
});

describe('START', () => {
  it('transitions setup → exam and seeds questions + startedAt', () => {
    const s = makeInitialState('practice');
    const next = maturaExamSessionReducer(s, {
      type: 'START', questions: [q({ questionNumber: 1 })], startedAt: 5_000,
    });
    expect(next.phase).toBe('exam');
    expect(next.questions).toHaveLength(1);
    expect(next.startedAt).toBe(5_000);
    expect(next.elapsedSec).toBe(0);
  });

  it('is a no-op when no questions are passed', () => {
    const s = makeInitialState('practice');
    const next = maturaExamSessionReducer(s, { type: 'START', questions: [] });
    expect(next).toBe(s);
  });

  it('inherits durationSec from setup', () => {
    let s = makeInitialState('practice');
    s = maturaExamSessionReducer(s, { type: 'CONFIGURE', setup: { durationSec: 600 } });
    s = maturaExamSessionReducer(s, { type: 'START', questions: [q({ questionNumber: 1 })] });
    expect(s.durationSec).toBe(600);
  });
});

describe('ANSWER / GRADE', () => {
  it('records the picked value keyed by questionNumber', () => {
    const s = startedState();
    const next = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 2, value: 'Б' });
    expect(next.answers[2]?.value).toBe('Б');
  });

  it('preserves previous score/feedback when re-answering', () => {
    let s = startedState();
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'А' });
    s = maturaExamSessionReducer(s, {
      type: 'GRADE', questionNumber: 1, score: 1, maxScore: 1, feedback: 'good',
    });
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'Б' });
    expect(s.answers[1]?.value).toBe('Б');
    // ANSWER spreads over the previous entry
    expect(s.answers[1]?.feedback).toBe('good');
  });

  it('GRADE attaches score/maxScore/feedback', () => {
    const s = startedState();
    const next = maturaExamSessionReducer(s, {
      type: 'GRADE', questionNumber: 1, score: 3, maxScore: 4, feedback: 'ok',
    });
    expect(next.answers[1]).toMatchObject({ score: 3, maxScore: 4, feedback: 'ok' });
  });

  it('ANSWER outside exam phase is ignored', () => {
    const s = makeInitialState('practice');
    const next = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'А' });
    expect(next).toBe(s);
  });
});

describe('NEXT / PREV / JUMP', () => {
  it('NEXT advances index and clamps at last question', () => {
    let s = startedState();
    s = maturaExamSessionReducer(s, { type: 'NEXT' });
    expect(s.currentIndex).toBe(1);
    s = maturaExamSessionReducer(s, { type: 'NEXT' });
    s = maturaExamSessionReducer(s, { type: 'NEXT' });
    s = maturaExamSessionReducer(s, { type: 'NEXT' });
    expect(s.currentIndex).toBe(2); // clamped
  });

  it('PREV clamps at 0', () => {
    const s = startedState({ currentIndex: 0 });
    const next = maturaExamSessionReducer(s, { type: 'PREV' });
    expect(next.currentIndex).toBe(0);
    expect(next).toBe(s);
  });

  it('JUMP moves to a valid index, ignores invalid ones', () => {
    let s = startedState();
    s = maturaExamSessionReducer(s, { type: 'JUMP', index: 2 });
    expect(s.currentIndex).toBe(2);
    const oob = maturaExamSessionReducer(s, { type: 'JUMP', index: 99 });
    expect(oob).toBe(s);
    const neg = maturaExamSessionReducer(s, { type: 'JUMP', index: -1 });
    expect(neg).toBe(s);
  });
});

describe('TICK / PAUSE / RESUME', () => {
  it('TICK increments elapsedSec by 1 second by default', () => {
    const s = startedState({ durationSec: 60 });
    const next = maturaExamSessionReducer(s, { type: 'TICK' });
    expect(next.elapsedSec).toBe(1);
  });

  it('TICK respects custom delta seconds', () => {
    const s = startedState({ durationSec: 60 });
    const next = maturaExamSessionReducer(s, { type: 'TICK', seconds: 5 });
    expect(next.elapsedSec).toBe(5);
  });

  it('TICK is ignored when paused', () => {
    const s = startedState({ paused: true, durationSec: 60 });
    const next = maturaExamSessionReducer(s, { type: 'TICK' });
    expect(next).toBe(s);
  });

  it('TICK auto-submits when timer reaches durationSec', () => {
    const s = startedState({ durationSec: 60, elapsedSec: 59 });
    const next = maturaExamSessionReducer(s, { type: 'TICK', seconds: 5 });
    expect(next.phase).toBe('review');
    expect(next.autoSubmitted).toBe(true);
    expect(next.elapsedSec).toBe(60);
    expect(next.finishedAt).not.toBeNull();
  });

  it('PAUSE / RESUME toggles the paused flag', () => {
    let s = startedState();
    s = maturaExamSessionReducer(s, { type: 'PAUSE' });
    expect(s.paused).toBe(true);
    const dup = maturaExamSessionReducer(s, { type: 'PAUSE' });
    expect(dup).toBe(s); // already paused → no change
    s = maturaExamSessionReducer(s, { type: 'RESUME' });
    expect(s.paused).toBe(false);
  });

  it('TICK ignored outside exam phase', () => {
    const s = makeInitialState('simulation');
    const next = maturaExamSessionReducer(s, { type: 'TICK', seconds: 10 });
    expect(next).toBe(s);
  });
});

describe('SUBMIT / RESET', () => {
  it('SUBMIT moves exam → review and stamps finishedAt', () => {
    const s = startedState();
    const next = maturaExamSessionReducer(s, { type: 'SUBMIT', finishedAt: 9_000 });
    expect(next.phase).toBe('review');
    expect(next.finishedAt).toBe(9_000);
    expect(next.autoSubmitted).toBe(false);
  });

  it('SUBMIT with auto=true marks autoSubmitted', () => {
    const s = startedState();
    const next = maturaExamSessionReducer(s, { type: 'SUBMIT', auto: true });
    expect(next.autoSubmitted).toBe(true);
  });

  it('RESET returns to a fresh setup phase preserving mode', () => {
    const s = startedState({ mode: 'simulation' });
    const next = maturaExamSessionReducer(s, { type: 'RESET' });
    expect(next.phase).toBe('setup');
    expect(next.mode).toBe('simulation');
    expect(next.questions).toHaveLength(0);
    expect(next.answers).toEqual({});
  });
});

describe('buildSubmitPayload', () => {
  it('auto-grades MC by comparing value to correctAnswer', () => {
    const s = startedState();
    const a1 = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'А' });
    const a2 = maturaExamSessionReducer(a1, { type: 'ANSWER', questionNumber: 2, value: 'Б' });
    const out = buildSubmitPayload(a2);
    expect(out.totalScore).toBe(1); // q1 correct, q2 wrong, q3 unanswered
    expect(out.maxScore).toBe(3);
  });

  it('uses the GRADE score for non-MC questions', () => {
    let s: MaturaExamSessionState = {
      ...makeInitialState('practice'),
      phase: 'exam',
      questions: [q({ questionNumber: 1, questionType: 'open', points: 4, choices: null })],
      startedAt: 1_000,
    };
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'long answer' });
    s = maturaExamSessionReducer(s, { type: 'GRADE', questionNumber: 1, score: 3, maxScore: 4 });
    const out = buildSubmitPayload(s);
    expect(out.totalScore).toBe(3);
    expect(out.maxScore).toBe(4);
  });

  it('aggregates perTopic, perDoK, perPart correctly', () => {
    let s: MaturaExamSessionState = {
      ...makeInitialState('practice'),
      phase: 'exam',
      questions: [
        q({ questionNumber: 1, topicArea: 'algebra',    dokLevel: 1, part: 1, points: 1 }),
        q({ questionNumber: 2, topicArea: 'algebra',    dokLevel: 2, part: 2, points: 2,
            questionType: 'open', choices: null, correctAnswer: 'x = 2' }),
        q({ questionNumber: 3, topicArea: 'geometrija', dokLevel: 3, part: 3, points: 3,
            questionType: 'open', choices: null, correctAnswer: 'r = 5' }),
      ],
      startedAt: 1_000,
    };
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'А' });
    s = maturaExamSessionReducer(s, { type: 'GRADE',  questionNumber: 2, score: 2, maxScore: 2 });
    s = maturaExamSessionReducer(s, { type: 'GRADE',  questionNumber: 3, score: 1, maxScore: 3 });

    const out = buildSubmitPayload(s);
    expect(out.totalScore).toBe(4);
    expect(out.maxScore).toBe(6);
    expect(out.perTopic.algebra).toEqual({ correct: 3, max: 3, questions: 2 });
    expect(out.perTopic.geometrija).toEqual({ correct: 1, max: 3, questions: 1 });
    expect(out.perDoK[1]).toEqual({ correct: 1, max: 1, questions: 1 });
    expect(out.perDoK[2]).toEqual({ correct: 2, max: 2, questions: 1 });
    expect(out.perDoK[3]).toEqual({ correct: 1, max: 3, questions: 1 });
    expect(out.perPart[1]).toEqual({ correct: 1, max: 1, questions: 1 });
    expect(out.perPart[2]).toEqual({ correct: 2, max: 2, questions: 1 });
    expect(out.perPart[3]).toEqual({ correct: 1, max: 3, questions: 1 });
  });

  it('clamps GRADE score to question.points', () => {
    let s: MaturaExamSessionState = {
      ...makeInitialState('practice'),
      phase: 'exam',
      questions: [q({ questionNumber: 1, questionType: 'open', points: 4, choices: null })],
      startedAt: 1_000,
    };
    s = maturaExamSessionReducer(s, { type: 'GRADE', questionNumber: 1, score: 99, maxScore: 4 });
    const out = buildSubmitPayload(s);
    expect(out.totalScore).toBe(4);
  });

  it('durationMs uses (finishedAt - startedAt) when both are set', () => {
    let s: MaturaExamSessionState = startedState({ startedAt: 1_000 });
    s = maturaExamSessionReducer(s, { type: 'SUBMIT', finishedAt: 6_000 });
    const out = buildSubmitPayload(s);
    expect(out.durationMs).toBe(5_000);
  });

  it('durationMs falls back to elapsedSec * 1000 if startedAt/finishedAt missing', () => {
    const s: MaturaExamSessionState = {
      ...startedState(),
      startedAt: null,
      finishedAt: null,
      elapsedSec: 42,
    };
    const out = buildSubmitPayload(s);
    expect(out.durationMs).toBe(42_000);
  });

  it('case-insensitive MC comparison', () => {
    let s: MaturaExamSessionState = startedState();
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: '  а  ' });
    const out = buildSubmitPayload(s);
    // 'А' (uppercase Cyrillic) ≠ 'а' (lowercase Cyrillic) when toLowerCase is applied to both…
    // Cyrillic 'А' (U+0410) lowercase = 'а' (U+0430) → match.
    expect(out.totalScore).toBe(1);
  });
});

describe('remainingSec / progressPercent', () => {
  it('remainingSec is Infinity when no timer', () => {
    const s = startedState({ durationSec: 0 });
    expect(remainingSec(s)).toBe(Infinity);
  });

  it('remainingSec subtracts elapsed from durationSec', () => {
    const s = startedState({ durationSec: 60, elapsedSec: 25 });
    expect(remainingSec(s)).toBe(35);
  });

  it('remainingSec floors at 0', () => {
    const s = startedState({ durationSec: 60, elapsedSec: 999 });
    expect(remainingSec(s)).toBe(0);
  });

  it('progressPercent is 0 with no answers', () => {
    expect(progressPercent(startedState())).toBe(0);
  });

  it('progressPercent counts non-empty answers / questions × 100', () => {
    let s = startedState(); // 3 questions
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 1, value: 'А' });
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 2, value: '' });
    expect(progressPercent(s)).toBe(33);
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 2, value: 'Б' });
    s = maturaExamSessionReducer(s, { type: 'ANSWER', questionNumber: 3, value: 'А' });
    expect(progressPercent(s)).toBe(100);
  });
});
