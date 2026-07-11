/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentTutorView } from './StudentTutorView';

vi.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: null }),
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../services/geminiService', () => ({
  geminiService: { askTutor: vi.fn().mockResolvedValue('...') },
}));

vi.mock('../services/firestoreService', () => ({
  firestoreService: { fetchQuizResultsByStudentName: vi.fn().mockResolvedValue([]) },
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
});
