import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialFeedbackModal } from './MaterialFeedbackModal';

describe('MaterialFeedbackModal', () => {
  it('supports revision and reject flows with structured reason selection', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <MaterialFeedbackModal
        materialId="question-1"
        materialTitle="Fractions Question"
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: /Inaccurate/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Core arithmetic is wrong.' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        status: 'rejected',
        reasonCodes: ['accuracy'],
        comments: 'Core arithmetic is wrong.',
      });
    });
  });

  it('shows validation when non-approved feedback has no reason code', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <MaterialFeedbackModal
        materialId="question-2"
        materialTitle="Decimals Question"
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

    expect(screen.getByText(/Select at least one feedback reason/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears stale reasons when switching to approve', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <MaterialFeedbackModal
        materialId="question-3"
        materialTitle="Geometry Question"
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: /Inaccurate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        status: 'approved',
        reasonCodes: [],
        comments: '',
      });
    });
  });
});