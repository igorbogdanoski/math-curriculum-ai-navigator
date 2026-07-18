/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudentTutorView } from './StudentTutorView';

vi.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const mockAuth = vi.hoisted(() => ({ firebaseUser: null as { uid: string } | null }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../services/geminiService', () => ({
  geminiService: { askTutor: vi.fn().mockResolvedValue('...') },
}));

const mockFetchQuizResultsByStudentName = vi.fn().mockResolvedValue([]);
vi.mock('../services/firestoreService', () => ({
  firestoreService: { fetchQuizResultsByStudentName: (...args: unknown[]) => mockFetchQuizResultsByStudentName(...args) },
}));

vi.mock('../services/ragService', () => ({
  ragService: {
    getConceptContext: vi.fn().mockResolvedValue(''),
    searchSimilarContext: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
}));

vi.mock('../components/common/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}));
vi.mock('../components/common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock('../components/common/DokBadge', () => ({
  DokBadge: () => <span />,
}));
vi.mock('../components/common/ForumCTA', () => ({
  ForumCTA: () => null,
}));
vi.mock('../components/common/SolutionChecker', () => ({
  SolutionChecker: () => <div data-testid="solution-checker">SolutionChecker</div>,
}));
vi.mock('../components/common/PhotoWorksheetSolver', () => ({
  PhotoWorksheetSolver: () => <div data-testid="photo-worksheet-solver">PhotoWorksheetSolver</div>,
}));

describe('StudentTutorView — homework-help entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuizResultsByStudentName.mockResolvedValue([]);
    mockAuth.firebaseUser = null;
    window.location.hash = '#/tutor';
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not show SolutionChecker or PhotoWorksheetSolver by default', () => {
    render(<StudentTutorView />);
    expect(screen.queryByTestId('solution-checker')).toBeNull();
    expect(screen.queryByTestId('photo-worksheet-solver')).toBeNull();
  });

  it('toggles PhotoWorksheetSolver open and closed independently of SolutionChecker', () => {
    render(<StudentTutorView />);

    fireEvent.click(screen.getByText('📷 Фотографирај домашна'));
    expect(screen.getByTestId('photo-worksheet-solver')).toBeTruthy();
    expect(screen.queryByTestId('solution-checker')).toBeNull();

    fireEvent.click(screen.getByText('🔍 Провери го решението'));
    expect(screen.getByTestId('solution-checker')).toBeTruthy();
    expect(screen.getByTestId('photo-worksheet-solver')).toBeTruthy();

    fireEvent.click(screen.getByText('📷 Фотографирај домашна'));
    expect(screen.queryByTestId('photo-worksheet-solver')).toBeNull();
    expect(screen.getByTestId('solution-checker')).toBeTruthy();
  });

  it('regression: does not query quiz history at all while no teacherUid is known (never falls back to an unscoped studentName-only lookup)', async () => {
    window.location.hash = '#/tutor?student=%D0%9C%D0%B0%D1%80%D0%BA%D0%BE&concept=fractions&title=%D0%94%D1%80%D0%BE%D0%BF%D0%BA%D0%B8';
    mockAuth.firebaseUser = null;

    render(<StudentTutorView />);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    expect(mockFetchQuizResultsByStudentName).not.toHaveBeenCalled();
  });

  it('regression: once a teacherUid is known, queries quiz history scoped by teacherUid+studentName (security finding, audit_2026_07_18)', async () => {
    window.location.hash = '#/tutor?student=%D0%9C%D0%B0%D1%80%D0%BA%D0%BE&concept=fractions&title=%D0%94%D1%80%D0%BE%D0%BF%D0%BA%D0%B8';
    mockAuth.firebaseUser = { uid: 'teacher-1' };

    render(<StudentTutorView />);
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });

    expect(mockFetchQuizResultsByStudentName).toHaveBeenCalledWith('Марко', undefined, 'teacher-1');
  });
});
