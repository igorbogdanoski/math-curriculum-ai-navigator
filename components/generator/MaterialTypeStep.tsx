import React from 'react';
import { ICONS } from '../../constants';
import { SmartStart } from './SmartStart';
import type { MaterialType } from '../../types';

// Material metadata: descriptions, tags, time estimates, optional badges.
export const MATERIAL_META: Record<string, {
  emoji: string;
  description: string;
  timeEst: string;
  tags: string[];
  badge?: string;
  badgeColor?: string;
}> = {
  SCENARIO:      { emoji: '🎭', description: 'Целосен план за наставен час со активности, прашања и диференцијација по Блум', timeEst: '45 мин', tags: ['Подготовка', 'Целосен час'] },
  LEARNING_PATH: { emoji: '🗺️', description: 'Персонализирана патека низ концепти прилагодена на нивото на ученикот', timeEst: '1 недела', tags: ['Диференцирано', 'Патека'] },
  PRESENTATION:  { emoji: '📽️', description: 'Структурирани слајдови со содржина, активности и AI генерирани елементи', timeEst: '~10 мин', tags: ['Слајдови', 'Визуелно'], badge: 'PRO', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200' },
  ASSESSMENT:    { emoji: '📄', description: 'Формален тест или писмена работа за печатење или дигитална употреба', timeEst: '20–45 мин', tags: ['Формален', 'Печатење'] },
  RUBRIC:        { emoji: '📊', description: 'Критериуми за оценување со нивоа и дескриптори усогласени со МОН', timeEst: '~5 мин', tags: ['Оценување', 'МОН'] },
  FLASHCARDS:    { emoji: '🃏', description: 'Картички за меморирање — прашање на едната, одговор на другата страна', timeEst: '~15 мин', tags: ['Повторување', 'Домашно'] },
  QUIZ:          { emoji: '❓', description: 'Интерактивен квиз — учениците играат на нивните уреди во реално време', timeEst: '~10 мин', tags: ['Интерактивно', '📱 Ученици'], badge: 'ПОПУЛАРНО', badgeColor: 'bg-green-100 text-green-700 border-green-200' },
  EXIT_TICKET:   { emoji: '🎟️', description: '2–3 брзи прашања за проверка на разбирањето пред крај на часот', timeEst: '~3 мин', tags: ['⚡ Брзо', 'Крај на час'], badge: 'БРЗО', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200' },
  ILLUSTRATION:  { emoji: '🖼️', description: 'AI генерирана слика или дијаграм за визуелно претставување на концепт', timeEst: '~2 мин', tags: ['Визуелно', 'Презентација'] },
  VIDEO_EXTRACTOR:{ emoji: '🎬', description: 'Внеси видео URL, потврди preview и генерирај наставно сценарио од содржината', timeEst: '~3 мин', tags: ['URL', 'Preview', 'MVP'], badge: 'MVP', badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  IMAGE_EXTRACTOR:{ emoji: '📸', description: 'Прикачи слика од учебник, табла или ракопис — AI ги извлекува задачите и генерира наставен план', timeEst: '~2 мин', tags: ['Vision', 'Слика'], badge: 'НОВО', badgeColor: 'bg-violet-100 text-violet-700 border-violet-200' },
  WEB_EXTRACTOR:  { emoji: '🌐', description: 'Внеси URL на математичка страна — AI ја чита, анализира и генерира наставен материјал', timeEst: '~3 мин', tags: ['URL', 'Веб'], badge: 'НОВО', badgeColor: 'bg-teal-100 text-teal-700 border-teal-200' },
  WORKED_EXAMPLE:{ emoji: '✍️', description: 'Детален чекор-по-чекор решен пример со образложение за секој чекор', timeEst: '~5 мин', tags: ['Пример', 'Моделирање'], badge: 'НОВО', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const RECENT_TYPES_KEY = 'generator_recent_types';

export function loadRecentTypes(): MaterialType[] {
  try {
    const raw = localStorage.getItem(RECENT_TYPES_KEY);
    return raw ? (JSON.parse(raw) as MaterialType[]) : [];
  } catch { return []; }
}

export function saveRecentType(type: MaterialType): void {
  try {
    const existing = loadRecentTypes().filter(t => t !== type);
    localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify([type, ...existing].slice(0, 5)));
  } catch { /* ignore */ }
}

export interface MaterialOption {
  id: MaterialType;
  label: string;
  icon: keyof typeof ICONS;
}

interface MaterialTypeStepProps {
  visible: boolean;
  materialType: MaterialType | null;
  materialOptions: MaterialOption[];
  recentTypes: MaterialType[];
  onSelect: (type: MaterialType) => void;
  onSmartStartAccept: (result: { materialType: MaterialType; grade: number | null; topicHint: string | null }) => void;
}

export const MaterialTypeStep: React.FC<MaterialTypeStepProps> = ({
  visible,
  materialType,
  materialOptions,
  recentTypes,
  onSelect,
  onSmartStartAccept,
}) => {
  return (
    <div data-tour="generator-step-1" className={`transition-opacity duration-300 ${visible ? 'block animate-fade-in' : 'hidden'}`}>
      <div className="py-2 border-b border-gray-100 mb-4 flex items-center gap-3">
        <span className="bg-brand-primary text-white text-xl w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
        <h2 className="text-xl font-bold text-gray-800">Изберете тип на материјал</h2>
      </div>

      {/* SmartStart — AI intent detection */}
      <SmartStart onAccept={onSmartStartAccept} />

      {/* Recently used — quick shortcuts */}
      {recentTypes.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Последно користено</p>
          <div className="flex flex-wrap gap-2">
            {recentTypes.slice(0, 3).map(typeId => {
              const meta = MATERIAL_META[typeId];
              const opt = materialOptions.find(o => o.id === typeId);
              if (!meta || !opt) return null;
              return (
                <button
                  type="button"
                  key={typeId}
                  onClick={() => onSelect(typeId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:border-brand-primary hover:text-brand-primary hover:bg-blue-50 transition-all shadow-sm"
                >
                  <span>{meta.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rich material type cards */}
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Сите типови</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {materialOptions.map(({ id, label }) => {
          const meta = MATERIAL_META[id];
          const isActive = materialType === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onSelect(id)}
              className={`relative text-left p-3.5 rounded-xl border-2 transition-all focus:outline-none group
                ${isActive
                  ? 'bg-blue-50 border-brand-primary shadow-md scale-[1.01]'
                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm'
                }`}
            >
              {meta?.badge && (
                <span className={`absolute top-2.5 right-2.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${meta.badgeColor ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {meta.badge}
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{meta?.emoji ?? '📄'}</span>
                <div className="flex-1 min-w-0 pr-6">
                  <p className={`font-bold text-sm leading-tight ${isActive ? 'text-brand-primary' : 'text-gray-800'}`}>{label}</p>
                  {meta?.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{meta.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {meta?.timeEst && (
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">⏱ {meta.timeEst}</span>
                    )}
                    {meta?.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
