import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { StudentChartSubmission } from '../../utils/duggaChartGrading';

const KIND_OPTIONS: { id: NonNullable<StudentChartSubmission['kind']>; label: string }[] = [
  { id: 'bar',     label: '📊 Стапчест' },
  { id: 'line',    label: '📈 Линиски' },
  { id: 'scatter', label: '⚬ Точки' },
  { id: 'pie',     label: '🥧 Кружен' },
];

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

interface Row { x: string; y: string }

function parseAnswer(answer: string): { kind: NonNullable<StudentChartSubmission['kind']>; xLabel: string; yLabel: string; rows: Row[] } {
  try {
    const parsed: StudentChartSubmission = answer ? JSON.parse(answer) : {};
    const rows: Row[] = (parsed.data ?? []).map(p => ({ x: String(p.x ?? ''), y: String(p.y ?? '') }));
    return {
      kind: parsed.kind ?? 'bar',
      xLabel: parsed.xLabel ?? '',
      yLabel: parsed.yLabel ?? '',
      rows: rows.length ? rows : [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }],
    };
  } catch {
    return { kind: 'bar', xLabel: '', yLabel: '', rows: [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }] };
  }
}

interface StudentChartInputProps {
  answer: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const StudentChartInput: React.FC<StudentChartInputProps> = ({ answer, onChange, disabled = false }) => {
  const [state, setState] = useState(() => parseAnswer(answer));

  const emit = (next: typeof state) => {
    setState(next);
    if (disabled) return;
    const data = next.rows
      .filter(r => r.x.trim() !== '' && r.y.trim() !== '')
      .map(r => ({ x: r.x, y: Number.isFinite(Number(r.y)) ? Number(r.y) : r.y }));
    onChange(JSON.stringify({ kind: next.kind, xLabel: next.xLabel, yLabel: next.yLabel, data }));
  };

  const chartData = useMemo(
    () => state.rows
      .filter(r => r.x.trim() !== '')
      .map(r => ({ name: r.x, value: Number.isFinite(Number(r.y)) ? Number(r.y) : 0 })),
    [state.rows],
  );

  return (
    <div className="mt-3 space-y-3">
      {/* Kind selector */}
      <div className="flex flex-wrap gap-2">
        {KIND_OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => emit({ ...state, kind: opt.id })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${
              state.kind === opt.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-indigo-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Axis labels */}
      <div className="grid grid-cols-2 gap-2">
        <input type="text" disabled={disabled} value={state.xLabel}
          onChange={e => emit({ ...state, xLabel: e.target.value })}
          placeholder="Ознака X-оска (пр. Месец)"
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50" />
        <input type="text" disabled={disabled} value={state.yLabel}
          onChange={e => emit({ ...state, yLabel: e.target.value })}
          placeholder="Ознака Y-оска (пр. Продажби)"
          className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50" />
      </div>

      {/* Data entry rows */}
      <div className="space-y-1.5">
        {state.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="text" disabled={disabled} value={row.x}
              aria-label={`X вредност ред ${i + 1}`}
              onChange={e => {
                const rows = [...state.rows];
                rows[i] = { ...rows[i], x: e.target.value };
                emit({ ...state, rows });
              }}
              placeholder="X"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50" />
            <input type="text" disabled={disabled} value={row.y}
              aria-label={`Y вредност ред ${i + 1}`}
              onChange={e => {
                const rows = [...state.rows];
                rows[i] = { ...rows[i], y: e.target.value };
                emit({ ...state, rows });
              }}
              placeholder="Y"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-gray-50" />
            {!disabled && (
              <button type="button" aria-label="Отстрани ред"
                onClick={() => emit({ ...state, rows: state.rows.filter((_, ri) => ri !== i) })}
                disabled={state.rows.length <= 1}
                className="p-1 text-red-300 hover:text-red-500 disabled:opacity-20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" onClick={() => emit({ ...state, rows: [...state.rows, { x: '', y: '' }] })}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Додај ред
          </button>
        )}
      </div>

      {/* Live preview */}
      {chartData.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-2">
          <ResponsiveContainer width="100%" height={200}>
            {state.kind === 'pie' ? (
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : state.kind === 'line' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="linear" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            ) : state.kind === 'scatter' ? (
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis dataKey="value" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Scatter data={chartData} fill="#6366f1" />
              </ScatterChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
