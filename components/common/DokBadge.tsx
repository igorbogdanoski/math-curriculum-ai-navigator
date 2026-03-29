import React, { useState } from 'react';
import { DOK_META, type DokLevel } from '../../types';

interface DokBadgeProps {
  level: DokLevel;
  /** Show full tooltip with description on hover */
  showTooltip?: boolean;
  /** compact = just the level dot+number, default = label + mk title */
  size?: 'compact' | 'default' | 'large';
}

const DOK_DESCRIPTIONS: Record<DokLevel, string> = {
  1: 'Припомнување и репродукција — факти, дефиниции, директни процедури.',
  2: 'Вештини и концепти — примена на концепти, интерпретација, класификација.',
  3: 'Стратешко размислување — доказ, анализа на грешки, повеќечекорно решавање.',
  4: 'Проширено размислување — истражување, проектни задачи, интердисциплинарни врски.',
};

export const DokBadge: React.FC<DokBadgeProps> = ({ level, showTooltip = true, size = 'default' }) => {
  const [open, setOpen] = useState(false);
  const meta = DOK_META[level];
  if (!meta) return null;

  if (size === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black border ${meta.color} cursor-default select-none`}
        title={showTooltip ? `${meta.title} — ${DOK_DESCRIPTIONS[level]}` : undefined}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  }

  if (size === 'large') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${meta.color}`}>
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${meta.dot}`} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider leading-none">{meta.label}</p>
          <p className="text-xs font-semibold mt-0.5">{meta.mk} — {meta.title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black border ${meta.color} cursor-default select-none`}
        onMouseEnter={() => showTooltip && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
        {meta.label}
        <span className="opacity-70 font-normal">· {meta.mk}</span>
      </span>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-2xl pointer-events-none">
          <p className="font-black mb-0.5">{meta.title}</p>
          <p className="text-gray-300 leading-snug">{DOK_DESCRIPTIONS[level]}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

/** Horizontal DoK distribution bar — shows breakdown of a question set */
export const DokDistributionBar: React.FC<{ questions: { dokLevel?: DokLevel }[] }> = ({ questions }) => {
  const total = questions.length;
  if (total === 0) return null;

  const counts: Record<DokLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const q of questions) {
    if (q.dokLevel && q.dokLevel >= 1 && q.dokLevel <= 4) counts[q.dokLevel as DokLevel]++;
  }

  const levels: DokLevel[] = [1, 2, 3, 4];
  const hasDok = levels.some(l => counts[l] > 0);
  if (!hasDok) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">DoK Распределба</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {levels.map(l => {
          const pct = Math.round((counts[l] / total) * 100);
          if (pct === 0) return null;
          return (
            <div
              key={l}
              title={`${DOK_META[l].label}: ${counts[l]} прашања (${pct}%)`}
              className={`h-full ${DOK_META[l].dot} transition-all`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {levels.filter(l => counts[l] > 0).map(l => (
          <span key={l} className="flex items-center gap-1 text-[9px] font-bold text-gray-500">
            <span className={`w-2 h-2 rounded-full ${DOK_META[l].dot}`} />
            {DOK_META[l].label}: {counts[l]}
          </span>
        ))}
      </div>
    </div>
  );
};
