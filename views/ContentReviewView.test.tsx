import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentReviewView } from './ContentReviewView';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
    firebaseUser: { uid: 'admin-uid' },
  }),
}));

vi.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/common/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('../components/analytics/MaterialFeedbackModal', () => ({
  MaterialFeedbackModal: () => <div>Feedback Modal</div>,
}));

vi.mock('../services/firestoreService', () => ({
  firestoreService: {
    fetchUnapprovedQuestions: vi.fn().mockResolvedValue([
      {
        id: 'q-1',
        conceptId: 'c-1',
        question: '2+2?',
        answer: '4',
        type: 'multiple_choice',
        difficulty_level: 'easy',
        teacherUid: 'teacher-1',
        isApproved: false,
      },
    ]),
    recordMaterialFeedback: vi.fn(),
    updateSavedQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
}));

describe('ContentReviewView rollout reactivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('updates reject action label when rollout flag changes during session', async () => {
    window.localStorage.setItem('feedback_taxonomy_rollout_enabled', 'false');

    render(<ContentReviewView />);
    expect(await screen.findByRole('button', { name: 'Отфрли' })).toBeTruthy();

    window.localStorage.setItem('feedback_taxonomy_rollout_enabled', 'true');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(await screen.findByRole('button', { name: 'Feedback / Отфрли' })).toBeTruthy();
  });
});
