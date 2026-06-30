import React, { useState } from 'react';
import { Check, X, ChevronRight, CheckSquare, Square } from 'lucide-react';
import type { LessonPlan } from '../../types';

type FieldKey =
  | 'title'
  | 'theme'
  | `objective_${number}`
  | 'intro'
  | `main_${number}`
  | 'concluding'
  | 'differentiation';

interface DiffField {
  key: FieldKey;
  label: string;
  original: string;
  enriched: string;
}

interface Props {
  original: Partial<LessonPlan>;
  enriched: Partial<LessonPlan>;
  onAcceptAll: (merged: Partial<LessonPlan>) => void;
  onDiscard: () => void;
}

function buildDiffs(original: Partial<LessonPlan>, enriched: Partial<LessonPlan>): DiffField[] {
  const diffs: DiffField[] = [];

  const check = (key: FieldKey, label: string, orig: string | undefined, enr: string | undefined) => {
    if ((orig ?? '') !== (enr ?? '') && enr) {
      diffs.push({ key, label, original: orig ?? '', enriched: enr });
    }
  };

  check('title', 'Наслов', original.title, enriched.title);
  check('theme', 'Тема', original.theme, enriched.theme);

  const maxObjs = Math.max(original.objectives?.length ?? 0, enriched.objectives?.length ?? 0);
  for (let i = 0; i < maxObjs; i++) {
    check(`objective_${i}`, `Цел ${i + 1}`, original.objectives?.[i]?.text, enriched.objectives?.[i]?.text);
  }

  check('intro', 'Воведна фаза', original.scenario?.introductory?.text, enriched.scenario?.introductory?.text);

  const maxMain = Math.max(original.scenario?.main?.length ?? 0, enriched.scenario?.main?.length ?? 0);
  for (let i = 0; i < maxMain; i++) {
    check(`main_${i}`, `Главна фаза ${i + 1}`, original.scenario?.main?.[i]?.text, enriched.scenario?.main?.[i]?.text);
  }

  check('concluding', 'Завршна фаза', original.scenario?.concluding?.text, enriched.scenario?.concluding?.text);
  check('differentiation', 'Диференцијација', original.differentiation, enriched.differentiation);

  return diffs;
}

/** Apply a set of accepted diffs to the original plan — true field-level merge. */
function applyAccepted(original: Partial<LessonPlan>, enriched: Partial<LessonPlan>, diffs: DiffField[], accepted: Set<number>): Partial<LessonPlan> {
  // Deep clone original as the base
  const merged: Partial<LessonPlan> = JSON.parse(JSON.stringify(original));

  diffs.forEach((diff, i) => {
    if (!accepted.has(i)) return;
    const key = diff.key;

    if (key === 'title') {
      merged.title = enriched.title;
    } else if (key === 'theme') {
      merged.theme = enriched.theme;
    } else if (key === 'intro') {
      if (!merged.scenario) merged.scenario = {} as LessonPlan['scenario'];
      if (!merged.scenario!.introductory) merged.scenario!.introductory = { text: '', duration: '' };
      merged.scenario!.introductory!.text = enriched.scenario?.introductory?.text ?? '';
    } else if (key === 'concluding') {
      if (!merged.scenario) merged.scenario = {} as LessonPlan['scenario'];
      if (!merged.scenario!.concluding) merged.scenario!.concluding = { text: '', duration: '' };
      merged.scenario!.concluding!.text = enriched.scenario?.concluding?.text ?? '';
    } else if (key === 'differentiation') {
      merged.differentiation = enriched.differentiation;
    } else if (key.startsWith('objective_')) {
      const idx = parseInt(key.replace('objective_', ''), 10);
      if (!merged.objectives) merged.objectives = [];
      if (!merged.objectives[idx]) {
        merged.objectives[idx] = { text: '', bloomsLevel: 'Remembering' };
      }
      merged.objectives[idx].text = enriched.objectives?.[idx]?.text ?? '';
    } else if (key.startsWith('main_')) {
      const idx = parseInt(key.replace('main_', ''), 10);
      if (!merged.scenario) merged.scenario = {} as LessonPlan['scenario'];
      if (!merged.scenario!.main) merged.scenario!.main = [];
      if (!merged.scenario!.main[idx]) {
        merged.scenario!.main[idx] = { text: '', bloomsLevel: 'Remembering' };
      }
      merged.scenario!.main[idx].text = enriched.scenario?.main?.[idx]?.text ?? '';
    }
  });

  return merged;
}

export const PlanDiffView: React.FC<Props> = ({ original, enriched, onAcceptAll, onDiscard }) => {
  const diffs = buildDiffs(original, enriched);
  const [accepted, setAccepted] = useState<Set<number>>(new Set(diffs.map((_, i) => i)));

  if (diffs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Нема разлики — сценариото е идентично со збогатената верзија.
      </div>
    );
  }

  const toggle = (i: number) => {
    setAccepted(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectAll = () => setAccepted(new Set(diffs.map((_, i) => i)));
  const deselectAll = () => setAccepted(new Set());

  const handleApply = () => {
    const merged = applyAccepted(original, enriched, diffs, accepted);
    onAcceptAll(merged);
  };

  const allSelected = accepted.size === diffs.length;
  const noneSelected = accepted.size === 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          {diffs.length} промени — прифати или одбиј поединечно
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={deselectAll} disabled={noneSelected}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-40">
            <X className="w-3.5 h-3.5" /> Одбиј сè
          </button>
          <button type="button" onClick={selectAll} disabled={allSelected}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold disabled:opacity-40">
            <Check className="w-3.5 h-3.5" /> Прифати сè
          </button>
        </div>
      </div>

      {/* Diff rows */}
      {diffs.map((diff, i) => {
        const isAccepted = accepted.has(i);
        return (
          <div key={diff.key}
            className={`rounded-xl border overflow-hidden transition-all ${isAccepted ? 'border-emerald-300 shadow-sm' : 'border-gray-200'}`}>
            {/* Row header */}
            <button type="button" onClick={() => toggle(i)} className={`w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide transition-colors ${isAccepted ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              <span className="flex items-center gap-2">
                {isAccepted
                  ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                  : <Square className="w-4 h-4 text-gray-400" />}
                {diff.label}
              </span>
              <span className="text-[10px] font-semibold opacity-70">
                {isAccepted ? 'Прифатено' : 'Одбиено'}
              </span>
            </button>
            {/* Content */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="p-3 bg-white">
                <p className="text-[10px] font-bold text-gray-400 mb-1">ОРИГИНАЛ</p>
                <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-5">{diff.original || <span className="italic text-gray-400">—</span>}</p>
              </div>
              <div className={`p-3 transition-colors ${isAccepted ? 'bg-emerald-50/60' : 'bg-white'}`}>
                <p className="text-[10px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> AI ЗБОГАТЕНО
                </p>
                <p className="text-xs text-gray-800 whitespace-pre-wrap line-clamp-5">{diff.enriched}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Apply button */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onDiscard}
          className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 font-bold text-sm transition-colors flex items-center gap-2">
          <X className="w-4 h-4" /> Откажи
        </button>
        <button type="button" onClick={handleApply} disabled={noneSelected}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          Примени {accepted.size}/{diffs.length} промени
        </button>
      </div>
    </div>
  );
};
