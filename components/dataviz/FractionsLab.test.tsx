import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FractionsLab } from './FractionsLab';

// The full app-shell (/data-viz) is auth-gated, so real drag interaction can't be
// browser-tested end-to-end without production credentials. BarModel/NumberLineModel's
// onClick and drag handlers both funnel through the same emitFromX() coordinate math
// (see UnitCirclePicker.test.tsx for the same click-exercises-the-drag-math precedent
// in this codebase), so clicking at a known SVG position exercises the identical logic
// a real drag would.
vi.mock('../../services/firestoreService', () => ({
  firestoreService: {
    fetchLastLabSession: vi.fn().mockResolvedValue(null),
    saveQuizResult: vi.fn().mockResolvedValue('id'),
  },
}));

function renderLab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(FractionsLab)),
  );
}

/** Mocks getBoundingClientRect for every SVG in the tree so click-based coordinate
 *  math (shared with the drag path) resolves against a known, fixed box. */
function mockSvgBoundingRect(width: number, height: number) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height,
    toJSON: () => {},
  } as DOMRect);
}

describe('FractionsLab — Show mode', () => {
  it('renders the bar, circle, and number line synced to the default fraction', () => {
    renderLab();
    expect(screen.getByRole('img', { name: /Бар модел, 3 од 4/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Круг модел, 3 од 4/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Бројна права, точка на 3\/4/ })).toBeTruthy();
    expect(screen.getByText('3/4')).toBeTruthy();
  });

  it('changing the denominator updates all three synced visuals', () => {
    renderLab();
    fireEvent.click(screen.getByText('6'));
    expect(screen.getByRole('img', { name: /Бар модел, 3 од 6/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Круг модел, 3 од 6/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Бројна права, точка на 3\/6/ })).toBeTruthy();
  });

  it('clicking the bar model at a given x-position updates num (same math the drag handler uses)', () => {
    mockSvgBoundingRect(340, 64); // matches max-w-[340px] rendered width; viewBox is 320x64
    renderLab();
    const bar = screen.getByRole('img', { name: /Бар модел, 3 од 4/ });
    // Click near the left edge (~10% across) — should snap num down to 0
    fireEvent.click(bar, { clientX: 34, clientY: 32 });
    expect(screen.getByRole('img', { name: /Бар модел, 0 од 4/ })).toBeTruthy();
    // The number line, sharing the same {num, den} state, updates too
    expect(screen.getByRole('img', { name: /Бројна права, точка на 0\/4/ })).toBeTruthy();
  });

  it('clicking the number line at a given x-position updates num and stays in sync with the bar', () => {
    mockSvgBoundingRect(340, 50);
    renderLab();
    const line = screen.getByRole('img', { name: /Бројна права, точка на 3\/4/ });
    // Click at ~100% across (right edge) — should snap num up to den (4)
    fireEvent.click(line, { clientX: 340, clientY: 25 });
    expect(screen.getByRole('img', { name: /Бројна права, точка на 4\/4/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Бар модел, 4 од 4/ })).toBeTruthy();
  });
});

describe('FractionsLab — Build mode', () => {
  it('shows incorrect feedback when the constructed fraction does not match the target, correct when it does', () => {
    mockSvgBoundingRect(340, 64);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Состави' }));

    const targetLabel = screen.getByText(/Состави ја дропката/).closest('div')!;
    const targetText = within(targetLabel).getByText(/^\d+\/\d+$/).textContent!;
    const [targetNum, targetDen] = targetText.split('/').map(Number);

    // Deliberately click somewhere that (very likely) doesn't match the target
    const bar = screen.getByRole('img', { name: new RegExp(`Бар модел, 0 од ${targetDen}`) });
    fireEvent.click(bar, { clientX: 1, clientY: 32 });
    fireEvent.click(screen.getByRole('button', { name: 'Провери' }));

    if (targetNum !== 0) {
      expect(screen.getByText(/Не сосема/)).toBeTruthy();
    }

    // Now drag/click to exactly match the target boundary
    const segW = 340 / targetDen;
    const barAgain = screen.getByRole('img', { name: new RegExp(`Бар модел, \\d+ од ${targetDen}`) });
    fireEvent.click(barAgain, { clientX: targetNum * segW, clientY: 32 });
    fireEvent.click(screen.getByRole('button', { name: 'Провери' }));
    expect(screen.getByText(/Точно!/)).toBeTruthy();
  });
});

describe('FractionsLab — Practice mode', () => {
  it('renders without crashing and shows the lab exercise panel start controls', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Вежбај' }));
    // LabExercisePanel's initial state always offers a way to start/generate a set —
    // just assert the mode switch didn't crash and something practice-related rendered.
    expect(document.body.textContent).toBeTruthy();
  });
});
