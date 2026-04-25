import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';

interface LessonPlanDifferentiationPanelProps {
  diffActivities: { support: string[]; standard: string[]; advanced: string[] } | null;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}

const LEVELS = [
  { key: 'support' as const,  label: 'Ниво А — Поддршка',     color: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-100 text-blue-700' },
  { key: 'standard' as const, label: 'Ниво Б — Стандардно',   color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'advanced' as const, label: 'Ниво Ц — Надградување', color: 'bg-violet-50 border-violet-200',   badge: 'bg-violet-100 text-violet-700' },
] as const;

export const LessonPlanDifferentiationPanel: React.FC<LessonPlanDifferentiationPanelProps> = ({
  diffActivities, isGenerating, canGenerate, onGenerate,
}) => (
  <Card className="p-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-xs font-black text-gray-700 uppercase tracking-wide">Диференцирана настава</p>
        <p className="text-[10px] text-gray-400 mt-0.5">AI предлози за 3 нивоа</p>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition disabled:opacity-40"
      >
        {isGenerating
          ? <><ICONS.spinner className="w-3.5 h-3.5 animate-spin" /> Генерирам...</>
          : <><ICONS.sparkles className="w-3.5 h-3.5" /> Генерирај</>}
      </button>
    </div>

    {diffActivities ? (
      <div className="space-y-2">
        {LEVELS.map(({ key, label, color, badge }) => (
          <div key={key} className={`rounded-xl border p-3 ${color}`}>
            <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${badge}`}>
              {label}
            </span>
            <ul className="mt-2 space-y-1.5">
              {diffActivities[key].map((act, i) => (
                <li key={i} className="text-xs text-gray-700 leading-relaxed flex gap-1.5">
                  <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ) : !isGenerating && (
      <p className="text-xs text-gray-400 text-center py-2">
        Притисни „Генерирај" за AI предлози за секое ниво.
      </p>
    )}
  </Card>
);
