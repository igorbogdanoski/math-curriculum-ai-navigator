import React, { useCallback } from 'react';
import { Plus, Trash2, PlusSquare } from 'lucide-react';

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

interface DataTableProps {
  data: TableData;
  onChange: (data: TableData) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onChange }) => {
  const updateHeader = useCallback((colIdx: number, value: string) => {
    const headers = [...data.headers];
    headers[colIdx] = value;
    onChange({ ...data, headers });
  }, [data, onChange]);

  const updateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    const rows = data.rows.map(r => [...r]);
    const num = parseFloat(value);
    rows[rowIdx][colIdx] = isNaN(num) ? value : num;
    onChange({ ...data, rows });
  }, [data, onChange]);

  const addRow = useCallback(() => {
    const newRow = data.headers.map((_, i) => i === 0 ? `Вредност ${data.rows.length + 1}` : 0);
    onChange({ ...data, rows: [...data.rows, newRow] });
  }, [data, onChange]);

  const addColumn = useCallback(() => {
    const headers = [...data.headers, `Колона ${data.headers.length}`];
    const rows = data.rows.map(r => [...r, 0]);
    onChange({ headers, rows });
  }, [data, onChange]);

  const removeRow = useCallback((rowIdx: number) => {
    if (data.rows.length <= 1) return;
    onChange({ ...data, rows: data.rows.filter((_, i) => i !== rowIdx) });
  }, [data, onChange]);

  const removeColumn = useCallback((colIdx: number) => {
    if (data.headers.length <= 2) return;
    onChange({
      headers: data.headers.filter((_, i) => i !== colIdx),
      rows: data.rows.map(r => r.filter((_, i) => i !== colIdx)),
    });
  }, [data, onChange]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {data.headers.map((h, ci) => (
              <th key={ci} className="p-0 relative">
                <div className="flex items-center gap-1">
                  <input
                    value={h}
                    onChange={e => updateHeader(ci, e.target.value)}
                    className="w-full px-2 py-1.5 bg-indigo-50 border border-indigo-200 font-semibold text-indigo-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded-t"
                    placeholder={`Наслов ${ci + 1}`}
                  />
                  {ci > 1 && (
                    <button
                      type="button"
                      onClick={() => removeColumn(ci)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center hover:bg-red-600 z-10"
                      title="Отстрани колона"
                    >×</button>
                  )}
                </div>
              </th>
            ))}
            <th className="w-8 p-1">
              <button
                type="button"
                onClick={addColumn}
                className="w-7 h-7 flex items-center justify-center rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-600 transition"
                title="Додај колона"
              >
                <PlusSquare className="w-3.5 h-3.5" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="group hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td key={ci} className="p-0">
                  <input
                    value={String(cell)}
                    onChange={e => updateCell(ri, ci, e.target.value)}
                    className={`w-full px-2 py-1.5 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-xs ${ci === 0 ? 'bg-gray-50 font-medium text-gray-700' : 'bg-white text-gray-800 text-right'}`}
                    placeholder={ci === 0 ? 'Ознака' : '0'}
                  />
                </td>
              ))}
              <td className="p-1 w-8">
                <button
                  type="button"
                  onClick={() => removeRow(ri)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  title="Избриши ред"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={addRow}
        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg border border-dashed border-indigo-300 transition w-full justify-center"
      >
        <Plus className="w-3.5 h-3.5" /> Додај ред
      </button>
    </div>
  );
};

// Helpers used by chart renderers
export function getNumericColumns(data: TableData): number[] {
  return data.headers.map((_, ci) => ci).filter(ci => ci > 0);
}

export function tableToChartData(data: TableData): Record<string, string | number>[] {
  return data.rows.map(row => {
    const obj: Record<string, string | number> = { name: String(row[0]) };
    data.headers.slice(1).forEach((h, i) => {
      obj[h] = typeof row[i + 1] === 'number' ? row[i + 1] : parseFloat(String(row[i + 1])) || 0;
    });
    return obj;
  });
}

export const DEFAULT_TABLE: TableData = {
  headers: ['Категорија', 'Серија 1'],
  rows: [
    ['Ген. 1', 12],
    ['Ген. 2', 19],
    ['Ген. 3', 7],
    ['Ген. 4', 25],
    ['Ген. 5', 14],
  ],
};
