import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitCirclePicker } from './UnitCirclePicker';
import { LanguageProvider } from '../../i18n/LanguageContext';

function renderPicker(props: React.ComponentProps<typeof UnitCirclePicker>) {
  return render(<LanguageProvider><UnitCirclePicker {...props} /></LanguageProvider>);
}

describe('UnitCirclePicker', () => {
  beforeEach(() => { localStorage.setItem('preferred_language', 'mk'); });

  it('renders the SVG circle labelled with the current angle', () => {
    renderPicker({ angleDeg: 45, onChange: () => {} });
    expect(screen.getByRole('img', { name: /45/ })).toBeTruthy();
  });

  it('emits {angle, x, y} when a special-angle button is clicked', () => {
    const onChange = vi.fn();
    renderPicker({ angleDeg: 45, onChange });
    fireEvent.click(screen.getByText('90°'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const state = onChange.mock.calls[0][0];
    expect(state.angle).toBe(90);
    expect(state.x).toBeCloseTo(0, 5);
    expect(state.y).toBeCloseTo(1, 5);
  });

  it('emits an update when the angle slider changes', () => {
    const onChange = vi.fn();
    renderPicker({ angleDeg: 0, onChange });
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '180' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ angle: 180 }));
  });

  it('disables interactive controls when disabled=true', () => {
    renderPicker({ angleDeg: 0, onChange: () => {}, disabled: true });
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
    const specialButton = screen.getByText('90°') as HTMLButtonElement;
    expect(specialButton.disabled).toBe(true);
  });
});
