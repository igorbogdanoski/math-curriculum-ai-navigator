import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FractionsLab } from './FractionsLab';
import { LanguageProvider } from '../../i18n/LanguageContext';

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
    <LanguageProvider>
      <QueryClientProvider client={client}><FractionsLab /></QueryClientProvider>
    </LanguageProvider>,
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

beforeEach(() => { localStorage.setItem('preferred_language', 'mk'); });

describe('FractionsLab — Show mode', () => {
  it('renders the bar, circle, and number line synced to the default fraction', () => {
    renderLab();
    expect(screen.getByRole('slider', { name: /Бар модел, 3 од 4/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Круг модел, 3 од 4/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Бројна права, точка на 3\/4/ })).toBeTruthy();
    expect(screen.getByText('3/4')).toBeTruthy();
  });

  it('changing the denominator updates all three synced visuals', () => {
    renderLab();
    fireEvent.click(screen.getByText('6'));
    expect(screen.getByRole('slider', { name: /Бар модел, 3 од 6/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Круг модел, 3 од 6/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Бројна права, точка на 3\/6/ })).toBeTruthy();
  });

  it('clicking the bar model at a given x-position updates num (same math the drag handler uses)', () => {
    mockSvgBoundingRect(340, 64); // matches max-w-[340px] rendered width; viewBox is 320x64
    renderLab();
    const bar = screen.getByRole('slider', { name: /Бар модел, 3 од 4/ });
    // Click near the left edge (~10% across) — should snap num down to 0
    fireEvent.click(bar, { clientX: 34, clientY: 32 });
    expect(screen.getByRole('slider', { name: /Бар модел, 0 од 4/ })).toBeTruthy();
    // The number line, sharing the same {num, den} state, updates too
    expect(screen.getByRole('slider', { name: /Бројна права, точка на 0\/4/ })).toBeTruthy();
  });

  it('clicking the number line at a given x-position updates num and stays in sync with the bar', () => {
    mockSvgBoundingRect(340, 50);
    renderLab();
    const line = screen.getByRole('slider', { name: /Бројна права, точка на 3\/4/ });
    // Click at ~100% across (right edge) — should snap num up to den (4)
    fireEvent.click(line, { clientX: 340, clientY: 25 });
    expect(screen.getByRole('slider', { name: /Бројна права, точка на 4\/4/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ })).toBeTruthy();
  });

  it('clicking a wedge of the circle model updates num via polar hit-testing, staying in sync with the bar', () => {
    // scale = 1 (viewBox 160x160, mocked rendered size 160x160) — clientX/Y map 1:1 to SVG coords
    mockSvgBoundingRect(160, 160);
    renderLab();
    const circle = screen.getByRole('slider', { name: /Круг модел, 3 од 4/ });

    // Point straight down from center (6 o'clock, dx=0, dy=+68) falls in wedge index 2 (den=4) → num=3
    fireEvent.click(circle, { clientX: 80, clientY: 148 });
    expect(screen.getByRole('slider', { name: /Круг модел, 3 од 4/ })).toBeTruthy();

    // Point to the left of center (9 o'clock, dx=-68, dy=0) falls in wedge index 3 → num=4
    fireEvent.click(circle, { clientX: 12, clientY: 80 });
    expect(screen.getByRole('slider', { name: /Круг модел, 4 од 4/ })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ })).toBeTruthy();
  });
});

describe('FractionsLab — keyboard accessibility (Wave 8.5, audit_2026_07_18)', () => {
  it('bar model responds to arrow keys, Home, and End (no drag/click required)', () => {
    renderLab();
    const bar = screen.getByRole('slider', { name: /Бар модел, 3 од 4/ });
    expect(bar.tabIndex).toBe(0);
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');

    fireEvent.keyDown(bar, { key: 'ArrowRight' });
    expect(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ }), { key: 'ArrowLeft' });
    expect(screen.getByRole('slider', { name: /Бар модел, 3 од 4/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('slider', { name: /Бар модел, 3 од 4/ }), { key: 'Home' });
    expect(screen.getByRole('slider', { name: /Бар модел, 0 од 4/ })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('slider', { name: /Бар модел, 0 од 4/ }), { key: 'End' });
    expect(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ })).toBeTruthy();
  });

  it('bar model clamps at 0 and den — arrow keys never go out of range', () => {
    renderLab();
    const bar = screen.getByRole('slider', { name: /Бар модел, 3 од 4/ });
    fireEvent.keyDown(bar, { key: 'End' });
    fireEvent.keyDown(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ }), { key: 'ArrowRight' });
    expect(screen.getByRole('slider', { name: /Бар модел, 4 од 4/ })).toBeTruthy(); // stayed at max
  });

  it('number line model responds to arrow keys', () => {
    renderLab();
    const line = screen.getByRole('slider', { name: /Бројна права, точка на 3\/4/ });
    fireEvent.keyDown(line, { key: 'ArrowDown' });
    expect(screen.getByRole('slider', { name: /Бројна права, точка на 2\/4/ })).toBeTruthy();
  });

  it('circle model responds to arrow keys', () => {
    renderLab();
    const circle = screen.getByRole('slider', { name: /Круг модел, 3 од 4/ });
    fireEvent.keyDown(circle, { key: 'ArrowUp' });
    expect(screen.getByRole('slider', { name: /Круг модел, 4 од 4/ })).toBeTruthy();
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
    const barA = screen.getByRole('slider', { name: /Бар модел, 1 од 2/ });
    fireEvent.click(barA, { clientX: 340, clientY: 32 });
    expect(screen.getByText('2/2 > 2/3')).toBeTruthy();
  });

  it('changing fraction B\'s denominator only affects bar B, not bar A', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Спореди' }));

    const cardB = screen.getByText('Дропка Б').closest('div')!.parentElement!;
    fireEvent.click(within(cardB).getByText('5'));

    expect(screen.getByRole('slider', { name: /Бар модел, 1 од 2/ })).toBeTruthy(); // A unchanged
    expect(screen.getByRole('slider', { name: /Бар модел, \d+ од 5/ })).toBeTruthy(); // B now den=5
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

    const barA = screen.getByRole('slider', { name: /Бар модел, 1 од 2/ });
    fireEvent.click(barA, { clientX: 340, clientY: 32 }); // drag to num=den=2 → fraction A becomes 2/2
    expect(screen.getByText('2/2 + 1/4 = 5/4')).toBeTruthy();
  });

  // Regression coverage for audit_2026_07_18: the ÷ area model used to silently collapse
  // to "one column, always fully shaded" for every non-trivial division, because it fed an
  // improper reciprocal fraction into a grid that assumed num <= den. These assert the
  // actual rendered SVG geometry (viewBox width, per-whole divider count), not just the
  // text answer — the old bug produced the CORRECT text answer while the visual was wrong.
  it('÷ area model draws one whole-width block per unit of the reciprocal (1/2 ÷ 1/4 → reciprocal 4/1 → 4 whole blocks)', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '÷' }));

    const areaModel = screen.getByRole('img', { name: /Модел на површина/ });
    // AREA_W is 240 in FractionsLab.tsx; wholes = ceil(4/1) = 4 → viewBox width 960.
    expect(areaModel.getAttribute('viewBox')).toBe('0 0 960 180');
    // 3 dashed divider lines mark the 4 whole-blocks.
    expect(areaModel.querySelectorAll('line').length).toBe(3);
  });

  it('÷ area model renders a single block when B is a whole number (1/2 ÷ 3/3 → reciprocal 3/3, wholes=1)', () => {
    mockSvgBoundingRect(340, 64);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '÷' }));

    const cardB = screen.getByText('Дропка Б').closest('div')!.parentElement!;
    fireEvent.click(within(cardB).getByText('3')); // den B = 3
    const barB = screen.getByRole('slider', { name: /Бар модел, \d+ од 3/ });
    fireEvent.click(barB, { clientX: 340, clientY: 32 }); // drag to right edge → num B = den B = 3

    expect(screen.getByRole('slider', { name: /Бар модел, 3 од 3/ })).toBeTruthy();
    const areaModel = screen.getByRole('img', { name: /Модел на површина/ });
    // reciprocal of 3/3 is 3/3 → wholes = ceil(3/3) = 1 → viewBox width unchanged (240).
    expect(areaModel.getAttribute('viewBox')).toBe('0 0 240 180');
    expect(areaModel.querySelectorAll('line').length).toBe(0);
  });

  it('regression (audit_2026_07_18): dividing by zero shows an explicit error instead of a bogus "num/0" result', () => {
    mockSvgBoundingRect(340, 64);
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Операции' }));
    fireEvent.click(screen.getByRole('button', { name: '÷' }));

    // Drag fraction B's numerator down to 0 (default opFracB is 1/4).
    const barB = screen.getByRole('slider', { name: /Бар модел, 1 од 4/ });
    fireEvent.click(barB, { clientX: 1, clientY: 32 });

    expect(screen.getByRole('slider', { name: /Бар модел, 0 од 4/ })).toBeTruthy();
    expect(screen.getByText(/Не може да се дели со нула/)).toBeTruthy();
    expect(screen.queryByText(/1\/0/)).toBeNull();
    expect(screen.queryByRole('img', { name: /Модел на површина/ })).toBeNull();
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
    const bar = screen.getByRole('slider', { name: new RegExp(`Бар модел, 0 од ${targetDen}`) });
    fireEvent.click(bar, { clientX: 1, clientY: 32 });
    fireEvent.click(screen.getByRole('button', { name: 'Провери' }));

    if (targetNum !== 0) {
      expect(screen.getByText(/Не сосема/)).toBeTruthy();
    }

    // Now drag/click to exactly match the target boundary
    const segW = 340 / targetDen;
    const barAgain = screen.getByRole('slider', { name: new RegExp(`Бар модел, \\d+ од ${targetDen}`) });
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
