import React, { useMemo } from 'react';
import {
  BarChart, Bar, LabelList, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ZAxis,
} from 'recharts';
import type { TableData } from './DataTable';
import { tableToChartData } from './DataTable';

export type ChartType =
  | 'bar' | 'bar-horizontal' | 'stacked-bar' | 'stacked-bar-horizontal' | 'divided-bar'
  | 'line' | 'area'
  | 'pie' | 'scatter' | 'scatter-trend' | 'histogram' | 'box-whisker' | 'bubble'
  | 'stem-leaf' | 'dot-plot' | 'heatmap'
  | 'frequency-polygon' | 'cumulative-frequency' | 'back-to-back-histogram' | 'pareto' | 'pictogram';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  colorPalette: string[];
  showLegend: boolean;
  showGrid: boolean;
  unit: string;
  bins?: number;
}

export const COLOR_PALETTES: Record<string, string[]> = {
  'МОН Сина': ['#3B82F6', '#1D4ED8', '#60A5FA', '#93C5FD', '#BFDBFE', '#1E40AF', '#2563EB'],
  'Топли': ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'],
  'Природни': ['#10B981', '#059669', '#34D399', '#6EE7B7', '#D1FAE5', '#065F46', '#047857'],
  'Монохром': ['#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F9FAFB'],
  'Пастелни': ['#BAE6FD', '#BBF7D0', '#FDE68A', '#FECACA', '#DDD6FE', '#FBCFE8', '#FED7AA'],
  'Виножито': ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8F00FF'],
  'Материјал': ['#F44336', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722'],
};

export const DEFAULT_CONFIG: ChartConfig = {
  type: 'bar',
  title: 'Мој дијаграм',
  xLabel: '',
  yLabel: '',
  colorPalette: COLOR_PALETTES['МОН Сина'],
  showLegend: true,
  showGrid: true,
  unit: '',
  bins: 8,
};

// ─── Box-Whisker custom SVG ─────────────────────────────────────────────────
function computeBoxStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  // For n < 4 the percentile method gives degenerate results; fall back to min/max
  const q1 = n >= 4 ? sorted[Math.floor(n * 0.25)] : sorted[0];
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const q3 = n >= 4 ? sorted[Math.floor(n * 0.75)] : sorted[n - 1];
  const iqr = q3 - q1;
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr);
  const whiskerHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  return { min: sorted[0], max: sorted[n - 1], q1, median, q3, whiskerLow, whiskerHigh, mean, stdDev };
}

const BoxWhiskerChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const series = data.headers.slice(1);
  const seriesData = series.map((s, si) => {
    const vals = data.rows.map(r => typeof r[si + 1] === 'number' ? r[si + 1] as number : parseFloat(String(r[si + 1])) || 0);
    return { name: s, stats: computeBoxStats(vals), color: config.colorPalette[si % config.colorPalette.length] };
  });

  const allVals = seriesData.flatMap(s => [s.stats.min, s.stats.max]);
  if (allVals.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за box-whisker.</p>;
  const minY = Math.min(...allVals);
  const maxY = Math.max(...allVals);
  const range = maxY - minY || 1;

  const W = 560; const H = 300;
  const pad = { t: 30, b: 50, l: 50, r: 20 };
  const plotH = H - pad.t - pad.b;
  const plotW = W - pad.l - pad.r;
  const boxW = Math.min(60, plotW / seriesData.length / 2);
  const toY = (v: number) => pad.t + plotH - ((v - minY) / range) * plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
      {/* Y axis */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const v = minY + f * range;
        const y = toY(v);
        return (
          <g key={f}>
            {config.showGrid && <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />}
            <text x={pad.l - 5} y={y + 4} textAnchor="end" fontSize={10} fill="#6b7280">{v.toFixed(1)}</text>
          </g>
        );
      })}
      {/* Boxes */}
      {seriesData.map((s, i) => {
        const xCenter = pad.l + (plotW / (seriesData.length + 1)) * (i + 1);
        const { q1, q3, median, whiskerLow, whiskerHigh, min, max, mean, stdDev } = s.stats;
        const yQ1 = toY(q1); const yQ3 = toY(q3);
        const yMed = toY(median);
        const yWL = toY(whiskerLow); const yWH = toY(whiskerHigh);
        const yMean = toY(mean);
        // ±1σ lines clamped to plot area
        const sigma1Lo = Math.max(minY, mean - stdDev);
        const sigma1Hi = Math.min(maxY, mean + stdDev);
        const ySigLo = toY(sigma1Lo); const ySigHi = toY(sigma1Hi);
        return (
          <g key={i}>
            {/* ±1σ band (subtle) */}
            <rect x={xCenter - boxW * 0.8} width={boxW * 1.6} y={ySigHi} height={Math.abs(ySigLo - ySigHi)}
              fill={s.color} fillOpacity={0.07} stroke={s.color} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 3" rx={2} />
            {/* Whisker lines */}
            <line x1={xCenter} x2={xCenter} y1={yWH} y2={yQ3} stroke={s.color} strokeWidth={2} strokeDasharray="4 2" />
            <line x1={xCenter} x2={xCenter} y1={yQ1} y2={yWL} stroke={s.color} strokeWidth={2} strokeDasharray="4 2" />
            {/* Whisker caps */}
            <line x1={xCenter - boxW * 0.4} x2={xCenter + boxW * 0.4} y1={yWH} y2={yWH} stroke={s.color} strokeWidth={2} />
            <line x1={xCenter - boxW * 0.4} x2={xCenter + boxW * 0.4} y1={yWL} y2={yWL} stroke={s.color} strokeWidth={2} />
            {/* Box */}
            <rect x={xCenter - boxW / 2} y={yQ3} width={boxW} height={yQ1 - yQ3} fill={s.color} fillOpacity={0.3} stroke={s.color} strokeWidth={2} rx={2} />
            {/* Median */}
            <line x1={xCenter - boxW / 2} x2={xCenter + boxW / 2} y1={yMed} y2={yMed} stroke={s.color} strokeWidth={3} />
            {/* Mean diamond ♦ */}
            <polygon
              points={`${xCenter},${yMean - 6} ${xCenter + 6},${yMean} ${xCenter},${yMean + 6} ${xCenter - 6},${yMean}`}
              fill="#fff" stroke={s.color} strokeWidth={1.5}
            />
            {/* Outliers */}
            {[min, max].filter(v => v < whiskerLow || v > whiskerHigh).map((v, oi) => (
              <circle key={oi} cx={xCenter} cy={toY(v)} r={4} fill="none" stroke={s.color} strokeWidth={1.5} />
            ))}
            {/* Stats tooltip: μ ± σ */}
            <title>{`μ=${mean.toFixed(2)}  σ=${stdDev.toFixed(2)}  Med=${median.toFixed(2)}`}</title>
            {/* Label */}
            <text x={xCenter} y={H - pad.b + 16} textAnchor="middle" fontSize={11} fill="#374151" fontWeight={600}>{s.name}</text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="#d1d5db" strokeWidth={1.5} />
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#d1d5db" strokeWidth={1.5} />
      {/* Title */}
      {config.title && <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">{config.title}</text>}
      {/* Y label */}
      {config.yLabel && <text x={12} y={H / 2} textAnchor="middle" fontSize={11} fill="#6b7280" transform={`rotate(-90 12 ${H / 2})`}>{config.yLabel}</text>}
      {/* Legend: ♦ = μ, dashed box = ±1σ */}
      <g transform={`translate(${W - pad.r - 120}, ${pad.t})`}>
        <polygon points="6,0 12,6 6,12 0,6" fill="#fff" stroke="#6b7280" strokeWidth={1.5} />
        <text x={17} y={9} fontSize={9} fill="#6b7280">Средна вредност (μ)</text>
        <rect x={0} y={18} width={12} height={10} fill="#6b7280" fillOpacity={0.1} stroke="#6b7280" strokeOpacity={0.4} strokeDasharray="3 2" strokeWidth={1} />
        <text x={17} y={27} fontSize={9} fill="#6b7280">±1σ опсег</text>
      </g>
    </svg>
  );
};

// ─── Linear regression helper ────────────────────────────────────────────────
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);
  const sumY2 = points.reduce((a, p) => a + p.y * p.y, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const ssRes = points.reduce((a, p) => a + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = points.reduce((a, p) => a + (p.y - sumY / n) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

// ─── Stem-and-Leaf chart ─────────────────────────────────────────────────────
const StemLeafChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const values = data.rows
    .map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])))
    .filter(v => !isNaN(v))
    .map(v => Math.round(v));

  if (values.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за стебло-лист.</p>;

  const stems = new Map<number, number[]>();
  for (const v of values) {
    const stem = Math.floor(Math.abs(v) / 10) * Math.sign(v);
    const leaf = Math.abs(v) % 10;
    if (!stems.has(stem)) stems.set(stem, []);
    stems.get(stem)!.push(leaf);
  }
  const sortedStems = Array.from(stems.keys()).sort((a, b) => a - b);
  for (const leaves of stems.values()) leaves.sort((a, b) => a - b);

  const W = 420; const rowH = 28; const stemColW = 60; const padV = 44;
  const H = padV + sortedStems.length * rowH + 20;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }}>
      {config.title && (
        <text x={W / 2} y={18} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">{config.title}</text>
      )}
      {/* Column headers */}
      <text x={stemColW / 2} y={36} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6b7280">Стебло</text>
      <text x={stemColW + 12} y={36} textAnchor="start" fontSize={11} fontWeight={700} fill="#6b7280">Листови</text>
      {/* Divider header line */}
      <line x1={stemColW} x2={stemColW} y1={26} y2={H - 8} stroke="#d1d5db" strokeWidth={1.5} />
      <line x1={0} x2={W} y1={40} y2={40} stroke="#e5e7eb" strokeWidth={1} />
      {/* Rows */}
      {sortedStems.map((stem, i) => {
        const y = padV + i * rowH + rowH / 2 + 4;
        const rowBg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
        return (
          <g key={stem}>
            <rect x={0} y={padV + i * rowH} width={W} height={rowH} fill={rowBg} />
            <text x={stemColW - 8} y={y} textAnchor="end" fontSize={13} fontWeight={700} fill="#1d4ed8">{stem}</text>
            <text x={stemColW + 10} y={y} textAnchor="start" fontSize={13} fill="#374151" fontFamily="monospace" letterSpacing={6}>
              {stems.get(stem)!.join('  ')}
            </text>
          </g>
        );
      })}
      {/* Bottom border */}
      <line x1={0} x2={W} y1={H - 8} y2={H - 8} stroke="#e5e7eb" strokeWidth={1} />
      {/* Count label */}
      <text x={W - 4} y={H - 12} textAnchor="end" fontSize={9} fill="#9ca3af">n = {values.length}</text>
    </svg>
  );
};

// ─── Dot Plot chart ──────────────────────────────────────────────────────────
const DotPlotChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const values = data.rows
    .map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])))
    .filter(v => !isNaN(v));

  if (values.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за точкест дијаграм.</p>;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  // Count stacks per value (rounded to 1 decimal for display)
  const stacks = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 10) / 10;
    stacks.set(key, (stacks.get(key) ?? 0) + 1);
  }
  const maxStack = Math.max(...stacks.values(), 1);

  const W = 560; const padL = 40; const padR = 20; const padB = 50; const padT = 30;
  const plotW = W - padL - padR;
  const dotR = Math.min(10, plotW / (stacks.size + 1) / 2 - 1);
  const H = padT + (maxStack + 1) * (dotR * 2 + 3) + padB;
  const baseY = H - padB;
  const color = config.colorPalette[0] ?? '#3B82F6';

  const toX = (v: number) => padL + ((v - minV) / range) * plotW;

  // Axis ticks: 5 evenly spaced
  const ticks = Array.from({ length: 5 }, (_, i) => minV + (i / 4) * range);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 360 }}>
      {config.title && (
        <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">{config.title}</text>
      )}
      {/* Grid lines */}
      {config.showGrid && ticks.map((t, i) => (
        <line key={i} x1={toX(t)} x2={toX(t)} y1={padT} y2={baseY} stroke="#f0f0f0" strokeWidth={1} />
      ))}
      {/* Number line */}
      <line x1={padL} x2={W - padR} y1={baseY} y2={baseY} stroke="#6b7280" strokeWidth={2} />
      {/* Tick marks + labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={toX(t)} x2={toX(t)} y1={baseY} y2={baseY + 6} stroke="#6b7280" strokeWidth={1.5} />
          <text x={toX(t)} y={baseY + 18} textAnchor="middle" fontSize={10} fill="#374151">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      {/* X label */}
      {config.xLabel && (
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#6b7280">{config.xLabel}</text>
      )}
      {/* Dots */}
      {Array.from(stacks.entries()).map(([val, count]) => {
        const cx = toX(val);
        return Array.from({ length: count }, (_, stackI) => {
          const cy = baseY - dotR - stackI * (dotR * 2 + 3) - 2;
          return (
            <circle key={`${val}-${stackI}`} cx={cx} cy={cy} r={dotR}
              fill={color} fillOpacity={0.8} stroke={color} strokeWidth={1} />
          );
        });
      })}
      {/* Count */}
      <text x={W - 4} y={padT + 10} textAnchor="end" fontSize={9} fill="#9ca3af">n = {values.length}</text>
    </svg>
  );
};

// ─── Heatmap chart ───────────────────────────────────────────────────────────
function lerpColor(cold: [number,number,number], hot: [number,number,number], t: number): string {
  const r = Math.round(cold[0] + (hot[0] - cold[0]) * t);
  const g = Math.round(cold[1] + (hot[1] - cold[1]) * t);
  const b = Math.round(cold[2] + (hot[2] - cold[2]) * t);
  return `rgb(${r},${g},${b})`;
}

const HeatmapChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const colLabels = data.headers.slice(1);   // X axis
  const rowLabels = data.rows.map(r => String(r[0]));  // Y axis
  const nCols = colLabels.length;
  const nRows = rowLabels.length;

  if (nCols === 0 || nRows === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за heatmap.</p>;

  // Flatten all numeric values to find range
  const allVals: number[] = [];
  data.rows.forEach(r => {
    for (let c = 1; c <= nCols; c++) {
      const v = typeof r[c] === 'number' ? r[c] as number : parseFloat(String(r[c]));
      if (!isNaN(v)) allVals.push(v);
    }
  });
  if (allVals.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема нумерички податоци за heatmap.</p>;
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const COLD: [number,number,number] = [219, 234, 254]; // blue-100
  const HOT:  [number,number,number] = [185, 28,  28];  // red-700
  const MID:  [number,number,number] = [254, 243, 199]; // yellow-100

  function cellColor(val: number): string {
    const t = (val - minV) / range;
    if (t < 0.5) return lerpColor(COLD, MID, t * 2);
    return lerpColor(MID, HOT, (t - 0.5) * 2);
  }

  const labelW = 70;
  const headerH = 44;
  const cellSize = Math.min(64, Math.max(32, Math.floor((540 - labelW) / nCols)));
  const W = labelW + nCols * cellSize;
  const H = headerH + nRows * cellSize + 20;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W }} className="block max-h-[440px]">
        {config.title && (
          <text x={W / 2} y={14} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1f2937">{config.title}</text>
        )}
        {/* Column headers */}
        {colLabels.map((lbl, ci) => (
          <text key={ci} x={labelW + ci * cellSize + cellSize / 2} y={headerH - 6}
            textAnchor="middle" fontSize={10} fontWeight={600} fill="#374151"
            transform={`rotate(-35 ${labelW + ci * cellSize + cellSize / 2} ${headerH - 6})`}>
            {String(lbl).slice(0, 10)}
          </text>
        ))}
        {/* Rows */}
        {data.rows.map((row, ri) => (
          <g key={ri}>
            {/* Row label */}
            <text x={labelW - 6} y={headerH + ri * cellSize + cellSize / 2 + 4}
              textAnchor="end" fontSize={10} fill="#374151" fontWeight={600}>
              {String(row[0]).slice(0, 9)}
            </text>
            {/* Cells */}
            {colLabels.map((_, ci) => {
              const raw = row[ci + 1];
              const val = typeof raw === 'number' ? raw : parseFloat(String(raw));
              const ok = !isNaN(val);
              const bg = ok ? cellColor(val) : '#f3f4f6';
              const t = ok ? (val - minV) / range : 0;
              const textFill = t > 0.6 ? '#fff' : '#1f2937';
              const x = labelW + ci * cellSize;
              const y = headerH + ri * cellSize;
              return (
                <g key={ci}>
                  <rect x={x} y={y} width={cellSize} height={cellSize}
                    fill={bg} stroke="white" strokeWidth={1.5} rx={2} />
                  {ok && cellSize >= 32 && (
                    <text x={x + cellSize / 2} y={y + cellSize / 2 + 4}
                      textAnchor="middle" fontSize={cellSize >= 48 ? 11 : 9}
                      fontWeight={600} fill={textFill}>
                      {Number.isInteger(val) ? val : val.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        ))}
        {/* Color legend bar */}
        {Array.from({ length: 40 }, (_, i) => {
          const t = i / 39;
          const lx = labelW + i * (nCols * cellSize / 40);
          return (
            <rect key={i} x={lx} y={H - 14} width={nCols * cellSize / 40 + 1} height={8}
              fill={t < 0.5 ? lerpColor(COLD, MID, t * 2) : lerpColor(MID, HOT, (t - 0.5) * 2)} />
          );
        })}
        <text x={labelW} y={H - 1} textAnchor="start" fontSize={8} fill="#6b7280">{minV.toFixed(1)}</text>
        <text x={labelW + nCols * cellSize} y={H - 1} textAnchor="end" fontSize={8} fill="#6b7280">{maxV.toFixed(1)}</text>
      </svg>
    </div>
  );
};

// ─── Back-to-Back Histogram ──────────────────────────────────────────────────
const BackToBackHistogram: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const bins = config.bins ?? 8;
  const series1 = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
  const series2 = data.rows.map(r =>
    data.headers.length >= 3
      ? (typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0)
      : 0
  );
  const allVals = [...series1, ...series2].filter(v => !isNaN(v));
  if (allVals.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за back-to-back хистограм.</p>;

  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const step = (maxV - minV) / bins || 1;

  const buildCounts = (vals: number[]) =>
    Array.from({ length: bins }, (_, i) => {
      const lo = minV + i * step; const hi = lo + step;
      return vals.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length;
    });

  const counts1 = buildCounts(series1);
  const counts2 = buildCounts(series2);
  const maxCount = Math.max(...counts1, ...counts2, 1);

  const W = 540; const H = 360;
  const padT = 36; const padB = 64; const padSide = 10; const centerGap = 64;
  const centerX = W / 2;
  const halfPlot = (W - padSide * 2 - centerGap) / 2;
  const plotH = H - padT - padB;
  const barH = plotH / bins;
  const color1 = config.colorPalette[0] ?? '#3B82F6';
  const color2 = config.colorPalette[1] ?? '#EF4444';
  const label1 = data.headers[1] ?? 'Серија 1';
  const label2 = data.headers[2] ?? 'Серија 2';
  const toBarW = (count: number) => (count / maxCount) * halfPlot;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 400 }}>
      {config.title && <text x={W / 2} y={20} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">{config.title}</text>}
      {counts1.map((count, i) => {
        const bw = toBarW(count);
        const y = padT + i * barH;
        const lo = minV + i * step; const hi = lo + step;
        return (
          <g key={`s1-${i}`}>
            {config.showGrid && <line x1={centerX - halfPlot - centerGap / 2} x2={centerX - centerGap / 2} y1={y + barH / 2} y2={y + barH / 2} stroke="#f0f0f0" strokeWidth={0.5} />}
            <rect x={centerX - centerGap / 2 - bw} y={y + 1} width={bw} height={barH - 2} fill={color1} fillOpacity={0.85} rx={2} />
            <text x={centerX} y={y + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#6b7280">{`${lo.toFixed(1)}–${hi.toFixed(1)}`}</text>
          </g>
        );
      })}
      {counts2.map((count, i) => {
        const bw = toBarW(count);
        const y = padT + i * barH;
        return (
          <g key={`s2-${i}`}>
            {config.showGrid && <line x1={centerX + centerGap / 2} x2={centerX + centerGap / 2 + halfPlot} y1={y + barH / 2} y2={y + barH / 2} stroke="#f0f0f0" strokeWidth={0.5} />}
            <rect x={centerX + centerGap / 2} y={y + 1} width={bw} height={barH - 2} fill={color2} fillOpacity={0.85} rx={2} />
          </g>
        );
      })}
      <line x1={centerX} x2={centerX} y1={padT} y2={H - padB} stroke="#374151" strokeWidth={2} />
      <line x1={padSide} x2={W - padSide} y1={H - padB} y2={H - padB} stroke="#d1d5db" strokeWidth={1.5} />
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const x = centerX - centerGap / 2 - f * halfPlot;
        return (
          <g key={`xtl-${i}`}>
            <line x1={x} x2={x} y1={H - padB} y2={H - padB + 5} stroke="#6b7280" strokeWidth={1} />
            <text x={x} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#6b7280">{Math.round(f * maxCount)}</text>
          </g>
        );
      })}
      {[0.25, 0.5, 0.75, 1].map((f, i) => {
        const x = centerX + centerGap / 2 + f * halfPlot;
        return (
          <g key={`xtr-${i}`}>
            <line x1={x} x2={x} y1={H - padB} y2={H - padB + 5} stroke="#6b7280" strokeWidth={1} />
            <text x={x} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#6b7280">{Math.round(f * maxCount)}</text>
          </g>
        );
      })}
      <text x={centerX - centerGap / 2 - halfPlot / 2} y={H - padB + 34} textAnchor="middle" fontSize={11} fontWeight={700} fill={color1}>{label1}</text>
      <text x={centerX + centerGap / 2 + halfPlot / 2} y={H - padB + 34} textAnchor="middle" fontSize={11} fontWeight={700} fill={color2}>{label2}</text>
      <text x={W / 2} y={H - padB + 50} textAnchor="middle" fontSize={9} fill="#9ca3af">← Фреквенција · Фреквенција →</text>
    </svg>
  );
};

// ─── Pictogram Chart ─────────────────────────────────────────────────────────
const PictogramChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const rows = data.rows.slice(0, 12);
  if (rows.length === 0) return <p className="text-gray-400 text-sm text-center p-8">Нема доволно податоци за пиктограм.</p>;

  const values = rows.map(r => Math.max(0, Math.round(
    typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0
  )));
  const maxVal = Math.max(...values, 1);
  const iconScale = Math.max(1, Math.ceil(maxVal / 15));
  const maxIcons = Math.ceil(maxVal / iconScale);

  const W = 560;
  const nCats = rows.length;
  const colW = Math.min(72, Math.floor((W - 24) / nCats));
  const iconSize = Math.min(20, colW - 6);
  const iconGap = 3;
  const padT = 52; const padB = 72;
  const H = padT + maxIcons * (iconSize + iconGap) + padB;
  const baseY = H - padB;
  const startX = (W - nCats * colW) / 2 + colW / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 500 }}>
      {config.title && <text x={W / 2} y={20} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f2937">{config.title}</text>}
      <text x={W / 2} y={38} textAnchor="middle" fontSize={10} fill="#6b7280">
        {`★ = ${iconScale} ${config.unit || (iconScale === 1 ? 'единица' : 'единици')}`}
      </text>
      {rows.map((row, ci) => {
        const val = values[ci];
        const fullIcons = Math.floor(val / iconScale);
        const partial = (val % iconScale) / iconScale;
        const cx = startX + ci * colW;
        const color = config.colorPalette[ci % config.colorPalette.length];
        return (
          <g key={ci}>
            {Array.from({ length: fullIcons }, (_, ii) => (
              <text key={ii} x={cx} y={baseY - ii * (iconSize + iconGap) - iconGap}
                textAnchor="middle" fontSize={iconSize} fill={color}>★</text>
            ))}
            {partial >= 0.5 && (
              <text x={cx} y={baseY - fullIcons * (iconSize + iconGap) - iconGap}
                textAnchor="middle" fontSize={iconSize} fill={color} opacity={0.35}>★</text>
            )}
            <text x={cx} y={baseY + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}>
              {val}{config.unit ? ` ${config.unit}` : ''}
            </text>
            <text x={cx} y={baseY + 30} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={500}>
              {String(row[0]).slice(0, 9)}
            </text>
          </g>
        );
      })}
      <line x1={startX - colW / 2} x2={startX + (nCats - 0.5) * colW} y1={baseY + 2} y2={baseY + 2} stroke="#d1d5db" strokeWidth={1.5} />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">МОН: I–IV одделение · Прв циклус</text>
    </svg>
  );
};

// ─── Histogram helper ───────────────────────────────────────────────────────
function buildHistogram(values: number[], bins = 8): { name: string; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values); const max = Math.max(...values);
  const step = (max - min) / bins || 1;
  return Array.from({ length: bins }, (_, i) => {
    const lo = min + i * step; const hi = lo + step;
    return {
      name: `${lo.toFixed(1)}–${hi.toFixed(1)}`,
      count: values.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length,
    };
  });
}

// ─── Main ChartPreview ───────────────────────────────────────────────────────
interface ChartPreviewProps {
  data: TableData;
  config: ChartConfig;
}

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const ChartPreview: React.FC<ChartPreviewProps> = ({ data, config }) => {
  const chartData = useMemo(() => tableToChartData(data), [data]);
  const seriesKeys = data.headers.slice(1);
  const colors = config.colorPalette;
  const unit = config.unit ? ` ${config.unit}` : '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Typed recharts Tooltip formatter — matches ValueType/NameType including undefined variants
  const tooltipFormatter = (
    value: number | string | readonly (string | number)[] | undefined,
    name: string | number | undefined,
  ): [string, string] => {
    const v = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    return [`${v}${unit}`, String(name ?? '')];
  };

  if (config.type === 'box-whisker') {
    return <BoxWhiskerChart data={data} config={config} />;
  }

  if (config.type === 'heatmap') {
    return <HeatmapChart data={data} config={config} />;
  }

  if (config.type === 'stem-leaf') {
    return <StemLeafChart data={data} config={config} />;
  }

  if (config.type === 'dot-plot') {
    return <DotPlotChart data={data} config={config} />;
  }

  if (config.type === 'histogram') {
    const values = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const histData = buildHistogram(values, config.bins ?? 8);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={histData} barCategoryGap="5%">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={config.yLabel ? { value: 'Фреквенција', angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
          <Tooltip formatter={(v) => [`${v}`, 'Фреквенција']} />
          <Bar dataKey="count" fill={colors[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'pie') {
    const pieData = data.rows.map((r, i) => ({
      name: String(r[0]),
      value: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      fill: colors[i % colors.length],
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            outerRadius={110} labelLine={false} label={renderPieLabel}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'scatter' || config.type === 'scatter-trend') {
    const scatterData = data.rows.map(r => ({
      x: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      y: typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0,
      name: String(r[0]),
    }));

    if (config.type === 'scatter-trend' && scatterData.length >= 2) {
      const { slope, intercept, r2 } = linearRegression(scatterData);
      const xs = scatterData.map(p => p.x);
      const xMin = Math.min(...xs); const xMax = Math.max(...xs);
      if (xMin === xMax) return <p className="text-gray-400 text-sm text-center p-8">Не може да се пресмета трендот — сите X вредности се исти.</p>;
      const trendLine = [
        { x: xMin, trend: slope * xMin + intercept },
        { x: xMax, trend: slope * xMax + intercept },
      ];
      return (
        <div className="relative">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10 }}
                label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined} />
              <YAxis dataKey="y" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10 }}
                label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
              <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
              <Scatter data={scatterData} fill={colors[0]} fillOpacity={0.8} name="Податоци" />
              <Line data={trendLine} dataKey="trend" type="linear" dot={false}
                stroke={colors[1] ?? '#ef4444'} strokeWidth={2} strokeDasharray="6 3" name="Тренд" legendType="line" />
              {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-right pr-2 -mt-1">
            R² = {r2.toFixed(3)} · y = {slope.toFixed(2)}x {intercept >= 0 ? '+' : '−'} {Math.abs(intercept).toFixed(2)}
          </p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="x" name={data.headers[1] || 'X'} tick={{ fontSize: 10 }} label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined} />
          <YAxis dataKey="y" name={data.headers[2] || 'Y'} tick={{ fontSize: 10 }} label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => [`${v}${unit}`, '']} />
          <Scatter data={scatterData} fill={colors[0]} fillOpacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'bubble') {
    const bubbleData = data.rows.map(r => ({
      x: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      y: typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0,
      z: data.headers[3] ? (typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3])) || 10) : 10,
      name: String(r[0]),
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="x" tick={{ fontSize: 10 }} />
          <YAxis dataKey="y" tick={{ fontSize: 10 }} />
          <ZAxis dataKey="z" range={[40, 400]} />
          <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
          <Scatter data={bubbleData} fill={colors[0]} fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'back-to-back-histogram') {
    return <BackToBackHistogram data={data} config={config} />;
  }

  if (config.type === 'pictogram') {
    return <PictogramChart data={data} config={config} />;
  }

  const commonAxis = (
    <>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
      <XAxis
        dataKey="name"
        tick={{ fontSize: 10 }}
        label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined}
      />
      <YAxis
        tick={{ fontSize: 10 }}
        label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined}
        tickFormatter={(v) => `${v}${unit}`}
      />
      <Tooltip formatter={tooltipFormatter} />
      {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (config.type === 'stacked-bar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barCategoryGap="20%">
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]}
              radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'stacked-bar-horizontal') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
        <BarChart data={chartData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}${unit}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={tooltipFormatter} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'divided-bar') {
    const normalizedData = chartData.map(row => {
      const total = seriesKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
      const result: Record<string, string | number> = { name: String(row.name ?? '') };
      seriesKeys.forEach(k => { result[k] = total > 0 ? +((Number(row[k]) / total * 100).toFixed(1)) : 0; });
      return result;
    });
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 52)}>
        <BarChart data={normalizedData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={(v, n) => [`${v}%`, String(n)]} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'frequency-polygon') {
    const fpValues = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const fpBins = buildHistogram(fpValues, config.bins ?? 8);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={fpBins}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={46}
            label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -8, style: { fontSize: 10 } } : undefined} />
          <YAxis tick={{ fontSize: 10 }}
            label={{ value: 'Фреквенција', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={v => [`${v}`, 'Фреквенција']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="linear" dataKey="count" stroke={colors[0]} strokeWidth={2.5} name="Фреквенција"
            dot={{ r: 5, fill: colors[0], stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'cumulative-frequency') {
    const cfValues = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const cfBins = buildHistogram(cfValues, config.bins ?? 8);
    let cumAcc = 0;
    const cfData = cfBins.map(d => {
      cumAcc += d.count;
      return { name: d.name, cumFreq: cumAcc, relFreq: +(cumAcc / (cfValues.length || 1) * 100).toFixed(1) };
    });
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={cfData}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={46} />
          <YAxis yAxisId="abs" tick={{ fontSize: 10 }}
            label={{ value: 'Кумул. фрекв.', angle: -90, position: 'insideLeft', style: { fontSize: 9 } }} />
          <YAxis yAxisId="rel" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, n) => n === 'cumFreq' ? [`${v}`, 'Кумулат. фреквенција'] : [`${v}%`, 'Релат. кумул. %']} />
          <Line yAxisId="abs" type="monotone" dataKey="cumFreq" stroke={colors[0]} strokeWidth={2.5}
            dot={{ r: 4 }} name="Кумулат. фреквенција" />
          <Line yAxisId="rel" type="monotone" dataKey="relFreq" stroke={colors[1] ?? '#ef4444'}
            strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} name="Релат. кумул. %" />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'pareto') {
    let paretoCum = 0;
    const paretoTotal = data.rows.reduce((s, r) => s + (typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0), 0);
    const paretoData = data.rows
      .map(r => ({ name: String(r[0]), value: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0 }))
      .sort((a, b) => b.value - a.value)
      .map(d => { paretoCum += (d.value / (paretoTotal || 1)) * 100; return { ...d, cumPct: +(paretoCum.toFixed(1)) }; });
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={paretoData}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="bar" tick={{ fontSize: 10 }} tickFormatter={v => `${v}${unit}`} />
          <YAxis yAxisId="line" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, n) => n === 'cumPct' ? [`${v}%`, 'Кумулат. %'] : [`${v}${unit}`, String(n)]} />
          <Bar yAxisId="bar" dataKey="value" name="Вредност" radius={[4, 4, 0, 0]}>
            {paretoData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
          <Line yAxisId="line" type="monotone" dataKey="cumPct" stroke="#ef4444"
            strokeWidth={2.5} dot={{ r: 4 }} name="Кумулат. %" />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]}
              strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k}
              stroke={colors[i % colors.length]} fill={colors[i % colors.length]}
              fillOpacity={0.25} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar (vertical) and bar-horizontal
  const isHorizontal = config.type === 'bar-horizontal';
  if (isHorizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
        <BarChart data={chartData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}${unit}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={tooltipFormatter} />
          {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]}>
              {seriesKeys.length === 1 && (
                <LabelList dataKey={k} position="right" style={{ fontSize: 10 }}
                  formatter={(v: unknown) => `${v ?? ''}${unit}`} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} barCategoryGap="20%">
        {commonAxis}
        {seriesKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
