import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConicSectionExplorer } from './ConicSectionExplorer';

describe('<ConicSectionExplorer />', () => {
  it('renders default ellipse for α=30°, β=70°', () => {
    render(<ConicSectionExplorer />);
    expect(screen.getByTestId('conic-section-explorer')).toBeTruthy();
    expect(screen.getByTestId('conic-kind').textContent).toBe('Елипса');
  });

  it('switches to circle when β=90°', () => {
    render(<ConicSectionExplorer />);
    const beta = screen.getByTestId('conic-beta') as HTMLInputElement;
    fireEvent.change(beta, { target: { value: '90' } });
    expect(screen.getByTestId('conic-kind').textContent).toBe('Кружница');
  });

  it('switches to parabola when β=α', () => {
    render(<ConicSectionExplorer initialAlphaDeg={45} initialBetaDeg={45} />);
    expect(screen.getByTestId('conic-kind').textContent).toBe('Парабола');
    expect(screen.getByTestId('conic-equation').textContent).toContain('y²');
  });

  it('switches to hyperbola when β<α', () => {
    render(<ConicSectionExplorer initialAlphaDeg={50} initialBetaDeg={20} />);
    expect(screen.getByTestId('conic-kind').textContent).toBe('Хипербола');
  });

  it('reset returns to initial values', () => {
    render(<ConicSectionExplorer />);
    const alpha = screen.getByTestId('conic-alpha') as HTMLInputElement;
    fireEvent.change(alpha, { target: { value: '50' } });
    expect(alpha.value).toBe('50');
    fireEvent.click(screen.getByTestId('conic-reset'));
    expect(alpha.value).toBe('30');
  });

  it('renders both cone and result SVGs', () => {
    render(<ConicSectionExplorer />);
    expect(screen.getByTestId('conic-cone-svg')).toBeTruthy();
    expect(screen.getByTestId('conic-result-svg')).toBeTruthy();
  });
});
