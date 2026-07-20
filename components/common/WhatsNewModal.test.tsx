/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WhatsNewModal } from './WhatsNewModal';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

const mockUseAuth = vi.fn<() => { firebaseUser: { uid: string } | null }>(() => ({ firebaseUser: { uid: 'teacher-1' } }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Raw, untranslated i18n keys must never leak into the rendered UI.
const RAW_KEY_PATTERN = /\bwhatsNew\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderModal(lang: Language = 'mk') {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><WhatsNewModal /></LanguageProvider>);
}

describe('WhatsNewModal', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    window.location.hash = '';
    mockUseAuth.mockReturnValue({ firebaseUser: { uid: 'teacher-1' } });
  });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`opens for a first-time visitor and renders without leaking raw i18n keys (${lang})`, () => {
      renderModal(lang);
      expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      // First slide's "try it" link should be present since every feature has a deepLink.
      expect(screen.getAllByRole('tab').length).toBe(5);
    });
  });

  it('does not reopen once the current STORAGE_KEY is already marked as seen', () => {
    localStorage.setItem('whats_new_2026_07_wave14_seen', '1');
    renderModal();
    expect(screen.queryAllByRole('tab').length).toBe(0);
  });

  it('does not open over a student-shell route', () => {
    window.location.hash = '#/student/dashboard';
    renderModal();
    expect(screen.queryAllByRole('tab').length).toBe(0);
  });

  it('carousel: next/prev arrows and dot navigation move between slides without leaking raw keys', () => {
    renderModal();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    const [prevBtn, nextBtn] = screen.getAllByRole('button').filter(b =>
      b.getAttribute('aria-label') === 'Претходно' || b.getAttribute('aria-label') === 'Следно',
    );
    fireEvent.click(nextBtn);
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);

    fireEvent.click(prevBtn);
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');

    // Jump directly via a dot.
    fireEvent.click(tabs[3]);
    expect(screen.getAllByRole('tab')[3].getAttribute('aria-selected')).toBe('true');
    expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
  });

  it('"Try it" navigates via hash and dismisses the modal', () => {
    renderModal();
    const tryItBtn = screen.getByText('Пробај го').closest('button')!;
    fireEvent.click(tryItBtn);

    expect(window.location.hash).toBe('#/data-viz?tab=trig');
    expect(screen.queryAllByRole('tab').length).toBe(0);
    expect(localStorage.getItem('whats_new_2026_07_wave14_seen')).toBe('1');
  });

  it('dismiss button closes the modal and marks it as seen', () => {
    renderModal();
    fireEvent.click(screen.getByText('Разбрав, да почнеме!'));
    expect(screen.queryAllByRole('tab').length).toBe(0);
    expect(localStorage.getItem('whats_new_2026_07_wave14_seen')).toBe('1');
  });

  it('does not show the referral box for a logged-out visitor', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null });
    renderModal();
    expect(screen.queryByText(/Сподели со колеги/)).toBeNull();
  });
});
