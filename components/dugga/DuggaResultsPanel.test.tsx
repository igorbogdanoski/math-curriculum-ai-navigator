/**
 * 2026-07-19 (audit_2026_07_18_full_app_review, Wave 5.2): covers the new per-student
 * drill-down + manual-grading control this file added — a submission's questions
 * with correct === null (missing answer key or a failed AI call, see
 * needsManualReview() in utils/duggaScoring.ts) get an editable points input instead
 * of being silently stuck at 0 forever.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DuggaResultsPanel } from './DuggaResultsPanel';
import { getTestSubmissions, gradeSubmissionQuestion } from '../../services/firestoreService.dugga';
import type { DuggaTest, DuggaSubmission } from '../../services/firestoreService.dugga';

vi.mock('../../services/firestoreService.dugga', () => ({
  getTestSubmissions: vi.fn(),
  gradeSubmissionQuestion: vi.fn(),
}));

function makeTest(): DuggaTest {
  return {
    id: 'test-1', title: 'Тест за прогресии', teacherUid: 't1', teacherName: 'Ана',
    grade: 11, track: 'gymnasium', topics: ['Прогресии'], testType: 'topic',
    isPublic: false, totalPoints: 10, estimatedMinutes: 20,
    createdAt: {} as any, shareCode: 'AB12CD',
    questions: [
      { id: 'q1', type: 'multiple_choice', text: 'Точен избор?', dok: 1, points: 4 },
      { id: 'q2', type: 'fill_blanks', text: 'Пополни го празното место', dok: 2, points: 6 },
    ],
  };
}

function makeSubmission(over: Partial<DuggaSubmission> = {}): DuggaSubmission {
  return {
    id: 'sub-1', testId: 'test-1', testTitle: 'Тест за прогресии', teacherUid: 't1',
    studentUid: 'u1', studentName: 'Петар Петровски',
    answers: { q1: 'a', q2: 'x=5' },
    score: 4, totalPoints: 10, percentage: 100, pendingReviewPoints: 6,
    questionResults: {
      q1: { earned: 4, maxPoints: 4, correct: true, feedback: '' },
      q2: { earned: 0, maxPoints: 6, correct: null, feedback: 'Потребно дополнително оценување' },
    },
    submittedAt: { toDate: () => new Date('2026-07-19') } as any,
    ...over,
  };
}

describe('DuggaResultsPanel — per-student manual grading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTestSubmissions).mockResolvedValue([makeSubmission()]);
  });

  it('shows a pending-review badge on the student row', async () => {
    render(<DuggaResultsPanel test={makeTest()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ученици' }));
    expect(await screen.findByLabelText('Чека рачна проверка')).toBeTruthy();
  });

  it('opens the student detail and shows an editable input only for the null-correct question', async () => {
    render(<DuggaResultsPanel test={makeTest()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ученици' }));
    fireEvent.click(await screen.findByText('Петар Петровски'));

    // q1 (graded, correct) renders as read-only text, not an input
    expect(await screen.findByText('4/4 поени ✓')).toBeTruthy();
    // q2 (correct: null) renders an input + save button
    expect(screen.getByRole('spinbutton')).toBeTruthy();
    expect(screen.getByText('Зачувај')).toBeTruthy();
  });

  it('saves a manual grade and reflects it immediately without re-fetching', async () => {
    vi.mocked(gradeSubmissionQuestion).mockResolvedValue(undefined);
    render(<DuggaResultsPanel test={makeTest()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ученици' }));
    fireEvent.click(await screen.findByText('Петар Петровски'));

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Зачувај'));

    await waitFor(() => {
      expect(gradeSubmissionQuestion).toHaveBeenCalledWith('sub-1', 'q2', 5);
    });
    // Partial credit (5 of 6) → correct=false, not null, so it now renders read-only
    expect(await screen.findByText('5/6 поени')).toBeTruthy();
    // Pending badge should be gone now that everything is graded
    expect(screen.queryByText(/поени чекаат/)).not.toBeTruthy();
  });

  it('does not call the service when the input is left empty', async () => {
    render(<DuggaResultsPanel test={makeTest()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ученици' }));
    fireEvent.click(await screen.findByText('Петар Петровски'));

    fireEvent.click(screen.getByText('Зачувај'));
    expect(gradeSubmissionQuestion).not.toHaveBeenCalled();
  });
});
