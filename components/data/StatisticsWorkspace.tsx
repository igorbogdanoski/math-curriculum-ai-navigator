/**
 * StatisticsWorkspace — interactive Excel-like data tool for statistics lessons.
 *
 * Features:
 *  - Editable data grid (add/remove rows, edit values inline)
 *  - Live SVG charts: Bar, Line, Pie, Dot plot — zero external dependencies
 *  - Auto-computed statistics: N, Σ, Mean, Median, Mode, Range, Min, Max
 *  - Supports AI-generated initial datasets (tableData prop)
 *  - Export chart as PNG via canvas
 *
 * Usage:
 *   <StatisticsWorkspace
 *     initialData={{ headers: ['Оценка', 'Честота'], rows: [[5,3],[4,8],[3,5]] }}
 *     title="Оценки на тестот"
 *   />
 */
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { BarChart2, LineChart, PieChart, Plus, Trash2, Download } from 'lucide-react';
import type { QuestionTableData } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'pie' | 'dot';
type Cell = string | number;

interface StatisticsWorkspaceProps {
  initialData?: QuestionTableData;
  title?: string;
  readOnly?: boolean;
  compact?: boolean; // minimal mode for inline quiz display
}

// ── Maths helpers ─────────────────────────────────────────────────────────────

function numericCol(rows: Cell[][], col: number): number[] {
  return rows
    .map(r => parseFloat(String(r[col] ?? '')))
    .filter(n => !isNaN(n));
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function mode(nums: number[]): number[] {
  if (!nums.length) return [];
  const freq: Record<number, number> = {};
  nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  const maxF = Math.max(...Object.values(freq));
  return Object.entries(freq)
    .filter(([, f]) => f === maxF)
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── SVG Chart colours ─────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ labels, values, color = '#6366f1' }: { labels: string[]; values: number[]; color?: string }) {
  const W = 480, H = 260, padL = 44, padB = 34, padT = 14, padR = 14;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxV = Math.max(...values, 1);
  const barW = chartW / Math.max(labels.length, 1) * 0.65;
  const gap = chartW / Math.max(labels.length, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Y axis */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
      {/* X axis */}
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
      {/* Y gridlines + labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = padT + chartH * (1 - f);
        const val = round2(maxV * f);
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padL - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{val}</text>
          </g>
        );
      })}
      {/* Bars */}
      {values.map((v, i) => {
        const bh = (v / maxV) * chartH;
        const x = padL + i * gap + (gap - barW) / 2;
        const y = padT + chartH - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} fill={color} rx={3} opacity={0.85} />
            <text x={x + barW / 2} y={y - 3} fontSize={9} fill="#475569" textAnchor="middle">{v}</text>
            <text x={x + barW / 2} y={padT + chartH + 14} fontSize={9} fill="#64748b" textAnchor="middle">
              {labels[i]?.length > 6 ? labels[i].substring(0, 5) + '…' : labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Line Chart ────────────────────────────────────────────────────────────────

function LineChartSvg({ labels, values, color = '#6366f1' }: { labels: string[]; values: number[]; color?: string }) {
  const W = 480, H = 260, padL = 44, padB = 34, padT = 14, padR = 14;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const pts = values.map((v, i) => ({
    x: padL + (i / Math.max(values.length - 1, 1)) * chartW,
    y: padT + chartH - ((v - minV) / range) * chartH,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={padL} y1={padT + chartH} x2={padL + chartW} y2={padT + chartH} stroke="#cbd5e1" strokeWidth={1} />
      {[0, 0.5, 1].map(f => {
        const y = padT + chartH * (1 - f);
        const val = round2(minV + range * f);
        return (
          <g key={f}>
            <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padL - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{val}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <polygon
        points={`${padL},${padT + chartH} ${polyline} ${padL + chartW},${padT + chartH}`}
        fill={color}
        opacity={0.12}
      />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={color} />
          <text x={p.x} y={p.y - 7} fontSize={9} fill="#475569" textAnchor="middle">{values[i]}</text>
          <text x={p.x} y={padT + chartH + 14} fontSize={9} fill="#64748b" textAnchor="middle">
            {labels[i]?.length > 5 ? labels[i].substring(0, 4) + '…' : labels[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Pie Chart ─────────────────────────────────────────────────────────────────

function PieChartSvg({ labels, values }: { labels: string[]; values: number[] }) {
  const cx = 130, cy = 120, r = 108;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  let startAngle = -Math.PI / 2;

  const slices = values.map((v, i) => {
    const angle = (v / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const midAngle = startAngle + angle / 2;
    const lx = cx + (r * 0.65) * Math.cos(midAngle);
    const ly = cy + (r * 0.65) * Math.sin(midAngle);
    const pct = Math.round((v / total) * 100);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    startAngle = endAngle;
    return { path, lx, ly, pct, color: COLORS[i % COLORS.length], label: labels[i] };
  });

  return (
    <svg viewBox="0 0 380 270" className="w-full">
      {slices.map((s, i) => (
        <g key={i}>
          <path d={s.path} fill={s.color} opacity={0.9} />
          {s.pct >= 5 && (
            <text x={s.lx} y={s.ly} fontSize={12} fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
              {s.pct}%
            </text>
          )}
        </g>
      ))}
      {/* Legend */}
      {slices.map((s, i) => (
        <g key={i} transform={`translate(272, ${24 + i * 22})`}>
          <rect x={0} y={0} width={13} height={13} fill={s.color} rx={2} />
          <text x={18} y={11} fontSize={11} fill="#475569">
            {s.label?.length > 12 ? s.label.substring(0, 11) + '…' : s.label} ({s.pct}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Dot Plot ──────────────────────────────────────────────────────────────────

function DotPlot({ values }: { values: number[] }) {
  const W = 480, H = 160, padL = 36, padR = 14, padB = 30, padT = 14;
  const chartW = W - padL - padR;
  const sorted = [...values].sort((a, b) => a - b);
  const minV = sorted[0] ?? 0;
  const maxV = sorted[sorted.length - 1] ?? 1;
  const range = maxV - minV || 1;

  // Stack dots per value
  const stacks: Record<number, number> = {};
  sorted.forEach(v => { stacks[v] = (stacks[v] || 0) + 1; });
  const maxStack = Math.max(...Object.values(stacks), 1);
  const dotR = 7;

  const x = (v: number) => padL + ((v - minV) / range) * chartW;
  const axisY = padT + (maxStack + 0.5) * (dotR * 2 + 2);

  return (
    <svg viewBox={`0 0 ${W} ${axisY + padB}`} className="w-full">
      <line x1={padL} y1={axisY} x2={padL + chartW} y2={axisY} stroke="#cbd5e1" strokeWidth={1.5} />
      {Object.entries(stacks).map(([vStr, count]) => {
        const v = Number(vStr);
        const cx2 = x(v);
        return Array.from({ length: count }).map((_, stack) => (
          <circle
            key={`${v}-${stack}`}
            cx={cx2}
            cy={axisY - dotR - stack * (dotR * 2 + 2)}
            r={dotR}
            fill="#6366f1"
            opacity={0.8}
          />
        ));
      })}
      {/* X axis labels */}
      {Object.keys(stacks).map(vStr => {
        const v = Number(vStr);
        return (
          <text key={v} x={x(v)} y={axisY + 16} fontSize={10} fill="#64748b" textAnchor="middle">{v}</text>
        );
      })}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const DEFAULT_DATA: QuestionTableData = {
  headers: ['Вредност', 'Честота'],
  rows: [
    [5, 3], [6, 7], [7, 12], [8, 9], [9, 5], [10, 4],
  ],
  caption: 'Внеси ги своите податоци',
};

export const StatisticsWorkspace: React.FC<StatisticsWorkspaceProps> = ({
  initialData,
  title,
  readOnly = false,
  compact = false,
}) => {
  const [data, setData] = useState<QuestionTableData>(initialData ?? DEFAULT_DATA);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [activeCol, setActiveCol] = useState<number>(0); // which column to use as values
  const svgRef = useRef<SVGSVGElement>(null);

  // ── data editing ───────────────────────────────────────────────────────────

  const setCell = useCallback((row: number, col: number, val: string) => {
    setData(prev => {
      const newRows = prev.rows.map((r, ri) =>
        ri === row ? r.map((c, ci) => ci === col ? (isNaN(Number(val)) ? val : Number(val)) : c) : r
      );
      return { ...prev, rows: newRows };
    });
  }, []);

  const addRow = () => {
    setData(prev => ({
      ...prev,
      rows: [...prev.rows, prev.headers.map(() => 0)],
    }));
  };

  const removeRow = (i: number) => {
    setData(prev => ({ ...prev, rows: prev.rows.filter((_, ri) => ri !== i) }));
  };

  // ── computed stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // For "Честота"-type columns: compute weighted stats using col0 as value, col1 as freq
    const hasFreq = data.headers.length >= 2 &&
      (data.headers[1]?.toLowerCase().includes('честот') || data.headers[1]?.toLowerCase().includes('freq'));

    let nums: number[];
    if (hasFreq) {
      // Expand: repeat value by frequency
      nums = [];
      data.rows.forEach(r => {
        const val = parseFloat(String(r[0] ?? ''));
        const freq = parseInt(String(r[1] ?? ''), 10);
        if (!isNaN(val) && !isNaN(freq) && freq > 0) {
          for (let i = 0; i < freq; i++) nums.push(val);
        }
      });
    } else {
      nums = numericCol(data.rows, activeCol);
    }

    if (!nums.length) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const modes = mode(nums);
    return {
      n: nums.length,
      sum: round2(nums.reduce((a, b) => a + b, 0)),
      mean: round2(mean(nums)),
      median: round2(median(nums)),
      mode: modes.length === nums.length ? 'нема' : modes.join(', '),
      range: round2(sorted[sorted.length - 1] - sorted[0]),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }, [data, activeCol]);

  // ── chart data ─────────────────────────────────────────────────────────────

  const { chartLabels, chartValues } = useMemo(() => {
    const labelCol = activeCol === 0 ? 0 : 0;
    const valCol = activeCol === 0 ? (data.headers.length > 1 ? 1 : 0) : activeCol;
    const labels = data.rows.map(r => String(r[labelCol] ?? ''));
    const values = data.rows.map(r => parseFloat(String(r[valCol] ?? '')) || 0);
    return { chartLabels: labels, chartValues: values };
  }, [data, activeCol]);

  // ── PNG export ─────────────────────────────────────────────────────────────

  const exportPng = () => {
    const svgEl = document.querySelector('.sw-chart-svg') as SVGElement | null;
    if (!svgEl) return;
    const xml = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 680; canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'statistics-chart.png';
      a.click();
    };
    img.src = url;
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${compact ? 'text-sm' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-slate-700 text-sm">{title || data.caption || 'Работен простор со податоци'}</span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={exportPng}
            title="Извези график"
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={`flex flex-col ${compact ? 'gap-3 p-3' : 'md:flex-row gap-4 p-4'}`}>

        {/* Left: Data Grid */}
        <div className={compact ? 'w-full' : 'md:w-64 flex-shrink-0'}>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Табела</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-indigo-50">
                  {data.headers.map((h, ci) => (
                    <th
                      key={ci}
                      className={`px-3 py-2 text-left font-bold text-indigo-700 text-xs cursor-pointer select-none ${activeCol === ci ? 'bg-indigo-100' : ''}`}
                      onClick={() => setActiveCol(ci)}
                      title="Кликни за да го избереш овој столбец за графикот"
                    >
                      {h}
                      {activeCol === ci && <span className="ml-1 text-indigo-400">▼</span>}
                    </th>
                  ))}
                  {!readOnly && <th className="w-6" />}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1">
                        {readOnly ? (
                          <span className="font-mono text-slate-700">{cell}</span>
                        ) : (
                          <input
                            type="text"
                            value={String(cell)}
                            onChange={e => setCell(ri, ci, e.target.value)}
                            className="w-full font-mono text-slate-700 bg-transparent focus:outline-none focus:bg-indigo-50 rounded px-1 text-center"
                          />
                        )}
                      </td>
                    ))}
                    {!readOnly && (
                      <td className="px-1">
                        <button
                          type="button"
                          onClick={() => removeRow(ri)}
                          className="text-slate-300 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-lg py-1.5 hover:bg-indigo-50 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Додај ред
            </button>
          )}
        </div>

        {/* Right: Chart + Stats */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Chart type selector */}
          <div className="flex items-center gap-2">
            {([
              { id: 'bar', icon: BarChart2, label: 'Столбец' },
              { id: 'line', icon: LineChart, label: 'Линија' },
              { id: 'pie', icon: PieChart, label: 'Питка' },
              { id: 'dot', icon: BarChart2, label: 'Точки' },
            ] as const).map(ct => (
              <button
                key={ct.id}
                type="button"
                onClick={() => setChartType(ct.id)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${chartType === ct.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <ct.icon className="w-3.5 h-3.5" />
                {ct.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-slate-50 rounded-xl p-2 flex justify-center sw-chart-container">
            {chartType === 'bar' && <BarChart labels={chartLabels} values={chartValues} />}
            {chartType === 'line' && <LineChartSvg labels={chartLabels} values={chartValues} />}
            {chartType === 'pie' && <PieChartSvg labels={chartLabels} values={chartValues} />}
            {chartType === 'dot' && <DotPlot values={chartValues} />}
          </div>

          {/* Statistics panel */}
          {stats && (
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'N', value: stats.n, color: 'bg-slate-100 text-slate-700' },
                { label: 'Σ', value: stats.sum, color: 'bg-indigo-50 text-indigo-700' },
                { label: 'Mean', value: stats.mean, color: 'bg-blue-50 text-blue-700' },
                { label: 'Медијана', value: stats.median, color: 'bg-violet-50 text-violet-700' },
                { label: 'Мод', value: stats.mode, color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Опсег', value: stats.range, color: 'bg-amber-50 text-amber-700' },
                { label: 'Min', value: stats.min, color: 'bg-rose-50 text-rose-700' },
                { label: 'Max', value: stats.max, color: 'bg-green-50 text-green-700' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl p-2 text-center`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
                  <p className="font-black text-sm mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
