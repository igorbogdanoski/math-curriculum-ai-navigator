import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AcademyQuiz } from './AcademyQuiz';
import { useAcademyProgress } from '../../contexts/AcademyProgressContext';
import { callGeminiProxy } from '../../services/gemini/core';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
vi.mock('../../contexts/AcademyProgressContext', () => ({ useAcademyProgress: vi.fn() }));
vi.mock('../../services/gemini/core', () => ({
  callGeminiProxy: vi.fn(),
  sanitizePromptInput: (s: string) => s,
  DEFAULT_MODEL: 'test-model',
}));

const ITEM = { id: 'ch-01-intro', title: 'Вовед — Зошто AI писменост?', contentText: 'Содржина за AI писменост.' };

const ONE_QUESTION = [{
  question: 'Прашање 1?',
  options: ['Точно', 'Погрешно 1', 'Погрешно 2', 'Погрешно 3'],
  correctAnswer: 0,
  explanation: 'Затоа што е точно.',
}];

describe('AcademyQuiz', () => {
  const markQuizAsCompleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAcademyProgress).mockReturnValue({
      progress: { completedQuizzes: [] },
      markQuizAsCompleted,
    } as any);
  });

  it('generates a quiz from item.title and item.contentText', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValue({ text: JSON.stringify(ONE_QUESTION) } as any);
    render(<AcademyQuiz item={ITEM} />);

    fireEvent.click(screen.getByText('Започни квиз'));

    await waitFor(() => expect(screen.getByText('Прашање 1?')).toBeTruthy());
    const promptArg = vi.mocked(callGeminiProxy).mock.calls[0][0] as { contents: Array<{ parts: Array<{ text: string }> }> };
    const promptText = promptArg.contents[0].parts[0].text;
    expect(promptText).toContain(ITEM.title);
    expect(promptText).toContain(ITEM.contentText);
  });

  it('marks the quiz complete only once every question is answered correctly (>=80%)', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValue({ text: JSON.stringify(ONE_QUESTION) } as any);
    render(<AcademyQuiz item={ITEM} />);
    fireEvent.click(screen.getByText('Започни квиз'));
    await waitFor(() => expect(screen.getByText('Прашање 1?')).toBeTruthy());

    fireEvent.click(screen.getByText('Точно'));
    fireEvent.click(screen.getByText('Потврди одговор'));
    fireEvent.click(screen.getByText('Заврши квиз'));

    await waitFor(() => expect(markQuizAsCompleted).toHaveBeenCalledWith(ITEM.id));
  });

  it('does not mark the quiz complete on a failing score', async () => {
    vi.mocked(callGeminiProxy).mockResolvedValue({ text: JSON.stringify(ONE_QUESTION) } as any);
    render(<AcademyQuiz item={ITEM} />);
    fireEvent.click(screen.getByText('Започни квиз'));
    await waitFor(() => expect(screen.getByText('Прашање 1?')).toBeTruthy());

    fireEvent.click(screen.getByText('Погрешно 1'));
    fireEvent.click(screen.getByText('Потврди одговор'));
    fireEvent.click(screen.getByText('Заврши квиз'));

    await waitFor(() => expect(screen.getByText(/Точни одговори/)).toBeTruthy());
    expect(markQuizAsCompleted).not.toHaveBeenCalled();
  });

  it('shows the already-completed state when item.id is in completedQuizzes', () => {
    vi.mocked(useAcademyProgress).mockReturnValue({
      progress: { completedQuizzes: [ITEM.id] },
      markQuizAsCompleted,
    } as any);
    render(<AcademyQuiz item={ITEM} />);
    expect(screen.getByText('Квизот е успешно завршен!')).toBeTruthy();
  });
});
