import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildPhases, formatTime, ClassroomView } from './ClassroomView';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../contexts/PlannerContext', () => ({
  usePlanner: () => ({
    getLessonPlan: (id: string) =>
      id === 'plan-1'
        ? {
            id: 'plan-1',
            title: 'Линеарни равенки',
            theme: 'Линеарни равенки',
            grade: 8,
            subject: 'Математика',
            scenario: {
              introductory: { text: 'Вовед во темата' },
              main: [{ text: 'Главна активност 1' }],
              concluding: { text: 'Сумирање на научено' },
            },
          }
        : undefined,
  }),
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { uid: 'teacher-1' } }),
}));

vi.mock('../services/firestoreService.classroom', () => ({
  saveClassroomExecution: vi.fn().mockResolvedValue('exec-1'),
}));

vi.mock('../services/geminiService', () => ({
  geminiService: {
    getChatResponseStream: vi.fn(async function* () { yield 'AI препорака'; }),
  },
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── buildPhases unit tests ────────────────────────────────────────────────────

describe('buildPhases', () => {
  it('produces 3 phases for 40-min lesson', () => {
    const phases = buildPhases(40);
    expect(phases).toHaveLength(3);
    expect(phases[0].key).toBe('intro');
    expect(phases[1].key).toBe('main');
    expect(phases[2].key).toBe('conclusion');
  });

  it('phase minutes sum to total lesson minutes', () => {
    const phases = buildPhases(40);
    const total = phases.reduce((s, p) => s + p.minutes, 0);
    expect(total).toBe(40);
  });

  it('conclusion is always 5 minutes', () => {
    expect(buildPhases(40)[2].minutes).toBe(5);
    expect(buildPhases(45)[2].minutes).toBe(5);
  });

  it('intro is 25% of total (rounded)', () => {
    expect(buildPhases(40)[0].minutes).toBe(10);
    expect(buildPhases(45)[0].minutes).toBe(11);
  });

  it('main gets remaining minutes', () => {
    // 40 - 10 intro - 5 conclusion = 25
    expect(buildPhases(40)[1].minutes).toBe(25);
    // 45 - 11 intro - 5 conclusion = 29
    expect(buildPhases(45)[1].minutes).toBe(29);
  });
});

// ── formatTime unit tests ─────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('00:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(10 * 60)).toBe('10:00');
    expect(formatTime(10 * 60 + 7)).toBe('10:07');
  });

  it('pads single-digit minutes', () => {
    expect(formatTime(5 * 60)).toBe('05:00');
  });
});

// ── ClassroomView render tests ────────────────────────────────────────────────

describe('ClassroomView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows not-found state when no plan found', () => {
    render(<ClassroomView lessonPlanId="unknown-id" />);
    expect(screen.getByText(/Планот не е пронајден/)).toBeTruthy();
  });

  it('shows not-found state when no lessonPlanId prop', () => {
    render(<ClassroomView />);
    expect(screen.getByText(/Нема избран план/)).toBeTruthy();
  });

  it('renders lesson title and grade when plan found', () => {
    render(<ClassroomView lessonPlanId="plan-1" />);
    expect(screen.getByText('Линеарни равенки')).toBeTruthy();
    expect(screen.getByText(/8\. одд/)).toBeTruthy();
  });

  it('shows Start button before class begins', () => {
    render(<ClassroomView lessonPlanId="plan-1" />);
    // getByRole finds the button specifically (not the hint text paragraph)
    expect(screen.getByRole('button', { name: /Стартувај час/ })).toBeTruthy();
  });

  it('shows 3 phase cards', () => {
    render(<ClassroomView lessonPlanId="plan-1" />);
    // Phase labels appear as h3 elements — exact match avoids collision
    expect(screen.getAllByText('Вовод')).toBeTruthy();
    expect(screen.getAllByText('Главен дел')).toBeTruthy();
    expect(screen.getAllByText('Завршница')).toBeTruthy();
  });

  it('renders scenario text in phase cards', () => {
    render(<ClassroomView lessonPlanId="plan-1" />);
    expect(screen.getByText('Вовед во темата')).toBeTruthy();
  });

  it('shows Pause and End controls after Start clicked', () => {
    render(<ClassroomView lessonPlanId="plan-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Стартувај час/ }));
    expect(screen.getByText(/Пауза/)).toBeTruthy();
    expect(screen.getByText(/Заврши час/)).toBeTruthy();
  });
});
