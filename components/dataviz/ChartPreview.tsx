import React, { useMemo } from 'react';
import {
  BarChart, Bar, LabelList, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ZAxis,
} from 'recharts';
import type { TableData } from './DataTable';
import { tableToChartData } from './DataTable';

export type ChartType =
  | 'bar' | 'bar-horizontal' | 'line' | 'area'
  | 'pie' | 'scatter' | 'histogram' | 'box-whisker' | 'bubble';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  colorPalette: string[];
  showLegend: boolean;
  showGrid: boolean;
  unit: string;
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
};

// ─── Box-Whisker custom SVG ─────────────────────────────────────────────────
function computeBoxStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr);
  const whiskerHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
  return { min: sorted[0], max: sorted[n - 1], q1, median, q3, whiskerLow, whiskerHigh };
}

const BoxWhiskerChart: React.FC<{ data: TableData; config: ChartConfig }> = ({ data, config }) => {
  const series = data.headers.slice(1);
  const seriesData = series.map((s, si) => {
    const vals = data.rows.map(r => typeof r[si + 1] === 'number' ? r[si + 1] as number : parseFloat(String(r[si + 1])) || 0);
    return { name: s, stats: computeBoxStats(vals), color: config.colorPalette[si % config.colorPalette.length] };
  });

  const allVals = seriesData.flatMap(s => [s.stats.min, s.stats.max]);
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
        const { q1, q3, median, whiskerLow, whiskerHigh, min, max } = s.stats;
        const yQ1 = toY(q1); const yQ3 = toY(q3);
        const yMed = toY(median);
        const yWL = toY(whiskerLow); const yWH = toY(whiskerHigh);
        return (
          <g key={i}>
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
            {/* Outliers */}
            {[min, max].filter(v => v < whiskerLow || v > whiskerHigh).map((v, oi) => (
              <circle key={oi} cx={xCenter} cy={toY(v)} r={4} fill="none" stroke={s.color} strokeWidth={1.5} />
            ))}
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
  const tooltipFormatter = (value: any) => (unit ? `${value}${unit}` : String(value ?? ''));

  if (config.type === 'box-whisker') {
    return <BoxWhiskerChart data={data} config={config} />;
  }

  if (config.type === 'histogram') {
    const values = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const histData = buildHistogram(values);
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

  if (config.type === 'scatter') {
    const scatterData = data.rows.map(r => ({
      x: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      y: typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0,
      name: String(r[0]),
    }));
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
      <Tooltip formatter={tooltipFormatter as any} />
      {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

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
          <Tooltip formatter={tooltipFormatter as any} />
          {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]}>
              {seriesKeys.length === 1 && (
                <LabelList dataKey={k} position="right" style={{ fontSize: 10 }}
                  formatter={((v: unknown) => `${v}${unit}`) as any} />
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
