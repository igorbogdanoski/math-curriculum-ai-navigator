import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LessonStudyView } from './LessonStudyView';
import type { ScenarioObservation } from '../services/firestoreService.scenarioObservations';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'teacher1' },
    user: { name: 'Тест Наставник', schoolName: 'ОУ Тест' },
  }),
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: vi.fn() }),
}));

const mockObs: ScenarioObservation[] = [
  {
    id: 'obs1',
    scenarioId: 'Линеарни равенки',
    authorUid: 'teacher1',
    authorName: 'Тест Наставник',
    schoolName: 'ОУ Тест',
    role: 'delivered',
    whatWorked: 'Учениците беа ангажирани',
    whatToImprove: 'Треба повеќе примери',
    engagementLevel: 4,
    observedGrade: 8,
    observedAt: null,
  },
  {
    id: 'obs2',
    scenarioId: 'Геометрија',
    authorUid: 'teacher1',
    authorName: 'Тест Наставник',
    schoolName: 'ОУ Тест',
    role: 'observed',
    whatWorked: 'Добра организација',
    whatToImprove: '',
    engagementLevel: 3,
    observedGrade: 7,
    observedAt: null,
  },
];

vi.mock('../services/firestoreService.scenarioObservations', () => ({
  fetchObservationsByTeacher: vi.fn(async () => mockObs),
  submitObservation: vi.fn(async () => 'new-id'),
}));

vi.mock('../services/geminiService', () => ({
  geminiService: {
    getChatResponseStream: vi.fn(async function* () { yield 'Преглед на реализацијата'; }),
  },
}));

// react-helmet-async
vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LessonStudyView', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the hub header', () => {
    render(<LessonStudyView />);
    expect(screen.getByText(/Lesson Study Hub/i)).toBeTruthy();
  });

  it('loads and shows observations', async () => {
    render(<LessonStudyView />);
    await waitFor(() => {
      expect(screen.getByText(/Линеарни равенки/)).toBeTruthy();
      expect(screen.getByText(/Геометрија/)).toBeTruthy();
    });
  });

  it('shows observation count badge', async () => {
    render(<LessonStudyView />);
    await waitFor(() => {
      expect(screen.getByText(/Набљудувања \(2\)/)).toBeTruthy();
    });
  });

  it('expands observation to show detail', async () => {
    render(<LessonStudyView />);
    await waitFor(() => expect(screen.queryByText(/Линеарни равенки/)).toBeTruthy());
    // Click the collapsible row button that contains the scenario name
    const rowBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Линеарни равенки'));
    expect(rowBtn).toBeTruthy();
    fireEvent.click(rowBtn!);
    await waitFor(() => {
      expect(screen.queryByText(/Учениците беа ангажирани/)).toBeTruthy();
    });
  });

  it('shows AI Report button when ≥2 observations', async () => {
    render(<LessonStudyView />);
    await waitFor(() => expect(screen.queryByText(/AI Извештај/)).toBeTruthy());
  });

  it('streams AI report on button click', async () => {
    render(<LessonStudyView />);
    await waitFor(() => expect(screen.queryByText(/AI Извештај/)).toBeTruthy());
    fireEvent.click(screen.getByText(/AI Извештај/));
    await waitFor(() => {
      expect(screen.queryByText(/МОН Lesson Study Извештај/)).toBeTruthy();
      expect(screen.queryByText(/Преглед на реализацијата/)).toBeTruthy();
    });
  });

  it('toggles new observation form', async () => {
    render(<LessonStudyView />);
    fireEvent.click(screen.getByText(/Ново набљудување/));
    expect(screen.queryByText(/Внеси набљудување/)).toBeTruthy();
    fireEvent.click(screen.getByText('Откажи'));
    await waitFor(() => {
      expect(screen.queryByText(/Внеси набљудување/)).toBeNull();
    });
  });

  it('shows empty state when no observations', async () => {
    const { fetchObservationsByTeacher } = await import('../services/firestoreService.scenarioObservations');
    vi.mocked(fetchObservationsByTeacher).mockResolvedValueOnce([]);
    render(<LessonStudyView />);
    await waitFor(() => {
      expect(screen.queryByText(/Нема набљудувања/)).toBeTruthy();
    });
  });
});
