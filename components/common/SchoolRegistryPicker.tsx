import React, { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { SCHOOL_REGISTRY, type SchoolRegistryEntry } from '../../data/schoolRegistry';

interface SchoolRegistryPickerProps {
  value: string;
  onChange: (query: string) => void;
  onSelect: (entry: SchoolRegistryEntry) => void;
  placeholder?: string;
  id?: string;
}

/** Searchable autocomplete over the 483-entry official MK government school registry
 *  (data/schoolRegistry.ts) — fuzzy search by name or municipality, following the same
 *  Fuse.js pattern already used in components/common/CommandPalette.tsx. */
export const SchoolRegistryPicker: React.FC<SchoolRegistryPickerProps> = ({ value, onChange, onSelect, placeholder, id }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(() => new Fuse(SCHOOL_REGISTRY, {
    keys: [{ name: 'name', weight: 0.7 }, { name: 'municipality', weight: 0.3 }],
    threshold: 0.4,
  }), []);

  const results = useMemo(() => {
    if (value.trim().length < 2) return [];
    return fuse.search(value).map(r => r.item).slice(0, 8);
  }, [value, fuse]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder ?? 'Пребарај училиште по име или општина...'}
        className="block w-full px-3.5 py-2.5 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-all"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {results.map(entry => (
            <button
              key={entry.id}
              type="button"
              onClick={() => { onSelect(entry); setIsOpen(false); }}
              className="block w-full text-left px-3.5 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              <span className="font-semibold text-slate-800">{entry.name}</span>
              <span className="text-slate-400"> — {entry.municipality}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
