import React, { useState } from 'react';
import { X, CheckSquare, Square, Loader2, Sparkles } from 'lucide-react';
import type { ScenarioSegment } from '../../services/scenarioSplitter';

interface Props {
  segments: ScenarioSegment[];
  fileName: string;
  onImportSelected: (selected: ScenarioSegment[]) => void;
  onClose: () => void;
  isImporting: boolean;
}

export const ScenarioSelectionModal: React.FC<Props> = ({
  segments,
  fileName,
  onImportSelected,
  onClose,
  isImporting,
}) => {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(segments.map(s => s.index)),
  );

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === segments.length
        ? new Set()
        : new Set(segments.map(s => s.index)),
    );
  };

  const handleImport = () => {
    const chosen = segments.filter(s => selected.has(s.index));
    if (chosen.length > 0) onImportSelected(chosen);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Детектирани сценарија во документот
            </h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{fileName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Select all toggle */}
        <div className="px-5 pt-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:underline"
          >
            {selected.size === segments.length
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
            {selected.size === segments.length ? 'Откажи ги сите' : 'Избери ги сите'}
          </button>
        </div>

        {/* Segment list */}
        <div className="overflow-y-auto flex-1 px-5 pb-3 space-y-2">
          {segments.map(seg => {
            const isSelected = selected.has(seg.index);
            const preview = seg.text.slice(0, 120).trim();
            return (
              <button
                key={seg.index}
                type="button"
                onClick={() => toggle(seg.index)}
                className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                  isSelected
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-indigo-500">
                    {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-300" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                      {seg.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{preview}…</p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {Math.round(seg.text.length / 100) / 10} K знаци
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
          >
            Откажи
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={selected.size === 0 || isImporting}
            className="flex-2 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
          >
            {isImporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Се увезуваат…</>
              : <><Sparkles className="w-4 h-4" /> Увези избраните ({selected.size})</>}
          </button>
        </div>
      </div>
    </div>
  );
};
