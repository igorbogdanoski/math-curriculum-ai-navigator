/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GammaStudentView } from './GammaStudentView';
import type { GammaLiveSession, GammaLiveResponse } from '../services/gammaLiveService';

vi.mock('../components/common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('../firebaseConfig', () => ({
  auth: { currentUser: { uid: 'student-1' } },
}));

vi.mock('firebase/auth', () => ({
  signInAnonymously: vi.fn(),
}));

let sessionCallback: ((s: GammaLiveSession | null) => void) | null = null;
let responsesCallback: ((r: GammaLiveResponse[]) => void) | null = null;
const mockSubmitGammaResponse = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/gammaLiveService', async () => {
  const actual = await vi.importActual<typeof import('../services/gammaLiveService')>('../services/gammaLiveService');
  return {
    ...actual,
    subscribeGammaSession: vi.fn((_pin: string, cb: (s: GammaLiveSession | null) => void) => {
      sessionCallback = cb;
      return () => {};
    }),
    subscribeGammaResponses: vi.fn((_pin: string, cb: (r: GammaLiveResponse[]) => void) => {
      responsesCallback = cb;
      return () => {};
    }),
    submitGammaResponse: (...args: unknown[]) => mockSubmitGammaResponse(...args),
    raiseGammaHand: vi.fn(),
    lowerGammaHand: vi.fn(),
  };
});

function baseSession(overrides: Partial<GammaLiveSession> = {}): GammaLiveSession {
  return {
    pin: '123456',
    hostUid: 'teacher-1',
    topic: 'Дропки',
    gradeLevel: 5,
    slideIdx: 0,
    slides: [{ type: 'task', title: 'Прашање', content: ['Одговори точно'] }] as GammaLiveSession['slides'],
    isActive: true,
    startedAt: null,
    responseCount: 0,
    handsUids: [],
    pollOptions: ['А', 'Б'],
    pollCorrectIndex: null,
    pollRevealed: false,
    ...overrides,
  };
}

describe('GammaStudentView — poll voting, waiting, and reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionCallback = null;
    responsesCallback = null;
  });

  it('shows poll option buttons before voting', () => {
    render(<GammaStudentView pin="123456" />);
    act(() => { sessionCallback?.(baseSession()); });

    expect(screen.getByRole('button', { name: /А/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Б/ })).toBeTruthy();
  });

  it('shows a waiting state (not results) immediately after voting, before the host reveals', async () => {
    render(<GammaStudentView pin="123456" />);
    act(() => { sessionCallback?.(baseSession()); });

    fireEvent.click(screen.getByRole('button', { name: /А/ }));
    await act(async () => { await Promise.resolve(); });

    expect(mockSubmitGammaResponse).toHaveBeenCalledWith('123456', 'student-1', 'Ученик', 0, 'А');
    expect(screen.getByText(/чекаме резултати/)).toBeTruthy();
    expect(screen.queryByText(/твојот глас/)).toBeNull();
  });

  it('shows the live tally with the student\'s own vote highlighted once revealed', async () => {
    render(<GammaStudentView pin="123456" />);
    act(() => { sessionCallback?.(baseSession()); });

    fireEvent.click(screen.getByRole('button', { name: /А/ }));
    await act(async () => { await Promise.resolve(); });

    act(() => {
      responsesCallback?.([
        { studentId: 'student-1', studentName: 'Ученик', answer: 'А', slideIdx: 0, submittedAt: null },
        { studentId: 's2', studentName: 'Друг', answer: 'Б', slideIdx: 0, submittedAt: null },
      ]);
      sessionCallback?.(baseSession({ pollRevealed: true }));
    });

    expect(screen.queryByText(/чекаме резултати/)).toBeNull();
    expect(screen.getByText(/твојот глас/)).toBeTruthy();
  });

  it('shows correct/incorrect feedback when the poll has a designated correct answer', async () => {
    render(<GammaStudentView pin="123456" />);
    act(() => { sessionCallback?.(baseSession({ pollCorrectIndex: 1 })); }); // Б is correct

    fireEvent.click(screen.getByRole('button', { name: /А/ })); // student picks the wrong one
    await act(async () => { await Promise.resolve(); });

    act(() => {
      responsesCallback?.([{ studentId: 'student-1', studentName: 'Ученик', answer: 'А', slideIdx: 0, submittedAt: null }]);
      sessionCallback?.(baseSession({ pollCorrectIndex: 1, pollRevealed: true }));
    });

    expect(screen.getByText(/Точниот одговор беше: Б/)).toBeTruthy();
  });

  it('shows no correct/incorrect language for a plain opinion poll (pollCorrectIndex null)', async () => {
    render(<GammaStudentView pin="123456" />);
    act(() => { sessionCallback?.(baseSession()); });

    fireEvent.click(screen.getByRole('button', { name: /А/ }));
    await act(async () => { await Promise.resolve(); });

    act(() => {
      responsesCallback?.([{ studentId: 'student-1', studentName: 'Ученик', answer: 'А', slideIdx: 0, submittedAt: null }]);
      sessionCallback?.(baseSession({ pollRevealed: true }));
    });

    expect(screen.queryByText(/Точно!/)).toBeNull();
    expect(screen.queryByText(/Точниот одговор беше/)).toBeNull();
  });
});
