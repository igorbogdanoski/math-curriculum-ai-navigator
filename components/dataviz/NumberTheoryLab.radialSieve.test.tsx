import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import NumberTheoryLab from './NumberTheoryLab';

// /data-viz is auth-gated, so the animation couldn't be browser-tested end-to-end
// without production credentials — this drives the actual play/pause/reset state
// machine with fake timers instead (same auth-wall substitution as
// FractionsLab.test.tsx). Defaults to the 'primes' tab, so no extra navigation needed.

describe('NumberTheoryLab — radial Sieve of Eratosthenes animation', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('grid view is shown by default; toggling reveals the radial view', () => {
    render(<NumberTheoryLab />);
    expect(screen.queryByRole('img', { name: /Анимирано решето/ })).toBeNull();

    fireEvent.click(screen.getByText('⭕ Кружен приказ'));
    expect(screen.getByRole('img', { name: /Анимирано решето/ })).toBeTruthy();

    fireEvent.click(screen.getByText('🔲 Мрежа'));
    expect(screen.queryByRole('img', { name: /Анимирано решето/ })).toBeNull();
  });

  it('play advances through steps over time, highlighting each prime in order', () => {
    render(<NumberTheoryLab />);
    fireEvent.click(screen.getByText('⭕ Кружен приказ'));
    fireEvent.click(screen.getByText('▶ Играј'));

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText(/Тековен прост број: 2/)).toBeTruthy();

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText(/Тековен прост број: 3/)).toBeTruthy();

    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText(/Тековен прост број: 5/)).toBeTruthy();
  });

  it('reset returns to the initial (unplayed) state', () => {
    render(<NumberTheoryLab />);
    fireEvent.click(screen.getByText('⭕ Кружен приказ'));
    fireEvent.click(screen.getByText('▶ Играј'));
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText(/Тековен прост број/)).toBeTruthy();

    fireEvent.click(screen.getByText('↺ Ресетирај'));
    expect(screen.queryByText(/Тековен прост број/)).toBeNull();
    expect(screen.getByText('▶ Играј')).toBeTruthy();
  });

  it('finishes after all steps and reports the correct final prime count (25 primes ≤ 100)', () => {
    render(<NumberTheoryLab />);
    fireEvent.click(screen.getByText('⭕ Кружен приказ'));
    fireEvent.click(screen.getByText('▶ Играј'));

    // Primes up to √100=10 are 2,3,5,7 → 4 steps; advance well past that.
    for (let i = 0; i < 6; i++) {
      act(() => { vi.advanceTimersByTime(900); });
    }

    expect(screen.getByText(/Готово — 25 прости броеви до 100/)).toBeTruthy();
    expect(screen.getByText('▶ Прегледај повторно')).toBeTruthy();
  });
});

describe('NumberTheoryLab — Ulam spiral view', () => {
  it('toggling to the spiral view hides grid/radial and shows the spiral SVG', () => {
    render(<NumberTheoryLab />);
    expect(screen.queryByRole('img', { name: /Улам спирала/ })).toBeNull();

    fireEvent.click(screen.getByText('🌀 Улам спирала'));
    expect(screen.getByRole('img', { name: /Улам спирала/ })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Анимирано решето/ })).toBeNull();

    fireEvent.click(screen.getByText('🔲 Мрежа'));
    expect(screen.queryByRole('img', { name: /Улам спирала/ })).toBeNull();
  });
});
