/**
 * Regression tests for the P3 parent-link data-scoping fix (2026-07-12).
 *
 * The /parent route previously accepted a bare ?name= param (or even a fully
 * freeform typed name with no URL context at all) with no teacher scoping —
 * anyone who knew or guessed a student's name could read their real quiz
 * history. Every path through this view must now require ?teacher=... too.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ParentPortalView } from './ParentPortalView';

vi.mock('./StudentProgressView', () => ({
  StudentProgressView: ({ name, teacherUid }: { name?: string; teacherUid?: string }) => (
    <div data-testid="student-progress-view">{name} / {teacherUid}</div>
  ),
}));

vi.mock('firebase/auth', () => ({ signInAnonymously: vi.fn() }));
vi.mock('../firebaseConfig', () => ({ auth: {} }));
vi.mock('../services/firestoreService', () => ({
  firestoreService: {
    fetchQuizResultsByStudentName: vi.fn().mockResolvedValue([]),
    fetchMasteryByStudent: vi.fn().mockResolvedValue([]),
    fetchStudentGamification: vi.fn().mockResolvedValue(null),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ParentPortalView — requires a teacher param on every path', () => {
  it('shows "invalid link" when the URL has no ?teacher= at all (no name either)', () => {
    window.location.hash = '#/parent';
    render(<ParentPortalView />);
    expect(screen.getByText(/линкот не е валиден/i)).toBeTruthy();
    expect(screen.queryByLabelText(/внесете го името/i)).toBeNull();
  });

  it('shows "invalid link" when ?name= is present but ?teacher= is missing (the old leaky shape)', () => {
    window.location.hash = '#/parent?name=%D0%9C%D0%B0%D1%80%D0%BA%D0%BE';
    render(<ParentPortalView />);
    expect(screen.getByText(/линкот не е валиден/i)).toBeTruthy();
    expect(screen.queryByTestId('student-progress-view')).toBeNull();
  });

  it('renders StudentProgressView with both name and teacherUid when both are present', () => {
    window.location.hash = '#/parent?name=%D0%9C%D0%B0%D1%80%D0%BA%D0%BE&teacher=teacher-1';
    render(<ParentPortalView />);
    expect(screen.getByTestId('student-progress-view').textContent).toBe('Марко / teacher-1');
  });

  it('shows the manual weekly-digest search form when teacher is present but name is not', () => {
    window.location.hash = '#/parent?teacher=teacher-1';
    render(<ParentPortalView />);
    expect(screen.getByLabelText(/внесете го името/i)).toBeTruthy();
    expect(screen.queryByText(/линкот не е валиден/i)).toBeNull();
  });
});
