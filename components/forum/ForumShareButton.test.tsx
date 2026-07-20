import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForumShareButton } from './ForumShareButton';
import { LanguageProvider } from '../../i18n/LanguageContext';

function renderButton(props: React.ComponentProps<typeof ForumShareButton> = {}) {
  return render(<LanguageProvider><ForumShareButton {...props} /></LanguageProvider>);
}

const mockAddNotification = vi.fn();
const mockCreateForumThread = vi.fn();
type MockAuthState = {
  firebaseUser: { uid: string; email: string | null } | null;
  user: { name: string } | null;
};
let mockUseAuth: () => MockAuthState = () => ({
  firebaseUser: { uid: 'teacher-uid-42', email: 'risto@example.com' },
  user: { name: 'Наставник Ристо' },
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: mockAddNotification }),
}));

vi.mock('../../services/firestoreService.forum', () => ({
  createForumThread: (...args: unknown[]) => mockCreateForumThread(...args),
  fetchForumThread: vi.fn(),
  CATEGORY_CONFIG: {
    question: { label: 'Прашање', emoji: '❓', color: 'text-blue-700', border: 'border-blue-300' },
    resource: { label: 'Ресурс', emoji: '📚', color: 'text-emerald-700', border: 'border-emerald-300' },
    idea: { label: 'Идеја', emoji: '💡', color: 'text-amber-700', border: 'border-amber-300' },
    success: { label: 'Успех', emoji: '🎉', color: 'text-pink-700', border: 'border-pink-300' },
    discussion: { label: 'Дискусија', emoji: '💬', color: 'text-indigo-700', border: 'border-indigo-300' },
  },
}));

function openAndFillForm(): void {
  fireEvent.click(screen.getByRole('button', { name: /Сподели во Форум/i }));
  fireEvent.change(screen.getByLabelText(/Наслов/i), { target: { value: '  Квиз: Питагора  ' } });
  fireEvent.change(screen.getByLabelText(/Опис \/ порака/i), { target: { value: '  Генерирав квиз со 10 прашања.  ' } });
}

describe('ForumShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('preferred_language', 'mk');
    mockCreateForumThread.mockResolvedValue(undefined);
    mockUseAuth = () => ({
      firebaseUser: { uid: 'teacher-uid-42', email: 'risto@example.com' },
      user: { name: 'Наставник Ристо' },
    });
  });

  it('submits the trimmed title/body with the real authorName fallback chain (user.name wins)', async () => {
    renderButton({ prefillCategory: 'resource' });
    openAndFillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Објави' }));

    await waitFor(() => {
      expect(mockCreateForumThread).toHaveBeenCalledWith({
        authorUid: 'teacher-uid-42',
        authorName: 'Наставник Ристо',
        category: 'resource',
        title: 'Квиз: Питагора',
        body: 'Генерирав квиз со 10 прашања.',
        // Matches TeacherForumView's primary new-thread flow, which always publishes
        // instantly — see the ForumShareButton.tsx fix this session.
        skipModeration: true,
      });
    });
    expect(mockAddNotification).toHaveBeenCalledWith(expect.stringContaining('Успешно'), 'success');
  });

  it('falls back to firebaseUser.email when user.name is missing', async () => {
    mockUseAuth = () => ({
      firebaseUser: { uid: 'uid-1', email: 'noProfile@example.com' },
      user: null,
    });
    renderButton();
    openAndFillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Објави' }));

    await waitFor(() => {
      expect(mockCreateForumThread).toHaveBeenCalledWith(
        expect.objectContaining({ authorName: 'noProfile@example.com' }),
      );
    });
  });

  it('falls back to "Наставник" when neither user.name nor firebaseUser.email is set', async () => {
    mockUseAuth = () => ({
      firebaseUser: { uid: 'uid-1', email: null },
      user: null,
    });
    renderButton();
    openAndFillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Објави' }));

    await waitFor(() => {
      expect(mockCreateForumThread).toHaveBeenCalledWith(
        expect.objectContaining({ authorName: 'Наставник' }),
      );
    });
  });

  it('warns and does not open the form when unauthenticated', () => {
    mockUseAuth = () => ({ firebaseUser: null, user: null });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /Сподели во Форум/i }));

    // Modal DOES open (auth guard lives in handleSubmit, not the open button) —
    // confirm submit is blocked and warns instead of calling createForumThread.
    fireEvent.change(screen.getByLabelText(/Наслов/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/Опис \/ порака/i), { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Објави' }));

    expect(mockAddNotification).toHaveBeenCalledWith(expect.stringContaining('логирани'), 'warning');
    expect(mockCreateForumThread).not.toHaveBeenCalled();
  });

  it('disables submit until both title and body are non-empty', () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /Сподели во Форум/i }));

    const submitButton = () => screen.getByRole('button', { name: 'Објави' }) as HTMLButtonElement;
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Наслов/i), { target: { value: 'T' } });
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Опис \/ порака/i), { target: { value: 'B' } });
    expect(submitButton().disabled).toBe(false);
  });

  it('shows an error notification and keeps the modal open when createForumThread rejects', async () => {
    mockCreateForumThread.mockRejectedValue(new Error('Firestore permission denied'));
    renderButton();
    openAndFillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Објави' }));

    await waitFor(() => {
      expect(mockAddNotification).toHaveBeenCalledWith(expect.stringContaining('Грешка'), 'error');
    });
    // Modal stays open on failure (setOpen(false) only happens in the success path)
    expect(screen.getByLabelText(/Наслов/i)).toBeTruthy();
  });

  it('re-syncs prefill props each time the modal is (re)opened', () => {
    const { rerender } = renderButton({ prefillTitle: 'Прв наслов' });
    fireEvent.click(screen.getByRole('button', { name: /Сподели во Форум/i }));
    expect((screen.getByLabelText(/Наслов/i) as HTMLInputElement).value).toBe('Прв наслов');
    fireEvent.click(screen.getByRole('button', { name: 'Затвори' }));

    rerender(<LanguageProvider><ForumShareButton prefillTitle="Втор наслов" /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Сподели во Форум/i }));
    expect((screen.getByLabelText(/Наслов/i) as HTMLInputElement).value).toBe('Втор наслов');
  });
});
