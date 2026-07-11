/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { StepByStepSolver } from './StepByStepSolver';

const mockCoachLiveWork = vi.fn();
vi.mock('../services/geminiService', () => ({
  geminiService: {
    coachLiveWork: (...args: unknown[]) => mockCoachLiveWork(...args),
    explainSpecificStep: vi.fn(),
    verifyUserStep: vi.fn(),
  },
}));

vi.mock('../hooks/useVoice', () => ({
  useVoice: () => ({ speak: vi.fn() }),
}));

vi.mock('../services/firestoreService.telemetry', () => ({
  logStepEvent: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: null }),
}));

let mockHasWork = true;
let mockSnapshot: string | null = 'MOCKSNAPSHOT';
const mockCanvasClear = vi.fn();
vi.mock('./solver/DrawingCanvas', () => ({
  DrawingCanvas: React.forwardRef((props: { onStrokeEnd?: () => void }, ref: React.Ref<{ getSnapshot: () => string | null; hasWork: () => boolean; clear: () => void }>) => {
    React.useImperativeHandle(ref, () => ({
      getSnapshot: () => mockSnapshot,
      hasWork: () => mockHasWork,
      clear: mockCanvasClear,
    }));
    return <button type="button" data-testid="mock-drawing-canvas" onClick={() => props.onStrokeEnd?.()}>canvas</button>;
  }),
}));

function openCanvas() {
  fireEvent.click(screen.getByText('Цртај / работи на хартија'));
}

describe('StepByStepSolver — live AI-coached scratchpad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasWork = true;
    mockSnapshot = 'MOCKSNAPSHOT';
    mockCoachLiveWork.mockResolvedValue({ hint: 'Провери го знакот.' });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSolver() {
    return render(
      <StepByStepSolver
        problem="2x + 3 = 9"
        steps={[{ explanation: 'Одземи 3', expression: '2x = 6' }, { explanation: 'Подели со 2', expression: 'x = 3' }]}
      />,
    );
  }

  it('shows the manual check button and auto-coach toggle once the canvas is opened', () => {
    renderSolver();
    openCanvas();
    expect(screen.getByText('Провери го моето работење')).toBeTruthy();
    expect(screen.getByText('Автоматски преглед')).toBeTruthy();
  });

  it('calls coachLiveWork with the problem and hint count 0 on first manual check', async () => {
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    expect(mockCoachLiveWork).toHaveBeenCalledWith('MOCKSNAPSHOT', 'image/png', '2x + 3 = 9', 0);
  });

  it('renders the returned hint', async () => {
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Провери го знакот.')).toBeTruthy();
  });

  it('does not call coachLiveWork when the canvas has no work yet', async () => {
    mockHasWork = false;
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    expect(mockCoachLiveWork).not.toHaveBeenCalled();
  });

  it('escalates hintsGivenCount on repeated manual checks', async () => {
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    expect(mockCoachLiveWork).toHaveBeenNthCalledWith(2, 'MOCKSNAPSHOT', 'image/png', '2x + 3 = 9', 1);
  });

  it('shows a friendly Macedonian error when coachLiveWork fails', async () => {
    mockCoachLiveWork.mockRejectedValue(new Error('quota exceeded'));
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Не успеавме да го провериме работењето/)).toBeTruthy();
  });

  it('auto-coach: does nothing on stroke-end while the toggle is off (default)', () => {
    vi.useFakeTimers();
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByTestId('mock-drawing-canvas'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(mockCoachLiveWork).not.toHaveBeenCalled();
  });

  it('auto-coach: debounces and calls coachLiveWork 4s after the toggle is enabled and a stroke ends', async () => {
    vi.useFakeTimers();
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByLabelText('Автоматски преглед'));
    fireEvent.click(screen.getByTestId('mock-drawing-canvas'));
    expect(mockCoachLiveWork).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(mockCoachLiveWork).toHaveBeenCalledTimes(1);
  });

  it('clears the drawing canvas when advancing to the next step, so old ink does not leak into the next step\'s coaching context', () => {
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('ЗАПОЧНИ РЕШАВАЊЕ'));
    expect(mockCanvasClear).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('СЛЕДЕН ЧЕКОР'));
    expect(mockCanvasClear).toHaveBeenCalledTimes(2);
  });

  it('clears the drawing canvas on restart', () => {
    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('ЗАПОЧНИ РЕШАВАЊЕ')); // step 0 -> 1
    fireEvent.click(screen.getByText('СЛЕДЕН ЧЕКОР')); // step 1 -> 2
    fireEvent.click(screen.getByText('СЛЕДЕН ЧЕКОР')); // step 2 == steps.length -> complete
    fireEvent.click(screen.getByText('РЕСТАРТИРАЈ'));
    expect(mockCanvasClear).toHaveBeenCalledTimes(4);
  });

  it('does not update state (and does not log the React unmounted-component warning) if the component unmounts before coachLiveWork resolves', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolveCoach: (v: { hint: string }) => void;
    mockCoachLiveWork.mockReturnValue(new Promise(resolve => { resolveCoach = resolve; }));

    renderSolver();
    openCanvas();
    fireEvent.click(screen.getByText('Провери го моето работење'));
    cleanup();

    await act(async () => { resolveCoach!({ hint: 'ова треба да се игнорира' }); await Promise.resolve(); });

    const unmountedWarning = consoleError.mock.calls.some(call =>
      String(call[0]).includes('unmounted component'));
    expect(unmountedWarning).toBe(false);
    consoleError.mockRestore();
  });
});
