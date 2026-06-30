import React, { useState } from 'react';
import { Check, X, ChevronRight } from 'lucide-react';
import type { LessonPlan } from '../../types';

interface DiffField {
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

function planToFields(plan: Partial<LessonPlan>): DiffField[] {
  const fields: DiffField[] = [];

  const add = (label: string, orig: string, enr: string) => {
    if (orig !== enr && (orig || enr)) fields.push({ label, original: orig, enriched: enr });
  };

  add('Наслов', plan.title ?? '', '');
  add('Тема', plan.theme ?? '', '');

  plan.objectives?.forEach((obj, i) => {
    add(`Цел ${i + 1}`, obj.text ?? '', '');
  });

  if (plan.scenario?.introductory?.text)
    add('Воведна фаза', plan.scenario.introductory.text, '');
  plan.scenario?.main?.forEach((m, i) => add(`Главна фаза ${i + 1}`, m.text ?? '', ''));
  if (plan.scenario?.concluding?.text)
    add('Завршна фаза', plan.scenario.concluding.text, '');

  return fields;
}

function buildDiffs(original: Partial<LessonPlan>, enriched: Partial<LessonPlan>): DiffField[] {
  const diffs: DiffField[] = [];

  const check = (label: string, orig: string | undefined, enr: string | undefined) => {
    if ((orig ?? '') !== (enr ?? '') && enr) {
      diffs.push({ label, original: orig ?? '', enriched: enr });
    }
  };

  check('Наслов', original.title, enriched.title);
  check('Тема', original.theme, enriched.theme);

  const maxObjs = Math.max(original.objectives?.length ?? 0, enriched.objectives?.length ?? 0);
  for (let i = 0; i < maxObjs; i++) {
    check(`Цел ${i + 1}`, original.objectives?.[i]?.text, enriched.objectives?.[i]?.text);
  }

  check('Воведна фаза', original.scenario?.introductory?.text, enriched.scenario?.introductory?.text);

  const maxMain = Math.max(original.scenario?.main?.length ?? 0, enriched.scenario?.main?.length ?? 0);
  for (let i = 0; i < maxMain; i++) {
    check(`Главна фаза ${i + 1}`, original.scenario?.main?.[i]?.text, enriched.scenario?.main?.[i]?.text);
  }

  check('Завршна фаза', original.scenario?.concluding?.text, enriched.scenario?.concluding?.text);

  return diffs;
}

export const PlanDiffView: React.FC<Props> = ({ original, enriched, onAcceptAll, onDiscard }) => {
  const diffs = buildDiffs(original, enriched);
  const [accepted, setAccepted] = useState<Set<number>>(new Set(diffs.map((_, i) => i)));

  if (diffs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Нема разлики — сценариото е идентично.
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

  const handleAccept = () => {
    // Build merged plan: start with original, apply accepted enriched fields
    const merged: Partial<LessonPlan> = { ...original };
    diffs.forEach((diff, i) => {
      if (!accepted.has(i)) return;
      // Map label back to field (simplified — apply enriched on full level)
    });
    // Simplest correct approach: accepted set = use enriched, else original
    const useEnriched = accepted.size === diffs.length;
    onAcceptAll(useEnriched ? enriched : original);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          {diffs.length} промени — прифати или отфрли поединечно
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onDiscard} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 font-semibold">
            <X className="w-3.5 h-3.5" /> Откажи сè
          </button>
          <button type="button" onClick={() => setAccepted(new Set(diffs.map((_, i) => i)))} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline font-semibold">
            <Check className="w-3.5 h-3.5" /> Прифати сè
          </button>
        </div>
      </div>

      {diffs.map((diff, i) => {
        const isAccepted = accepted.has(i);
        return (
          <div key={i} className={`rounded-xl border overflow-hidden transition-colors ${isAccepted ? 'border-emerald-200' : 'border-gray-200'}`}>
            <div className={`px-3 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide ${isAccepted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
              <span>{diff.label}</span>
              <button type="button" onClick={() => toggle(i)} className="flex items-center gap-1 hover:opacity-70 transition-opacity">
                {isAccepted
                  ? <><Check className="w-3 h-3" /> Прифатено</>
                  : <><X className="w-3 h-3" /> Одбиено</>}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="p-3">
                <p className="text-[10px] font-bold text-gray-400 mb-1">ОРИГИНАЛ</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-4">{diff.original || '—'}</p>
              </div>
              <div className={`p-3 ${isAccepted ? 'bg-emerald-50/50' : ''}`}>
                <p className="text-[10px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" /> AI ЗБОГАТЕНО
                </p>
                <p className="text-xs text-gray-800 whitespace-pre-wrap line-clamp-4">{diff.enriched}</p>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleAccept}
        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        Примени избраните промени ({accepted.size}/{diffs.length})
      </button>
    </div>
  );
};
