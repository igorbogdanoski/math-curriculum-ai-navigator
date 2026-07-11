/**
 * @vitest-environment jsdom
 *
 * Regression test for the 2026-07-12 publish-to-bank fix: LessonPlanLibraryView's publish
 * dialog used to write to communityLessonPlans, a collection firestore.rules has locked
 * read-only since the S102 migration to scenario_bank — every publish attempt failed with a
 * silent permission-denied. This asserts the fix actually calls the working publishScenario()
 * path and persists the result back onto the plan.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LessonPlanLibraryView } from './LessonPlanLibraryView';
import type { LessonPlan } from '../types';

const mockPublishScenario = vi.fn();
vi.mock('../services/firestoreService.scenarioBank', () => ({
  publishScenario: (...args: unknown[]) => mockPublishScenario(...args),
}));

vi.mock('../components/scenario-bank/PublishScenarioDialog', () => ({
  PublishScenarioDialog: ({ onPublish, onCancel }: { onPublish: (opts: unknown) => void; onCancel: () => void }) => (
    <div data-testid="publish-dialog">
      <button type="button" onClick={() => onPublish({ isPublic: true, teachingModel: null, dokLevel: null, authorNotes: '' })}>
        confirm-publish-public
      </button>
      <button type="button" onClick={onCancel}>cancel-publish</button>
    </div>
  ),
}));

const mockUpdateLessonPlan = vi.fn().mockResolvedValue(undefined);
const mockDeleteLessonPlan = vi.fn();
const PLAN: LessonPlan = {
  id: 'plan-1', title: 'Дропки', grade: 5, conceptIds: [], objectives: [],
  scenario: { introductory: { text: '' }, main: [], concluding: { text: '' } },
} as unknown as LessonPlan;

vi.mock('../contexts/PlannerContext', () => ({
  usePlanner: () => ({
    lessonPlans: [PLAN],
    deleteLessonPlan: mockDeleteLessonPlan,
    updateLessonPlan: (...args: unknown[]) => mockUpdateLessonPlan(...args),
    isLoading: false,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Проф. Иванова', role: 'teacher', schoolName: 'ОУ Гоце Делчев' },
    firebaseUser: { uid: 'teacher-1' },
  }),
}));

const mockAddNotification = vi.fn();
vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: mockAddNotification }),
}));

vi.mock('../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

vi.mock('../contexts/ModalContext', () => ({
  useModal: () => ({ showModal: vi.fn(), hideModal: vi.fn() }),
}));

vi.mock('../hooks/useCurriculum', () => ({
  useCurriculum: () => ({ allConcepts: [], allNationalStandards: [] }),
}));

vi.mock('../hooks/useTour', () => ({
  useTour: () => {},
}));

vi.mock('../contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({}),
}));

vi.mock('../components/common/EmptyState', () => ({
  EmptyState: () => <div>empty</div>,
}));

describe('LessonPlanLibraryView — publish-to-bank (2026-07-12 fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishScenario.mockResolvedValue('bank-doc-1');
  });

  it('opens the publish dialog and calls the working publishScenario() path on confirm', async () => {
    render(<LessonPlanLibraryView />);
    fireEvent.click(screen.getByLabelText('Објави во галерија'));
    expect(screen.getByTestId('publish-dialog')).toBeTruthy();

    fireEvent.click(screen.getByText('confirm-publish-public'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockPublishScenario).toHaveBeenCalledWith(expect.objectContaining({
      plan: PLAN,
      authorUid: 'teacher-1',
      authorName: 'Проф. Иванова',
      schoolName: 'ОУ Гоце Делчев',
      isPublic: true,
    }));
  });

  it('persists scenarioBankId and isPublished back onto the plan after a successful publish', async () => {
    render(<LessonPlanLibraryView />);
    fireEvent.click(screen.getByLabelText('Објави во галерија'));
    fireEvent.click(screen.getByText('confirm-publish-public'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockUpdateLessonPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: 'plan-1',
      isPublished: true,
      scenarioBankId: 'bank-doc-1',
    }));
  });

  it('shows a success toast and closes the dialog after a successful publish', async () => {
    render(<LessonPlanLibraryView />);
    fireEvent.click(screen.getByLabelText('Објави во галерија'));
    fireEvent.click(screen.getByText('confirm-publish-public'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockAddNotification).toHaveBeenCalledWith(expect.stringContaining('јавно споделена'), 'success');
    expect(screen.queryByTestId('publish-dialog')).toBeNull();
  });

  it('shows an error toast (not a silent failure) when publishScenario rejects', async () => {
    mockPublishScenario.mockRejectedValue(new Error('permission-denied'));
    render(<LessonPlanLibraryView />);
    fireEvent.click(screen.getByLabelText('Објави во галерија'));
    fireEvent.click(screen.getByText('confirm-publish-public'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockAddNotification).toHaveBeenCalledWith('Грешка при објавување на подготовката.', 'error');
  });
});
