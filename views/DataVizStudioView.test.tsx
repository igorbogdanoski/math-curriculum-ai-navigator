/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataVizStudioView } from './DataVizStudioView';

const addNotification = vi.fn();

vi.mock('../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification }),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}));

vi.mock('../components/dataviz/DataTable', () => ({
  DEFAULT_TABLE: {
    headers: ['Категорија', 'Вредност'],
    rows: [['A', 1]],
  },
  DataTable: ({ data }: { data: { headers: string[]; rows: unknown[][] } }) => (
    <div data-testid="data-table">{data.headers.join('|')}::{data.rows.length}</div>
  ),
}));

vi.mock('../components/dataviz/ChartPreview', () => ({
  DEFAULT_CONFIG: {
    type: 'bar',
    title: '',
    xLabel: '',
    yLabel: '',
    unit: '',
    colorPalette: ['#111827'],
    showLegend: true,
    showGrid: true,
  },
  COLOR_PALETTES: {
    Default: ['#111827', '#4f46e5'],
  },
  ChartPreview: ({ data, config }: { data: { headers: string[]; rows: unknown[][] }; config: { title: string; type: string; xLabel: string; yLabel: string } }) => (
    <div data-testid="chart-preview">
      {config.title || 'untitled'}::{config.type}::{config.xLabel}::{config.yLabel}::{data.rows.length}
    </div>
  ),
}));

vi.mock('../components/dataviz/MathPaperGenerator', () => ({
  MathPaperGenerator: () => <div>math-paper-generator</div>,
}));

vi.mock('../components/dataviz/AIStatsAssistant', () => ({
  AIStatsAssistant: () => <div>ai-stats-assistant</div>,
}));

vi.mock('../components/dataviz/ProbabilityLab', () => ({
  ProbabilityLab: ({ onSendToDataViz, onGoToChart }: {
    onSendToDataViz: (tableData: { headers: string[]; rows: unknown[][] }, config: Record<string, unknown>) => void;
    onGoToChart: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSendToDataViz(
          {
            headers: ['Исход', 'Фреквенција'],
            rows: [['Глава', 6], ['Писмо', 4]],
          },
          {
            title: 'Probability transfer',
            type: 'bar',
            xLabel: 'Исход',
            yLabel: 'Фреквенција',
          },
        );
        onGoToChart();
      }}
    >
      transfer-probability
    </button>
  ),
}));

vi.mock('../components/ai/GammaModeModal', () => ({
  GammaModeModal: ({ data, onClose }: { data: { title: string; slides: Array<{ type: string; chartData: { rows: unknown[][] } }> }; onClose: () => void }) => (
    <div role="dialog" aria-label="gamma-modal">
      <span>{data.title}</span>
      <span>{data.slides[0]?.type}</span>
      <span>{data.slides[0]?.chartData.rows.length}</span>
      <button type="button" onClick={onClose}>close-gamma</button>
    </div>
  ),
}));

vi.mock('../components/common/SilentErrorBoundary', () => ({
  SilentErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DataVizStudioView', () => {
  beforeEach(() => {
    addNotification.mockReset();
    sessionStorage.clear();
  });

  it('imports session data and notifies the user', () => {
    sessionStorage.setItem('dataviz_import', JSON.stringify({
      tableData: {
        headers: ['Месец', 'Поени'],
        rows: [['Јан', 8], ['Фев', 10]],
      },
      config: {
        title: 'Увезен график',
        xLabel: 'Месец',
        yLabel: 'Поени',
        type: 'line',
      },
    }));

    render(<DataVizStudioView />);

    expect(screen.getByTestId('chart-preview').textContent).toContain('Увезен график::line::Месец::Поени::2');
    expect(addNotification).toHaveBeenCalledWith('Податоците се увезени во DataViz Studio ✅', 'success');
    expect(sessionStorage.getItem('dataviz_import')).toBeNull();
  });

  it('returns from Probability Lab to chart builder with transferred data', () => {
    render(<DataVizStudioView />);

    fireEvent.click(screen.getByRole('button', { name: /Лаб. Веројатност/i }));
    fireEvent.click(screen.getByRole('button', { name: 'transfer-probability' }));

    expect(screen.getByTestId('chart-preview').textContent).toContain('Probability transfer::bar::Исход::Фреквенција::2');
    expect(screen.getByText('Live преглед')).toBeTruthy();
  });

  it('opens Gamma mode with current chart slide payload', () => {
    sessionStorage.setItem('dataviz_import', JSON.stringify({
      tableData: {
        headers: ['Месец', 'Поени'],
        rows: [['Јан', 8], ['Фев', 10]],
      },
      config: {
        title: 'Gamma chart',
        xLabel: 'Месец',
        yLabel: 'Поени',
      },
    }));

    render(<DataVizStudioView />);

    fireEvent.click(screen.getByRole('button', { name: /Gamma/i }));

    const dialog = screen.getByRole('dialog', { name: 'gamma-modal' });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText('Gamma chart')).toBeTruthy();
    expect(within(dialog).getByText('chart-embed')).toBeTruthy();
    expect(within(dialog).getByText('2')).toBeTruthy();
  });
});