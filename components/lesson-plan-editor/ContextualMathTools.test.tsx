import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextualMathTools } from './ContextualMathTools';

describe('ContextualMathTools', () => {
  it('renders nothing when topicTitle is empty', () => {
    const { container } = render(<ContextualMathTools topicTitle="" onNavigate={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the domain label for the detected topic', () => {
    render(<ContextualMathTools topicTitle="Линеарни равенки" onNavigate={vi.fn()} />);
    expect(screen.getByText(/Алгебра/)).toBeTruthy();
  });

  // Wave 9.1 (audit_2026_07_18_full_app_review, 2026-07-19 post-closure): grade-aware filtering
  it('excludes secondary-only tools (trig) for a primary-grade topic', async () => {
    const onNavigate = vi.fn();
    render(
      <ContextualMathTools
        topicTitle="Тригонометриски функции"
        gradeContext={{ grade: 6 }}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByText(/Геометрија/));
    expect(screen.queryByText('Тригонометрија лаб')).toBeNull();
  });

  it('includes secondary-only tools (trig) for a secondary-grade topic', async () => {
    const onNavigate = vi.fn();
    render(
      <ContextualMathTools
        topicTitle="Тригонометриски функции"
        gradeContext={{ grade: 10 }}
        onNavigate={onNavigate}
      />,
    );
    await userEvent.click(screen.getByText(/Геометрија/));
    expect(screen.getByText('Тригонометрија лаб')).toBeTruthy();
  });

  it('calls onNavigate with the tool route when clicked', async () => {
    const onNavigate = vi.fn();
    render(<ContextualMathTools topicTitle="Собирање дропки" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText(/Аритметика/));
    await userEvent.click(screen.getByText('Дропки лаб'));
    expect(onNavigate).toHaveBeenCalledWith('/data-viz?tab=fractions');
  });
});
