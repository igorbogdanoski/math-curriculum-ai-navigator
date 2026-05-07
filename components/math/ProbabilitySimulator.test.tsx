import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProbabilitySimulator } from './ProbabilitySimulator';

describe('<ProbabilitySimulator />', () => {
  beforeEach(() => {
    // Pin Math.random so click outcomes are deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0.25); // < 0.5 ⇒ heads
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with coin tab active by default', () => {
    render(<ProbabilitySimulator />);
    expect(screen.getByTestId('probability-simulator')).toBeTruthy();
    expect(screen.getByTestId('prob-sim-kind-coin').getAttribute('aria-pressed')).toBe('true');
  });

  it('runs N coin trials and updates histogram counts', () => {
    render(<ProbabilitySimulator initialN={10} />);
    fireEvent.click(screen.getByTestId('prob-sim-run'));
    expect(screen.getByTestId('prob-sim-total').textContent).toContain('10');
    const hist = screen.getByTestId('prob-sim-histogram');
    expect(within(hist).getByText('Г')).toBeTruthy();
    expect(within(hist).getByText('П')).toBeTruthy();
  });

  it('switches to die kind and shows faces slider', () => {
    render(<ProbabilitySimulator />);
    fireEvent.click(screen.getByTestId('prob-sim-kind-die'));
    expect(screen.getByTestId('prob-sim-faces')).toBeTruthy();
  });

  it('switches to urn kind and exposes red/blue/replace controls', () => {
    render(<ProbabilitySimulator />);
    fireEvent.click(screen.getByTestId('prob-sim-kind-urn'));
    expect(screen.getByTestId('prob-sim-urn-red')).toBeTruthy();
    expect(screen.getByTestId('prob-sim-urn-blue')).toBeTruthy();
    expect(screen.getByTestId('prob-sim-urn-replace')).toBeTruthy();
  });

  it('reset clears histogram', () => {
    render(<ProbabilitySimulator initialN={5} />);
    fireEvent.click(screen.getByTestId('prob-sim-run'));
    expect(screen.getByTestId('prob-sim-total').textContent).toContain('5');
    fireEvent.click(screen.getByTestId('prob-sim-reset'));
    expect(screen.getByTestId('prob-sim-total').textContent).toContain('0');
  });

  it('changing kind also resets totals', () => {
    render(<ProbabilitySimulator initialN={5} />);
    fireEvent.click(screen.getByTestId('prob-sim-run'));
    expect(screen.getByTestId('prob-sim-total').textContent).toContain('5');
    fireEvent.click(screen.getByTestId('prob-sim-kind-die'));
    expect(screen.getByTestId('prob-sim-total').textContent).toContain('0');
  });
});
