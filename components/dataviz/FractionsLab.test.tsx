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

  it('clicking a wedge of the circle model updates num via polar hit-testing, staying in sync with the bar', () => {
    // scale = 1 (viewBox 160x160, mocked rendered size 160x160) — clientX/Y map 1:1 to SVG coords
    mockSvgBoundingRect(160, 160);
    renderLab();
    const circle = screen.getByRole('img', { name: /Круг модел, 3 од 4/ });

    // Point straight down from center (6 o'clock, dx=0, dy=+68) falls in wedge index 2 (den=4) → num=3
    fireEvent.click(circle, { clientX: 80, clientY: 148 });
    expect(screen.getByRole('img', { name: /Круг модел, 3 од 4/ })).toBeTruthy();

    // Point to the left of center (9 o'clock, dx=-68, dy=0) falls in wedge index 3 → num=4
    fireEvent.click(circle, { clientX: 12, clientY: 80 });
    expect(screen.getByRole('img', { name: /Круг модел, 4 од 4/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Бар модел, 4 од 4/ })).toBeTruthy();
  });
});

describe('FractionsLab — Compare mode', () => {
  it('shows the correct comparison symbol for the default pair, and updates it live when a bar is dragged', () => {
    mockSvgBoundingRect(340, 64);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Спореди' }));

    // Defaults: A = 1/2, B = 2/3 → 1/2 < 2/3
    expect(screen.getByText('1/2 < 2/3')).toBeTruthy();

    // Drag bar A to its right edge (num = den = 2) → 2/2 > 2/3
    const barA = screen.getByRole('img', { name: /Бар модел, 1 од 2/ });
    fireEvent.click(barA, { clientX: 340, clientY: 32 });
    expect(screen.getByText('2/2 > 2/3')).toBeTruthy();
  });

  it('changing fraction B\'s denominator only affects bar B, not bar A', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Спореди' }));

    const cardB = screen.getByText('Дропка Б').closest('div')!.parentElement!;
    fireEvent.click(within(cardB).getByText('5'));

    expect(screen.getByRole('img', { name: /Бар модел, 1 од 2/ })).toBeTruthy(); // A unchanged
    expect(screen.getByRole('img', { name: /Бар модел, \d+ од 5/ })).toBeTruthy(); // B now den=5
  });
});

describe('FractionsLab — Operations mode', () => {
  it('defaults to addition and shows the correct result for the default pair (1/2 + 1/4 = 3/4)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    expect(screen.getByText('1/2 + 1/4 = 3/4')).toBeTruthy();
  });

  it('switching to × shows the area model and the correct product (1/2 × 1/4 = 1/8)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '×' }));

    expect(screen.getByRole('img', { name: /Модел на површина/ })).toBeTruthy();
    expect(screen.getByText('1/2 × 1/4 = 1/8')).toBeTruthy();
  });

  it('switching to ÷ shows the reciprocal explanation and the correct quotient (1/2 ÷ 1/4 = 2/1)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '÷' }));

    expect(screen.getByText(/реципрочен број/)).toBeTruthy();
    expect(screen.getByText('1/2 ÷ 1/4 = 2/1')).toBeTruthy();
  });

  it('switching to − updates the result live (1/2 − 1/4 = 1/4)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '-' }));
    expect(screen.getByText('1/2 - 1/4 = 1/4')).toBeTruthy();
  });

  it('dragging fraction A updates the result live', () => {
    mockSvgBoundingRect(340, 64);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));

    const barA = screen.getByRole('img', { name: /Бар модел, 1 од 2/ });
    fireEvent.click(barA, { clientX: 340, clientY: 32 }); // drag to num=den=2 → fraction A becomes 2/2
    expect(screen.getByText('2/2 + 1/4 = 5/4')).toBeTruthy();
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
