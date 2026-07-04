import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitCirclePicker } from './UnitCirclePicker';

describe('UnitCirclePicker', () => {
  it('renders the SVG circle labelled with the current angle', () => {
    render(<UnitCirclePicker angleDeg={45} onChange={() => {}} />);
    expect(screen.getByRole('img', { name: /45/ })).toBeTruthy();
  });

  it('emits {angle, x, y} when a special-angle button is clicked', () => {
    const onChange = vi.fn();
    render(<UnitCirclePicker angleDeg={45} onChange={onChange} />);
    fireEvent.click(screen.getByText('90°'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const state = onChange.mock.calls[0][0];
    expect(state.angle).toBe(90);
    expect(state.x).toBeCloseTo(0, 5);
    expect(state.y).toBeCloseTo(1, 5);
  });

  it('emits an update when the angle slider changes', () => {
    const onChange = vi.fn();
    render(<UnitCirclePicker angleDeg={0} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '180' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ angle: 180 }));
  });

  it('disables interactive controls when disabled=true', () => {
    render(<UnitCirclePicker angleDeg={0} onChange={() => {}} disabled />);
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
    const specialButton = screen.getByText('90°') as HTMLButtonElement;
    expect(specialButton.disabled).toBe(true);
  });
});
