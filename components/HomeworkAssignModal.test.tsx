import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HomeworkAssignModal } from './HomeworkAssignModal';

const mockAddNotification = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Наставник' }, firebaseUser: { uid: 'teacher1' } }),
}));
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: mockAddNotification }),
}));
vi.mock('../services/firestoreService.classroom', () => ({
  fetchClasses: vi.fn(async () => []),
  createHomeworkAssignment: vi.fn(async () => undefined),
}));

describe('HomeworkAssignModal — accessibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the dialog as an accessible modal labelled by its own heading', async () => {
    render(<HomeworkAssignModal materialTitle="Тест" onClose={vi.fn()} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Задај домашна задача');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<HomeworkAssignModal materialTitle="Тест" onClose={onClose} />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
