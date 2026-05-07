import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InequalitySolver } from './InequalitySolver';

describe('<InequalitySolver />', () => {
  it('renders abs mode by default with formula and solution', () => {
    render(<InequalitySolver />);
    expect(screen.getByTestId('inequality-solver')).toBeTruthy();
    expect(screen.getByTestId('ineq-formula').textContent).toContain('|x');
    expect(screen.getByTestId('ineq-solution').textContent).toContain('x ∈');
  });

  it('updates solution when slider a changes', () => {
    render(<InequalitySolver />);
    const a = screen.getByTestId('ineq-abs-a') as HTMLInputElement;
    fireEvent.change(a, { target: { value: '0' } });
    expect(a.value).toBe('0');
    expect(screen.getByTestId('ineq-solution').textContent).toContain('-3');
  });

  it('switches op via keypad', () => {
    render(<InequalitySolver />);
    fireEvent.click(screen.getByTestId('ineq-abs-op->'));
    // |x − 2| > 3 → (-∞, -1) ∪ (5, ∞)
    expect(screen.getByTestId('ineq-solution').textContent).toContain('∪');
  });

  it('switches to polynomial mode and shows roots', () => {
    render(<InequalitySolver />);
    fireEvent.click(screen.getByTestId('ineq-kind-poly'));
    expect(screen.getByTestId('ineq-root-0')).toBeTruthy();
    expect(screen.getByTestId('ineq-root-add')).toBeTruthy();
  });

  it('toggles step-by-step disclosure', () => {
    render(<InequalitySolver />);
    expect(screen.queryByTestId('ineq-steps')).toBeNull();
    fireEvent.click(screen.getByTestId('ineq-steps-toggle'));
    expect(screen.getByTestId('ineq-steps')).toBeTruthy();
  });

  it('reset returns to defaults', () => {
    render(<InequalitySolver />);
    const a = screen.getByTestId('ineq-abs-a') as HTMLInputElement;
    fireEvent.change(a, { target: { value: '4' } });
    expect(a.value).toBe('4');
    fireEvent.click(screen.getByTestId('ineq-reset'));
    expect((screen.getByTestId('ineq-abs-a') as HTMLInputElement).value).toBe('2');
  });
});
