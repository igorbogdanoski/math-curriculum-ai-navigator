import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MATH_STANDARDS } from '../../data/allNationalStandardsComplete';

interface Props {
  standards: string[];
  onChange: (standards: string[]) => void;
  gradeNumber?: number;
}

const STD_CODE_RE = /^III-[АA]\.\d+/;
const STD_CODE_EXTRACT = /^(III-[АA]\.\d+)/;

const extractCode = (s: string): string | null => {
  const m = s.match(STD_CODE_EXTRACT);
  return m ? m[1] : null;
};

const formatEntry = (code: string, description: string): string =>
  `${code} — ${description.slice(0, 80)}${description.length > 80 ? '…' : ''}`;

export const NationalStandardsLinker: React.FC<Props> = ({ standards, onChange, gradeNumber }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return MATH_STANDARDS.slice(0, 8);
    return MATH_STANDARDS.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [query]);

  const selectedCodes = useMemo(
    () => new Set(standards.flatMap(s => { const c = extractCode(s); return c ? [c] : []; })),
    [standards],
  );

  const handleAdd = (code: string, description: string) => {
    if (selectedCodes.has(code)) return;
    onChange([...standards, formatEntry(code, description)]);
    setQuery('');
    setOpen(false);
  };

  const handleRemove = (idx: number) => {
    onChange(standards.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showGradeNote = gradeNumber !== undefined && gradeNumber < 6;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 justify-between">
        <label className="text-sm font-semibold text-gray-700">Поврзи БРО стандарди (III-А)</label>
        {showGradeNote && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Стандардите важат за одд. 6–9
          </span>
        )}
      </div>

      {/* Chips */}
      {standards.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {standards.map((s, i) => {
            const isBro = STD_CODE_RE.test(s);
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  isBro
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}
              >
                {s}
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="opacity-50 hover:opacity-100 ml-0.5"
                  aria-label="Отстрани"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div ref={wrapRef} className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Пребарај стандард (пр. III-А.5 или функции)..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder:text-gray-400"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {filtered.map(std => {
              const already = selectedCodes.has(std.code);
              return (
                <button
                  key={std.code}
                  type="button"
                  onClick={() => handleAdd(std.code, std.description)}
                  disabled={already}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-indigo-50 flex items-start gap-2 transition-colors ${already ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="shrink-0 font-bold text-indigo-600 w-16">{std.code}</span>
                  <span className="text-gray-700 line-clamp-2">{std.description}</span>
                  {already && <span className="ml-auto shrink-0 text-[10px] text-gray-400">✓ Додаден</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400">27 математички БРО стандарди (III-А). Само за основно образование (одд. 1–9).</p>
    </div>
  );
};
