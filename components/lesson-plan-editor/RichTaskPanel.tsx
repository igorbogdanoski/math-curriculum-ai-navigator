import React, { useState } from 'react';
import { ICONS } from '../../constants';

interface RichTask {
  context: string;
  task: string;
  support: string;
  standard: string;
  advanced: string;
  discussionQuestion: string;
}

interface RichTaskPanelProps {
  richTask: RichTask | null;
  isGenerating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  /** Saves the generated task onto the plan's own (persisted) richTask field */
  onAccept?: () => void;
  accepted?: boolean;
}

const LEVEL_CONFIG = [
  {
    key: 'support' as const,
    label: 'Поддршка',
    icon: '🟢',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    desc: 'Со скафолдинг',
  },
  {
    key: 'standard' as const,
    label: 'Стандардно',
    icon: '🟡',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    desc: 'Без помош',
  },
  {
    key: 'advanced' as const,
    label: 'Напредно',
    icon: '🔴',
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
    desc: 'Проширување',
  },
];

export const RichTaskPanel: React.FC<RichTaskPanelProps> = ({
  richTask,
  isGenerating,
  canGenerate,
  onGenerate,
  onAccept,
  accepted,
}) => {
  const [openLevel, setOpenLevel] = useState<string | null>('standard');

  return (
    <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span className="text-base">🎲</span>
          Богата задача
        </h3>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating
            ? <><ICONS.spinner className="w-3.5 h-3.5 animate-spin" /> Генерирам…</>
            : <><ICONS.sparkles className="w-3.5 h-3.5" /> Генерирај</>}
        </button>
      </div>
      <p className="text-[10px] text-gray-400">
        Отворена задача со реален македонски контекст — три ZPD нивоа за диференцирана настава.
      </p>

      {!richTask && !isGenerating && (
        <div className="text-center py-4 text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Кликни „Генерирај" за да добиеш богата задача за оваа лекција.
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-purple-600 font-semibold">
          <ICONS.spinner className="w-4 h-4 animate-spin" />
          Креирам богата задача со ZPD нивоа…
        </div>
      )}

      {richTask && !isGenerating && (
        <div className="space-y-3">
          {/* Context */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-blue-600 mb-1">📍 Контекст</p>
            <p className="text-[11px] text-gray-700 leading-relaxed">{richTask.context}</p>
          </div>

          {/* Main task */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <p className="text-[10px] font-bold text-indigo-600 mb-1">❓ Задача</p>
            <p className="text-[11px] text-gray-800 font-medium leading-relaxed">{richTask.task}</p>
          </div>

          {/* ZPD levels */}
          <div className="space-y-1.5">
            {LEVEL_CONFIG.map(lv => {
              const isOpen = openLevel === lv.key;
              return (
                <div key={lv.key} className={`rounded-lg border ${lv.color} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => setOpenLevel(isOpen ? null : lv.key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold ${lv.color} hover:opacity-80 transition-opacity`}
                  >
                    <span>{lv.icon}</span>
                    <span>{lv.label}</span>
                    <span className="text-[9px] font-normal opacity-60">{lv.desc}</span>
                    <span className="ml-auto opacity-50">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 bg-white/60">
                      <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{richTask[lv.key]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Discussion question */}
          <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-violet-600 mb-1">💬 Дискусија</p>
            <p className="text-[11px] text-gray-700 italic leading-relaxed">{richTask.discussionQuestion}</p>
          </div>

          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              disabled={accepted}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-default"
            >
              {accepted
                ? <><ICONS.check className="w-3.5 h-3.5" /> Додадена во подготовката</>
                : 'Прифати во подготовката'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
