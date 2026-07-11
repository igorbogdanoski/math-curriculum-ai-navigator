/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudentShell } from './StudentShell';

const navigate = vi.fn();
const setLanguage = vi.fn();
const signOutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ language: 'mk', setLanguage }),
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate }),
}));

vi.mock('../../firebaseConfig', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: (...args: unknown[]) => signOutMock(...args) }));

describe('StudentShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders children without any teacher-shell chrome (no Sidebar/BottomNavBar/credits widget)', () => {
    render(
      <StudentShell path="/tutor">
        <div data-testid="student-content">AI Тутор</div>
      </StudentShell>,
    );
    expect(screen.getByTestId('student-content')).toBeTruthy();
    // The audit's exact finding: a billing widget and teacher Sign Out button
    // must never render on a student route. StudentShell doesn't import
    // Sidebar/BottomNavBar/credits UI at all, so their absence is structural,
    // not just a missing prop — assert on the visible text anyway as a guard.
    expect(screen.queryByText(/Кредити/i)).toBeNull();
  });

  it('shows a home shortcut on non-dashboard, non-login pages but not on the dashboard itself', () => {
    const { rerender } = render(
      <StudentShell path="/tutor"><div /></StudentShell>,
    );
    expect(screen.getByLabelText('Почетна')).toBeTruthy();

    rerender(<StudentShell path="/student"><div /></StudentShell>);
    expect(screen.queryByLabelText('Почетна')).toBeNull();
  });

  it('hides the logout button on the login page but shows it everywhere else', () => {
    const { rerender } = render(
      <StudentShell path="/student/login"><div /></StudentShell>,
    );
    expect(screen.queryByLabelText('Одјави се')).toBeNull();

    rerender(<StudentShell path="/portfolio"><div /></StudentShell>);
    expect(screen.getByLabelText('Одјави се')).toBeTruthy();
  });

  it('logs out via signOut + clears student localStorage keys + navigates to student login', async () => {
    localStorage.setItem('studentName', 'Ана');
    localStorage.setItem('student_google_uid', 'abc');
    render(<StudentShell path="/portfolio"><div /></StudentShell>);

    fireEvent.click(screen.getByLabelText('Одјави се'));

    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled());
    expect(localStorage.getItem('studentName')).toBeNull();
    expect(localStorage.getItem('student_google_uid')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/student/login');
  });

  it('lets the student switch the interface language', () => {
    render(<StudentShell path="/tutor"><div /></StudentShell>);
    fireEvent.change(screen.getByLabelText('Избери јазик на интерфејсот'), { target: { value: 'tr' } });
    expect(setLanguage).toHaveBeenCalledWith('tr');
  });
});
