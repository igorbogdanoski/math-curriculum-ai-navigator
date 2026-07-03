import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PlanningChainBar } from './PlanningChainBar';

const mockNavigate = vi.fn();
let mockPlanningState = {
  annualPlanId: null as string | null,
  themeName: null as string | null,
  weekRange: null as [number, number] | null,
};

vi.mock('../../contexts/PlanningContext', () => ({
  usePlanning: () => mockPlanningState,
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

function stepButton(shortLabel: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(shortLabel) });
}

describe('PlanningChainBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanningState = { annualPlanId: null, themeName: null, weekRange: null };
  });

  it('marks the active step as current via aria-current', () => {
    render(<PlanningChainBar currentStep="weekly" />);
    expect(stepButton('Неделна').getAttribute('aria-current')).toBe('step');
    expect(stepButton('Годишна').getAttribute('aria-current')).toBeNull();
  });

  it('treats every step before the current one as done, regardless of context state', () => {
    // No annualPlanId/themeName set, yet these earlier steps are still "passed" visually.
    render(<PlanningChainBar currentStep="lesson" />);
    expect(stepButton('Годишна').disabled).toBe(false);
    expect(stepButton('Тематска').disabled).toBe(false);
    expect(stepButton('Неделна').disabled).toBe(false);
  });

  it('disables steps after the current one ("upcoming")', () => {
    render(<PlanningChainBar currentStep="annual" />);
    expect(stepButton('Тематска').disabled).toBe(true);
    expect(stepButton('Неделна').disabled).toBe(true);
    expect(stepButton('Час').disabled).toBe(true);
  });

  it('navigates to a completed/current step route on click', () => {
    render(<PlanningChainBar currentStep="weekly" />);
    fireEvent.click(stepButton('Годишна'));
    expect(mockNavigate).toHaveBeenCalledWith('/annual-planner');
  });

  it('does not navigate when clicking a disabled upcoming step', () => {
    render(<PlanningChainBar currentStep="annual" />);
    fireEvent.click(stepButton('Час'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders all 4 steps in order with 3 connector arrows between them', () => {
    const { container } = render(<PlanningChainBar currentStep="thematic" />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
  });

  it('lesson step is always non-done (isDone returns false for lesson)', () => {
    // currentStep is past 'lesson' is impossible (it's the last step), so verify via
    // the connector: lesson as currentStep should still render as 'current', not 'done'.
    render(<PlanningChainBar currentStep="lesson" />);
    expect(stepButton('Час').getAttribute('aria-current')).toBe('step');
  });
});
