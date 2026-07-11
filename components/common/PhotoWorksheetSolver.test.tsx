/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PhotoWorksheetSolver } from './PhotoWorksheetSolver';

const mockExtractProblemsFromImage = vi.fn();
const mockSolveSpecificProblemStepByStep = vi.fn();
const mockIsDailyQuotaKnownExhausted = vi.fn(() => false);

vi.mock('../../services/geminiService', () => ({
  geminiService: {
    extractProblemsFromImage: (...args: unknown[]) => mockExtractProblemsFromImage(...args),
    solveSpecificProblemStepByStep: (...args: unknown[]) => mockSolveSpecificProblemStepByStep(...args),
  },
  isDailyQuotaKnownExhausted: () => mockIsDailyQuotaKnownExhausted(),
}));

const mockCompressImage = vi.fn(async (file: File) => file);
vi.mock('../../utils/imageCompression', () => ({
  compressImage: (...args: unknown[]) => mockCompressImage(...(args as [File])),
}));

vi.mock('../StepByStepSolver', () => ({
  StepByStepSolver: ({ problem }: { problem: string }) => <div data-testid="step-solver">SOLVER: {problem}</div>,
}));

class MockFileReader {
  onload: ((ev: { target: { result: string } }) => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    queueMicrotask(() => this.onload?.({ target: { result: 'data:image/jpeg;base64,ZmFrZWJhc2U2NA==' } }));
  }
}

function selectFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['fake'], 'worksheet.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('PhotoWorksheetSolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDailyQuotaKnownExhausted.mockReturnValue(false);
    mockCompressImage.mockImplementation(async (file: File) => file);
    (globalThis as unknown as { FileReader: unknown }).FileReader = MockFileReader;
  });

  it('renders camera and gallery buttons', () => {
    render(<PhotoWorksheetSolver />);
    expect(screen.getByText('Камера')).toBeTruthy();
    expect(screen.getByText('Галерија')).toBeTruthy();
  });

  it('shows a quota-exhausted error and never calls the AI when the daily quota is known exhausted', async () => {
    mockIsDailyQuotaKnownExhausted.mockReturnValue(true);
    render(<PhotoWorksheetSolver />);
    selectFile();
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText(/Дневната AI квота е исцрпена/)).toBeTruthy();
    expect(mockExtractProblemsFromImage).not.toHaveBeenCalled();
  });

  it('extracts and solves every problem, rendering an accordion of results', async () => {
    mockExtractProblemsFromImage.mockResolvedValue(['Реши: 2x + 3 = 9', 'Пресметај: 5 x 6']);
    mockSolveSpecificProblemStepByStep.mockImplementation(async (p: string) => ({
      problem: p, strategy: 'Чекор по чекор', steps: [{ explanation: 'Прв чекор', expression: 'x = 3' }],
    }));

    render(<PhotoWorksheetSolver />);
    selectFile();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText(/2x \+ 3 = 9/)).toBeTruthy();
    expect(screen.getByText(/5 x 6/)).toBeTruthy();
    expect(screen.queryByTestId('step-solver')).toBeNull(); // not expanded yet

    fireEvent.click(screen.getByText(/1\. Реши: 2x \+ 3 = 9/));
    expect(screen.getByTestId('step-solver')).toBeTruthy();
  });

  it('shows a truncation notice when more than 8 problems are extracted', async () => {
    mockExtractProblemsFromImage.mockResolvedValue(Array.from({ length: 10 }, (_, i) => `Задача ${i + 1}`));
    mockSolveSpecificProblemStepByStep.mockResolvedValue({ problem: '', strategy: '', steps: [] });

    render(<PhotoWorksheetSolver />);
    selectFile();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText(/Откриени се повеќе задачи/)).toBeTruthy();
    expect(screen.queryByText('Задача 9')).toBeNull();
  });

  it('shows an error when no problems could be extracted', async () => {
    mockExtractProblemsFromImage.mockResolvedValue([]);
    render(<PhotoWorksheetSolver />);
    selectFile();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText(/Не успеавме да препознаеме задачи/)).toBeTruthy();
  });

  it('shows a per-problem fallback when one problem fails to solve (allSettled)', async () => {
    mockExtractProblemsFromImage.mockResolvedValue(['Добра задача', 'Лоша задача']);
    mockSolveSpecificProblemStepByStep.mockImplementation(async (p: string) => {
      if (p === 'Лоша задача') throw new Error('solve failed');
      return { problem: p, strategy: '', steps: [{ explanation: 'e', expression: 'x' }] };
    });

    render(<PhotoWorksheetSolver />);
    selectFile();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByText(/Не успеавме да ја решиме оваа задача/)).toBeTruthy();
    fireEvent.click(screen.getByText(/1\. Добра задача/));
    expect(screen.getByTestId('step-solver')).toBeTruthy();
  });
});
