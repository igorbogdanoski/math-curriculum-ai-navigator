/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { GammaModeModal } from '../GammaModeModal';
import type { AIGeneratedPresentation, AIGeneratedAssessment } from '../../../types';

const mockUseAuth = vi.fn(() => ({ user: null, firebaseUser: null as { uid: string } | null }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: vi.fn() }),
}));

const mockSaveGammaPresentation = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/gammaPresentationService', () => ({
  saveGammaPresentation: (...args: unknown[]) => mockSaveGammaPresentation(...args),
}));

vi.mock('../../math/Shape3DViewer', () => ({
  SHAPE_ORDER: ['cube'],
  Shape3DViewer: () => <div>shape-viewer</div>,
}));

vi.mock('../../dataviz/ChartPreview', () => ({
  ChartPreview: () => <div>chart-preview</div>,
}));

vi.mock('../../common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('../SlideSVGRenderer', () => ({
  SlideSVGRenderer: () => <div>svg-renderer</div>,
}));

vi.mock('../../../services/gemini/svg', () => ({
  generateMathSVG: vi.fn(async () => '<svg></svg>'),
}));

vi.mock('../InteractiveQuizPlayer', () => ({
  InteractiveQuizPlayer: () => <div>quiz-player</div>,
}));

const mockExitTicketState: { exitTicket: AIGeneratedAssessment | null } = { exitTicket: null };
vi.mock('../gamma/useGammaExitTicket', () => ({
  useGammaExitTicket: () => ({
    exitTicket: mockExitTicketState.exitTicket,
    isGenerating: false,
    generate: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const mockStartGammaLive = vi.fn().mockResolvedValue('654321');
const mockSendGammaExitTicket = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/gammaLiveService', () => ({
  startGammaLive: (...args: unknown[]) => mockStartGammaLive(...args),
  endGammaLive: vi.fn().mockResolvedValue(undefined),
  subscribeGammaSession: vi.fn(() => () => {}),
  subscribeGammaResponses: vi.fn(() => () => {}),
  broadcastGammaSlide: vi.fn().mockResolvedValue(undefined),
  setGammaPollOptions: vi.fn().mockResolvedValue(undefined),
  revealGammaPollResults: vi.fn().mockResolvedValue(undefined),
  sendGammaExitTicket: (...args: unknown[]) => mockSendGammaExitTicket(...args),
  tallyPollResponses: vi.fn(() => ({})),
}));

function makePresentation(slides: AIGeneratedPresentation['slides']): AIGeneratedPresentation {
  return {
    title: 'Gamma test',
    topic: 'Алгебра',
    gradeLevel: 9,
    slides,
  };
}

describe('GammaModeModal hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: null });

    window.katex = {
      renderToString: (latex: string) => `<span>${latex}</span>`,
    };

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };

    (globalThis as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb) => {
      cb(0);
      return 1;
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
      putImageData: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '#ef4444',
      lineWidth: 3,
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('shows concept and explicit prior formulas in context strip', () => {
    const data = makePresentation([
      {
        title: 'Формула',
        type: 'formula-centered',
        content: ['a^2 + b^2 = c^2'],
      },
      {
        title: 'Пример',
        type: 'example',
        concept: 'Линеарни равенки',
        priorFormulas: [' y = mx + b '],
        content: ['Реши: y = 2x + 1'],
        solution: ['x = 2'],
      },
    ]);

    render(<GammaModeModal data={data} startIndex={1} onClose={vi.fn()} />);

    expect(screen.getByText('Концепт: Линеарни равенки')).toBeTruthy();
    expect(document.body.textContent).toContain('y = mx + b');
  });

  it('falls back to inferred formulas from previous slides', () => {
    const data = makePresentation([
      {
        title: 'Формула',
        type: 'formula-centered',
        content: ['a^2 + b^2 = c^2'],
      },
      {
        title: 'Пример',
        type: 'example',
        content: ['Примени теорема на правоаголен триаголник'],
        solution: ['c = 5'],
      },
    ]);

    render(<GammaModeModal data={data} startIndex={1} onClose={vi.fn()} />);

    expect(document.body.textContent).toContain('a^2 + b^2 = c^2');
    expect(screen.getByText('Концепт: Алгебра')).toBeTruthy();
  });

  it('navigates via keyboard and progress dots with reduced-motion mode', () => {
    const data = makePresentation([
      { title: 'Прв', type: 'content', content: ['x + 1'] },
      { title: 'Втор', type: 'content', content: ['x + 2'] },
      { title: 'Трет', type: 'content', content: ['x + 3'] },
    ]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Втор')).toBeTruthy();

    fireEvent.click(screen.getByTitle('Оди на слајд 3'));
    expect(screen.getByText('Трет')).toBeTruthy();

    expect(document.querySelector('.gamma-enter-right')).toBeNull();
    expect(document.querySelector('.gamma-enter-left')).toBeNull();
    expect(document.querySelector('.gamma-enter-up')).toBeNull();
    expect(document.querySelector('.gamma-enter-fade-scale')).toBeNull();

    const dialog = screen.getByRole('dialog', { name: 'Gamma Mode презентација' });
    expect(dialog).toBeTruthy();
    expect(document.activeElement).toBe(dialog);
  });
});

describe('GammaModeModal — auto-save to the Gamma library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: null });
    window.katex = { renderToString: (latex: string) => `<span>${latex}</span>` };
  });

  it('saves the presentation once a logged-in teacher opens it', () => {
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: { uid: 'teacher-1' } });
    const data = makePresentation([{ title: 'Прв', type: 'content', content: ['x + 1'] }]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} />);

    expect(mockSaveGammaPresentation).toHaveBeenCalledTimes(1);
    expect(mockSaveGammaPresentation).toHaveBeenCalledWith('teacher-1', data);
  });

  it('does not save when there is no logged-in firebaseUser (e.g. an anonymous student view)', () => {
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: null });
    const data = makePresentation([{ title: 'Прв', type: 'content', content: ['x + 1'] }]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} />);

    expect(mockSaveGammaPresentation).not.toHaveBeenCalled();
  });

  it('does not re-save when reopened from the library (skipLibrarySave)', () => {
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: { uid: 'teacher-1' } });
    const data = makePresentation([{ title: 'Прв', type: 'content', content: ['x + 1'] }]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} skipLibrarySave />);

    expect(mockSaveGammaPresentation).not.toHaveBeenCalled();
  });
});

describe('GammaModeModal — broadcasting the exit ticket to students (F3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, firebaseUser: { uid: 'teacher-1' } });
    window.katex = { renderToString: (latex: string) => `<span>${latex}</span>` };
    mockExitTicketState.exitTicket = null;
    mockStartGammaLive.mockResolvedValue('654321');
  });

  it('only offers the send button once a live session is running, and marks it sent afterwards', async () => {
    mockExitTicketState.exitTicket = { title: 'Exit Ticket', questions: [] } as unknown as AIGeneratedAssessment;
    const data = makePresentation([
      { title: 'Заклучок', type: 'summary', content: ['Резиме'] },
    ]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} />);

    // No live session yet — the exit ticket preview shows, but nowhere to broadcast it to.
    expect(screen.queryByText('Испрати до учениците')).toBeNull();

    fireEvent.click(screen.getByTitle('Старт Gamma Live — ученици се приклучуваат со PIN'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const sendButton = screen.getByText('Испрати до учениците');
    fireEvent.click(sendButton);
    await act(async () => { await Promise.resolve(); });

    expect(mockSendGammaExitTicket).toHaveBeenCalledWith('654321', mockExitTicketState.exitTicket);
    expect(screen.getByText('Испратено до учениците')).toBeTruthy();
  });

  it('does not show a send button when there is no exit ticket yet, even during a live session', async () => {
    const data = makePresentation([
      { title: 'Заклучок', type: 'summary', content: ['Резиме'] },
    ]);

    render(<GammaModeModal data={data} startIndex={0} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Старт Gamma Live — ученици се приклучуваат со PIN'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.queryByText('Испрати до учениците')).toBeNull();
  });
});
