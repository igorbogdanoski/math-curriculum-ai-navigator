import React from 'react';
import { fmt } from './linearAlgebraMath';

export function MatrixInput({ value, onChange, size, label, color = 'indigo' }: {
  value: number[][];
  onChange: (m: number[][]) => void;
  size: 2 | 3;
  label: string;
  color?: string;
}) {
  const update = (r: number, c: number, v: string) => {
    const next = value.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? parseFloat(v) || 0 : cell)));
    onChange(next);
  };
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className={`inline-grid gap-1 ${size === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {value.map((row, ri) => row.map((cell, ci) => (
          <input
            key={`${ri}-${ci}`}
            type="number"
            value={cell}
            onChange={e => update(ri, ci, e.target.value)}
            className={`w-12 h-10 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-${color}-300 border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`${label} ред ${ri+1} колона ${ci+1}`}
          />
        )))}
      </div>
    </div>
  );
}

export function MatrixDisplay({ value, label, color = 'gray', highlight = false }: {
  value: (number | null)[][] | null;
  label: string;
  color?: string;
  highlight?: boolean;
}) {
  if (!value) return (
    <div className="text-center p-4 rounded-xl border border-red-200 bg-red-50">
      <p className="text-xs font-bold text-red-500">{label}</p>
      <p className="text-sm text-red-600 mt-1">Не постои (сингуларна матрица)</p>
    </div>
  );
  return (
    <div className={`rounded-xl border p-3 ${highlight ? `bg-${color}-50 border-${color}-200` : 'bg-gray-50 border-gray-200'}`}>
      <p className={`text-xs font-bold mb-2 ${highlight ? `text-${color}-600` : 'text-gray-500'}`}>{label}</p>
      <div className={`inline-grid gap-1 ${value[0].length === 2 ? 'grid-cols-2' : value[0].length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {value.map((row, ri) => row.map((cell, ci) => (
          <div key={`${ri}-${ci}`}
            className={`w-[52px] h-9 flex items-center justify-center text-sm font-bold rounded-lg border ${highlight ? `bg-white border-${color}-200 text-${color}-700` : 'bg-white border-gray-200 text-gray-700'}`}>
            {cell !== null ? fmt(cell) : '—'}
          </div>
        )))}
      </div>
    </div>
  );
}
