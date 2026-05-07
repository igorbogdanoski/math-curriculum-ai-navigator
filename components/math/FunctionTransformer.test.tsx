import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FunctionTransformer } from './FunctionTransformer';

describe('<FunctionTransformer />', () => {
  it('renders with sin as default function', () => {
    render(<FunctionTransformer />);
    expect(screen.getByTestId('function-transformer')).toBeTruthy();
    expect(screen.getByTestId('function-transformer-formula').textContent).toContain('sin(x)');
  });

  it('honours initialFunction prop', () => {
    render(<FunctionTransformer initialFunction="cos" />);
    expect(screen.getByTestId('function-transformer-formula').textContent).toContain('cos(x)');
  });

  it('updates formula when slider a changes', () => {
    const onChange = vi.fn();
    render(<FunctionTransformer onParamsChange={onChange} />);
    const aSlider = screen.getByTestId('function-transformer-slider-a') as HTMLInputElement;
    fireEvent.change(aSlider, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ a: 2 });
    expect(screen.getByTestId('function-transformer-formula').textContent).toContain('2·sin');
  });

  it('switches base function via select', () => {
    render(<FunctionTransformer />);
    const select = screen.getByTestId('function-transformer-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sqrt' } });
    expect(screen.getByTestId('function-transformer-formula').textContent).toContain('√x');
  });

  it('reset returns to identity params', () => {
    render(<FunctionTransformer initialParams={{ a: 2, b: 3, c: 1, d: -1 }} />);
    expect(screen.getByTestId('function-transformer-formula').textContent).toContain('2·sin(3x + 1) − 1');
    fireEvent.click(screen.getByTestId('function-transformer-reset'));
    expect(screen.getByTestId('function-transformer-formula').textContent?.trim()).toBe('y = sin(x)');
  });

  it('renders an SVG path for the curve', () => {
    const { container } = render(<FunctionTransformer />);
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // base (dashed) + transformed
  });
});
