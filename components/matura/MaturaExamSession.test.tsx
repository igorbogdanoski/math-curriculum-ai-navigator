/**
 * Tests for components/matura/MaturaExamSession.tsx (T2.1).
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MaturaExamSession } from './MaturaExamSession';
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
    questionText: `Q${over.questionNumber}`,
    choices: { А: 'a', Б: 'b' },
    correctAnswer: 'А',
    topicArea: 'algebra',
    dokLevel: 1,
    ...over,
  };
}

beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MaturaExamSession', () => {
  it('renders setup placeholder when no questions are passed', () => {
    render(<MaturaExamSession mode="practice" sessionId="s1" questions={[]} />);
    expect(screen.getByTestId('matura-setup')).toBeTruthy();
  });

  it('auto-starts and renders the first question when questions are present', () => {
    render(
      <MaturaExamSession mode="practice" sessionId="s2" questions={[q({ questionNumber: 1 })]} />,
    );
    expect(screen.getByTestId('matura-exam')).toBeTruthy();
    expect(screen.getByText(/Q1/)).toBeTruthy();
  });

  it('navigates between questions with Next / Prev', () => {
    render(
      <MaturaExamSession
        mode="practice"
        sessionId="s3"
        questions={[q({ questionNumber: 1 }), q({ questionNumber: 2 })]}
      />,
    );
    expect(screen.getByText(/Q1/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Следно/));
    expect(screen.getByText(/Q2/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Претходно/));
    expect(screen.getByText(/Q1/)).toBeTruthy();
  });

  it('records answers via the default MC renderer', () => {
    render(
      <MaturaExamSession mode="practice" sessionId="s4" questions={[q({ questionNumber: 1 })]} />,
    );
    fireEvent.click(screen.getByText(/А\./));
    const btn = screen.getByText(/А\./).closest('button')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('invokes onSubmit with aggregated payload on manual submit', async () => {
    const handleSubmit = vi.fn();
    render(
      <MaturaExamSession
        mode="practice"
        sessionId="s5"
        questions={[q({ questionNumber: 1 }), q({ questionNumber: 2 })]}
        onSubmit={handleSubmit}
      />,
    );
    fireEvent.click(screen.getByText(/А\./));
    fireEvent.click(screen.getByTestId('matura-submit'));
    // Allow scheduled microtasks to flush
    await Promise.resolve();
    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const payload = handleSubmit.mock.calls[0][0];
    expect(payload.totalScore).toBe(1);
    expect(payload.maxScore).toBe(2);
    expect(payload.perTopic.algebra.questions).toBe(2);
  });

  it('shows the timer in simulation mode and ticks down each second', () => {
    vi.useFakeTimers();
    render(
      <MaturaExamSession
        mode="simulation"
        sessionId="s6"
        questions={[q({ questionNumber: 1 })]}
        durationSec={10}
      />,
    );
    expect(screen.getByTestId('matura-timer')).toBeTruthy();
    expect(screen.getByTestId('matura-timer').textContent).toBe('00:10');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('matura-timer').textContent).toBe('00:08');
  });

  it('auto-submits when the timer reaches duration', async () => {
    vi.useFakeTimers();
    const handleSubmit = vi.fn();
    render(
      <MaturaExamSession
        mode="simulation"
        sessionId="s7"
        questions={[q({ questionNumber: 1 })]}
        durationSec={2}
        onSubmit={handleSubmit}
      />,
    );
    act(() => { vi.advanceTimersByTime(3000); });
    // Allow effect-driven onSubmit to fire
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId('matura-review')).toBeTruthy();
    expect(handleSubmit).toHaveBeenCalled();
    expect(handleSubmit.mock.calls[0][0].durationMs).toBeGreaterThan(0);
  });

  it('persists answers to localStorage and rehydrates on remount', () => {
    const sessionId = 'persist-1';
    const { unmount } = render(
      <MaturaExamSession
        mode="practice"
        sessionId={sessionId}
        questions={[q({ questionNumber: 1 }), q({ questionNumber: 2 })]}
      />,
    );
    fireEvent.click(screen.getByText(/А\./));
    // Move to question 2
    fireEvent.click(screen.getByText(/Следно/));
    unmount();

    // Verify draft was saved
    const keys = Object.keys(window.localStorage).filter(k => k.includes(sessionId));
    expect(keys.length).toBe(1);

    // Remount → answers + currentIndex should re-hydrate
    render(
      <MaturaExamSession
        mode="practice"
        sessionId={sessionId}
        questions={[q({ questionNumber: 1 }), q({ questionNumber: 2 })]}
      />,
    );
    // After re-hydration we should be on Q2 (matching saved currentIndex)
    expect(screen.getByText(/Q2/)).toBeTruthy();
  });

  it('clears the localStorage draft when the session reaches review phase', async () => {
    const sessionId = 'clear-1';
    render(
      <MaturaExamSession
        mode="practice"
        sessionId={sessionId}
        questions={[q({ questionNumber: 1 })]}
      />,
    );
    fireEvent.click(screen.getByText(/А\./));
    expect(Object.keys(window.localStorage).some(k => k.includes(sessionId))).toBe(true);
    fireEvent.click(screen.getByTestId('matura-submit'));
    await act(async () => { await Promise.resolve(); });
    expect(Object.keys(window.localStorage).some(k => k.includes(sessionId))).toBe(false);
  });

  it('pauses on document visibilitychange=hidden in simulation mode', () => {
    vi.useFakeTimers();
    render(
      <MaturaExamSession
        mode="simulation"
        sessionId="vis-1"
        questions={[q({ questionNumber: 1 })]}
        durationSec={60}
      />,
    );
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByTestId('matura-paused')).toBeTruthy();

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByTestId('matura-paused')).toBeNull();
  });

  it('uses a custom renderQuestion when provided (no props drilling)', () => {
    const renderQuestion = vi.fn((ctx) => (
      <div data-testid="custom">custom-{ctx.question.questionNumber}-{ctx.value}</div>
    ));
    render(
      <MaturaExamSession
        mode="practice"
        sessionId="custom-1"
        questions={[q({ questionNumber: 5 })]}
        renderQuestion={renderQuestion}
      />,
    );
    expect(screen.getByTestId('custom').textContent).toBe('custom-5-');
    expect(renderQuestion).toHaveBeenCalled();
  });
});
