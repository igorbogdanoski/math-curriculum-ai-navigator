import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExamPlayerView } from './ExamPlayerView';
import { NotificationProvider } from '../contexts/NotificationContext';

const getExamSessionByCode = vi.fn();
const joinExamSession = vi.fn();
const getExamResponses = vi.fn();
const saveExamAnswer = vi.fn();
const submitExamFinal = vi.fn();
const subscribeExamSession = vi.fn((..._args: unknown[]) => () => { /* unsubscribe no-op */ });

vi.mock('../services/firestoreService.exam', () => ({
  examService: {
    getExamSessionByCode: (...args: unknown[]) => getExamSessionByCode(...args),
    joinExamSession: (...args: unknown[]) => joinExamSession(...args),
    getExamResponses: (...args: unknown[]) => getExamResponses(...args),
    saveExamAnswer: (...args: unknown[]) => saveExamAnswer(...args),
    submitExamFinal: (...args: unknown[]) => submitExamFinal(...args),
    subscribeExamSession: (...args: unknown[]) => subscribeExamSession(...args),
  },
}));

vi.mock('../components/exam/ExamTimer', () => ({
  ExamTimer: () => null,
}));

vi.mock('../components/exam/ExamVariantPlayer', () => ({
  ExamVariantPlayer: ({ onAnswer }: { onAnswer: (idx: number, v: string) => void }) => (
    <button type="button" onClick={() => onAnswer(0, 'мојот одговор')}>answer-q0</button>
  ),
}));

function renderView() {
  return render(<NotificationProvider><ExamPlayerView /></NotificationProvider>);
}

async function joinAndReachSolving() {
  getExamSessionByCode.mockResolvedValue({ id: 'sess1', status: 'active', title: 'Тест', variants: { A: [] } });
  joinExamSession.mockResolvedValue('A');
  getExamResponses.mockResolvedValue([{ id: 'dev1', studentName: 'Марко' }]);

  renderView();
  fireEvent.change(screen.getByPlaceholderText('Код (6 цифри)'), { target: { value: 'AB12CD' } });
  fireEvent.change(screen.getByPlaceholderText('Твое ime и презиме'), { target: { value: 'Марко' } });
  fireEvent.click(screen.getByRole('button', { name: /Приклучи се/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'answer-q0' })).toBeTruthy());
}

describe('ExamPlayerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows an error and resets the join button instead of spinning forever when join fails', async () => {
    getExamSessionByCode.mockRejectedValue(new Error('network down'));
    renderView();

    fireEvent.change(screen.getByPlaceholderText('Код (6 цифри)'), { target: { value: 'AB12CD' } });
    fireEvent.change(screen.getByPlaceholderText('Твое ime и презиме'), { target: { value: 'Марко' } });
    fireEvent.click(screen.getByRole('button', { name: /Приклучи се/i }));

    await waitFor(() => expect(screen.getByText(/Грешка при приклучување/i)).toBeTruthy());
    // Button must return to its clickable label, not stay stuck on "Се приклучувам…"
    expect(screen.getByRole('button', { name: 'Приклучи се' })).toBeTruthy();
  });

  it('reaches the solving phase and submits successfully', async () => {
    submitExamFinal.mockResolvedValue(undefined);
    await joinAndReachSolving();

    fireEvent.click(screen.getAllByRole('button', { name: /Предај/i })[0]);

    await waitFor(() => expect(screen.getByText(/Испитот е предаден/i)).toBeTruthy());
    // 4th arg is the solution-photos map (empty here — no photos captured in this test).
    expect(submitExamFinal).toHaveBeenCalledWith('sess1', 'dev1', expect.any(Number), {});
  });

  it('shows a notification and stays in solving phase (does not lose the exam) when submit fails', async () => {
    submitExamFinal.mockRejectedValue(new Error('offline'));
    await joinAndReachSolving();

    fireEvent.click(screen.getAllByRole('button', { name: /Предај/i })[0]);

    await waitFor(() => expect(screen.getByText(/Предавањето не успеа/i)).toBeTruthy());
    // Still on the solving phase — did NOT silently jump to "submitted"
    expect(screen.queryByText(/Испитот е предаден/i)).toBeNull();
  });

  it('warns when an answer fails to sync, and clears the warning once a later save succeeds', async () => {
    saveExamAnswer.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    await joinAndReachSolving();

    fireEvent.click(screen.getByRole('button', { name: 'answer-q0' }));
    await waitFor(() => expect(screen.getByText(/сè уште не се зачувани/i)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'answer-q0' }));
    await waitFor(() => expect(screen.queryByText(/сè уште не се зачувани/i)).toBeNull());
  });
});
