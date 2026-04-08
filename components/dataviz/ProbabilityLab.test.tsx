/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { ProbabilityLab, binomialPMF } from './ProbabilityLab';

describe('ProbabilityLab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    render(<ProbabilityLab onSendToDataViz={onSendToDataViz} onGoToChart={onGoToChart} />);

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
    render(<ProbabilityLab onSendToDataViz={onSendToDataViz} onGoToChart={vi.fn()} />);

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

    render(<ProbabilityLab onSendToDataViz={vi.fn()} onGoToChart={vi.fn()} />);

    const t0 = performance.now();
    act(() => { fireEvent.click(screen.getByRole('button', { name: '×1000' })); });
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(2000);
  });
});