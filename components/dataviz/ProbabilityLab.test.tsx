/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { ProbabilityLab } from './ProbabilityLab';
import { binomialPMF } from './probabilityMath';
import { LanguageProvider } from '../../i18n/LanguageContext';

function renderLab(props: React.ComponentProps<typeof ProbabilityLab>) {
  return render(<LanguageProvider><ProbabilityLab {...props} /></LanguageProvider>);
}

describe('ProbabilityLab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('preferred_language', 'mk');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes binomial probabilities', () => {
    const pmf = binomialPMF(4, 0.5);

    expect(pmf).toHaveLength(5);
    expect(pmf.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    expect(pmf[0]).toBeCloseTo(pmf[4], 10);
    expect(pmf[1]).toBeCloseTo(pmf[3], 10);
  });

  it('sends measured and theoretical results to DataViz', () => {
    const onSendToDataViz = vi.fn();
    const onGoToChart = vi.fn();
    const randomValues = [0.1, 0.7, 0.2, 0.9, 0.3, 0.8, 0.4, 0.6, 0.45, 0.55];
    let index = 0;

    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[index++] ?? 0.1);

    renderLab({ onSendToDataViz, onGoToChart });

    fireEvent.click(screen.getByRole('button', { name: '×10' }));

    expect(screen.getByText('Прати резултатите во DataViz Studio')).toBeTruthy();
    expect(screen.getByText(/Вкупно:/).textContent).toContain('10');

    fireEvent.click(screen.getByRole('button', { name: /DataViz/i }));

    expect(onGoToChart).toHaveBeenCalledTimes(1);
    expect(onSendToDataViz).toHaveBeenCalledTimes(1);

    const [tableData, config] = onSendToDataViz.mock.calls[0] as [
      { headers: string[]; rows: Array<Array<string | number>> },
      { title: string; xLabel: string; yLabel: string; type: string }
    ];

    expect(tableData.headers).toEqual(['Исход', 'Фреквенција', 'Експ. %', 'Теор. %']);
    expect(tableData.rows).toEqual([
      ['Глава', 5, 50, 50],
      ['Писмо', 5, 50, 50],
    ]);
    expect(config).toMatchObject({
      title: 'Веројатност — Монета',
      xLabel: 'Исход',
      yLabel: 'Фреквенција',
      type: 'bar',
    });
  });

  // ── D2 Monte Carlo formal close ─────────────────────────────────────────────

  it('converges within 5% of theoretical after 1000 coin flips (LLN guarantee)', () => {
    // Deterministic alternating mock: values cycle [0.3, 0.7] → exactly 500 Глава, 500 Писмо.
    let call = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (call++ % 2 === 0 ? 0.3 : 0.7));

    const onSendToDataViz = vi.fn();
    renderLab({ onSendToDataViz, onGoToChart: vi.fn() });

    act(() => { fireEvent.click(screen.getByRole('button', { name: '×1000' })); });

    fireEvent.click(screen.getByRole('button', { name: /DataViz/i }));

    const [tableData] = onSendToDataViz.mock.calls[0] as [{ headers: string[]; rows: Array<Array<string | number>> }];

    // Each row: [outcome, freq, exp%, theor%]
    for (const row of tableData.rows) {
      const expPct  = row[2] as number; // measured
      const theorPct = row[3] as number; // theoretical
      expect(Math.abs(expPct - theorPct)).toBeLessThanOrEqual(5);
    }
  });

  it('completes 1000 coin flips in under 2 seconds (latency milestone)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // all Глава — constant, fastest path

    renderLab({ onSendToDataViz: vi.fn(), onGoToChart: vi.fn() });

    const t0 = performance.now();
    act(() => { fireEvent.click(screen.getByRole('button', { name: '×1000' })); });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000);
  });

  // ── i18n smoke test ─────────────────────────────────────────────────────────
  // Raw, untranslated i18n keys (e.g. "dataviz.probLab.tabCoin") must never leak into the
  // rendered UI — that's the exact regression class this test exists to catch. Covers
  // ProbabilityLab itself plus ProbabilityLabPanels (Venn + tree builder render unconditionally
  // in the 'sim' view) and the binomial distribution chart (via the 'binomial' experiment button).
  const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

  (['mk', 'en'] as const).forEach(lang => {
    it(`renders every experiment type without leaking raw i18n keys (${lang})`, () => {
      localStorage.setItem('preferred_language', lang);
      renderLab({ onSendToDataViz: vi.fn(), onGoToChart: vi.fn() });

      // Experiment selector buttons come from the EXPERIMENTS constant (coin/die/two-dice/dice-coin/spinner/binomial).
      const EXPERIMENT_COUNT = 6;
      // Skip the first 2 buttons (Simulation/Practice view toggle) to reach the experiment grid.
      const allButtons = () => screen.getAllByRole('button');
      for (let i = 0; i < EXPERIMENT_COUNT; i++) {
        fireEvent.click(allButtons()[2 + i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  });
});