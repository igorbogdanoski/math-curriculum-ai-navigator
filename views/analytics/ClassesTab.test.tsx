import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassesTab } from './ClassesTab';

const addNotification = vi.fn();

vi.mock('../../services/firestoreService', () => ({
  firestoreService: {
    fetchClasses: vi.fn().mockResolvedValue([]),
    createClass: vi.fn().mockResolvedValue('class-new'),
    generateClassJoinCode: vi.fn().mockResolvedValue('ABC123'),
  },
}));

vi.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification }),
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../../components/common/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/common/SilentErrorBoundary', () => ({
  SilentErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/common/Skeleton', () => ({
  SkeletonList: () => <div>loading</div>,
}));

vi.mock('../../components/common/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('../../components/analytics/ClassCard', () => ({
  ClassCard: () => <div>class-card</div>,
}));

describe('ClassesTab — create flow auto-generates a join code', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generates a join code for the new class immediately after creation and surfaces it in a notification', async () => {
    const { firestoreService } = await import('../../services/firestoreService');
    render(<ClassesTab teacherUid="teacher-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /Ново одделение/i }));
    fireEvent.change(screen.getByPlaceholderText(/Назив на одделението/i), { target: { value: 'V-б' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'analytics.classes.create' }));
    });

    expect(firestoreService.createClass).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'V-б', teacherUid: 'teacher-1' })
    );
    expect(firestoreService.generateClassJoinCode).toHaveBeenCalledWith('class-new');
    expect(addNotification).toHaveBeenCalledWith(expect.stringContaining('ABC123'), 'success');
  });
});
