/**
 * S97.1 — ContextualMathTools
 *
 * Shows math tool shortcuts relevant to the current lesson topic.
 * Detects domain (algebra/geometry/statistics/calculus/arithmetic)
 * from the topic title and surfaces the matching tools.
 */

import React, { useState } from 'react';
import { detectMathDomain, DOMAIN_TOOLS } from '../../utils/mathDomainDetector';

interface Props {
  topicTitle: string | null | undefined;
  onNavigate: (path: string) => void;
}

const DOMAIN_LABEL: Record<string, string> = {
  algebra:    'Алгебра',
  geometry:   'Геометрија',
  statistics: 'Статистика / Веројатност',
  calculus:   'Анализа / Калкулус',
  arithmetic: 'Аритметика',
  other:      'Математички алатки',
};

export const ContextualMathTools: React.FC<Props> = ({ topicTitle, onNavigate }) => {
  const [open, setOpen] = useState(false);

  if (!topicTitle) return null;

  const domain = detectMathDomain(topicTitle);
  const tools = DOMAIN_TOOLS[domain];

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span>🧮</span>
          <span>Алатки за {DOMAIN_LABEL[domain]}</span>
        </span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-2 grid grid-cols-2 gap-1.5 bg-white">
          {tools.map(tool => (
            <button
              key={tool.route}
              type="button"
              onClick={() => onNavigate(tool.route)}
              className="flex items-center gap-1.5 px-2 py-2 bg-slate-50 hover:bg-brand-primary/10 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:text-brand-primary transition-colors text-left"
            >
              <span className="text-base leading-none">{tool.icon}</span>
              <span className="truncate">{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
