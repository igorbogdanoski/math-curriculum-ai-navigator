import React, { useState } from 'react';
import { ICONS } from '../../constants';
import { SmartStart } from './SmartStart';
import type { MaterialType } from '../../types';

type MaterialMeta = {
  emoji: string;
  description: string;
  features: string[];
  timeEst: string;
  tags: string[];
  badge?: string;
  badgeColor?: string;
  category: 'create' | 'assess' | 'extract' | 'visual';
};

export const MATERIAL_META: Record<string, MaterialMeta> = {
  SCENARIO: {
    emoji: '🎭', category: 'create',
    description: 'Целосен план за наставен час со активности, прашања и диференцијација по Блум',
    features: ['Структура по Блумова таксономија', 'Диференцијација за 3 нивоа', 'Реален македонски контекст', 'Буџет за 40-минутен час'],
    timeEst: '45 мин', tags: ['Подготовка', 'Целосен час'],
  },
  LEARNING_PATH: {
    emoji: '🗺️', category: 'create',
    description: 'Персонализирана патека низ концепти прилагодена на нивото на ученикот',
    features: ['Персонализирано по профил на ученик', 'Адаптивна секвенца на концепти', 'Препораки за ресурси', 'План за 1–2 недели'],
    timeEst: '1 недела', tags: ['Диференцирано', 'Патека'],
  },
  PRESENTATION: {
    emoji: '📽️', category: 'create',
    description: 'Структурирани слајдови со содржина, активности и AI генерирани елементи',
    features: ['Gamma-стил структурирани слајдови', 'Вградени активности и прашања', 'Наслов + содржина + заклучок', 'Export-готово форматирање'],
    timeEst: '~10 мин', tags: ['Слајдови', 'Визуелно'],
    badge: 'PRO', badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  WORKED_EXAMPLE: {
    emoji: '✍️', category: 'create',
    description: 'Детален чекор-по-чекор решен пример со образложение за секој чекор',
    features: ['Чекор-по-чекор математичко решение', 'Образложение на секој чекор', 'Чести грешки и предупредувања', 'Моделирање на математичко мислење'],
    timeEst: '~5 мин', tags: ['Пример', 'Моделирање'],
    badge: 'НОВО', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  ASSESSMENT: {
    emoji: '📄', category: 'assess',
    description: 'Формален тест или писмена работа за печатење или дигитална употреба',
    features: ['Прашања по сите Блум нивоа', '3 верзии: поддршка / стандард / предизвик', 'Вклучено самооценување', 'Готово за печатење'],
    timeEst: '20–45 мин', tags: ['Формален', 'Печатење'],
  },
  QUIZ: {
    emoji: '❓', category: 'assess',
    description: 'Интерактивен квиз — учениците играат на нивните уреди во реално време',
    features: ['Реално-временски одговори на уреди', 'Табела со резултати по ученик', 'Kahoot-стил интерактивност', 'Автоматско оценување'],
    timeEst: '~10 мин', tags: ['Интерактивно', '📱 Ученици'],
    badge: 'ПОПУЛАРНО', badgeColor: 'bg-green-100 text-green-700 border-green-200',
  },
  FLASHCARDS: {
    emoji: '🃏', category: 'assess',
    description: 'Картички за меморирање — прашање на едната, одговор на другата страна',
    features: ['Прашање–одговор формат', 'Спирално повторување', 'Домашна работа / самостојно учење', 'Print-ready картички'],
    timeEst: '~15 мин', tags: ['Повторување', 'Домашно'],
  },
  RUBRIC: {
    emoji: '📊', category: 'assess',
    description: 'Критериуми за оценување со нивоа и дескриптори усогласени со МОН',
    features: ['МОН-усогласени критериуми', 'Холистичко и аналитичко оценување', 'Дескриптори по ниво (1–4)', 'Дигитален запис во системот'],
    timeEst: '~5 мин', tags: ['Оценување', 'МОН'],
  },
  EXIT_TICKET: {
    emoji: '🎟️', category: 'assess',
    description: '2–3 брзи прашања за проверка на разбирањето пред крај на часот',
    features: ['3 прашања за само 3 минути', 'Детекција на мисконцепции', 'Формативна оценка', 'Мгновен наставнички преглед'],
    timeEst: '~3 мин', tags: ['⚡ Брзо', 'Крај на час'],
    badge: 'БРЗО', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  IMAGE_EXTRACTOR: {
    emoji: '📸', category: 'extract',
    description: 'Прикачи слика од учебник, табла или ракопис — AI ги извлекува задачите',
    features: ['Vision AI анализа на слики', 'Ракопис и табла распознавање', 'Автоматско извлекување на задачи', 'Генерирање наставен план од содржина'],
    timeEst: '~2 мин', tags: ['Vision', 'Слика'],
    badge: 'НОВО', badgeColor: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  WEB_EXTRACTOR: {
    emoji: '🌐', category: 'extract',
    description: 'Внеси URL на математичка страна — AI ја чита, анализира и генерира материјал',
    features: ['Анализа на веб страни и PDF', 'Curriculum mapping на содржина', 'Цитирање на извор', 'Поддршка за batch URLs'],
    timeEst: '~3 мин', tags: ['URL', 'Веб'],
    badge: 'НОВО', badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  VIDEO_EXTRACTOR: {
    emoji: '🎬', category: 'extract',
    description: 'Внеси видео URL, потврди preview и генерирај наставно сценарио',
    features: ['YouTube / Vimeo поддршка', 'Транскрипт анализа по сегменти', 'Timestamp-базирани активности', 'Наставна адаптација на видео'],
    timeEst: '~3 мин', tags: ['URL', 'Preview'],
    badge: 'MVP', badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  ILLUSTRATION: {
    emoji: '🖼️', category: 'visual',
    description: 'AI генерирана слика или дијаграм за визуелно претставување на концепт',
    features: ['Imagen 4 генерирање', 'Математички дијаграми и графици', 'Педагошки контекст и стил', 'Hi-res слика за печатење'],
    timeEst: '~2 мин', tags: ['Визуелно', 'Презентација'],
  },
};

const CATEGORIES = [
  { key: 'create',  label: 'Создај',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  dot: 'bg-blue-500'   },
  { key: 'assess',  label: 'Оценувај',  color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',dot: 'bg-emerald-500'},
  { key: 'extract', label: 'Извлечи',   color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500'  },
  { key: 'visual',  label: 'Визуелно',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
] as const;

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

function MaterialCard({ id, label, meta, isActive, onSelect }: {
  id: MaterialType;
  label: string;
  meta: MaterialMeta;
  isActive: boolean;
  onSelect: (t: MaterialType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const showFeatures = isActive || expanded;

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`relative w-full text-left rounded-xl border-2 transition-all duration-200 focus:outline-none overflow-hidden
        ${isActive
          ? 'bg-blue-50 border-brand-primary shadow-md'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm hover:bg-gray-50/60'
        }`}
    >
      {/* Badge */}
      {meta.badge && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border ${meta.badgeColor ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          {meta.badge}
        </span>
      )}

      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{meta.emoji}</span>
          <div className="flex-1 min-w-0 pr-6">
            <p className={`font-bold text-sm leading-tight ${isActive ? 'text-brand-primary' : 'text-gray-800'}`}>
              {label}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
              {meta.description}
            </p>
          </div>
        </div>

        {/* Feature list — visible on hover or select */}
        <div className={`overflow-hidden transition-all duration-200 ${showFeatures ? 'max-h-40 opacity-100 mt-2.5' : 'max-h-0 opacity-0'}`}>
          <ul className="space-y-0.5">
            {meta.features.map(f => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-600 leading-snug">
                <span className={`flex-shrink-0 mt-0.5 ${isActive ? 'text-brand-primary' : 'text-emerald-500'}`}>✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer chips */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">⏱ {meta.timeEst}</span>
          {meta.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>

      {/* Active left accent bar */}
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary rounded-l-xl" />}
    </button>
  );
}

export const MaterialTypeStep: React.FC<MaterialTypeStepProps> = ({
  visible, materialType, materialOptions, recentTypes, onSelect, onSmartStartAccept,
}) => {
  const optionsByCategory = CATEGORIES.map(cat => ({
    ...cat,
    options: materialOptions.filter(o => MATERIAL_META[o.id]?.category === cat.key),
  })).filter(c => c.options.length > 0);

  return (
    <div data-tour="generator-step-1" className={`transition-opacity duration-300 ${visible ? 'block animate-fade-in' : 'hidden'}`}>
      <div className="py-2 border-b border-gray-100 mb-4 flex items-center gap-3">
        <span className="bg-brand-primary text-white text-xl w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
        <h2 className="text-xl font-bold text-gray-800">Изберете тип на материјал</h2>
      </div>

      {/* SmartStart */}
      <SmartStart onAccept={onSmartStartAccept} />

      {/* Recently used */}
      {recentTypes.length > 0 && (
        <div className="mb-5">
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

      {/* Categorized sections */}
      <div className="space-y-5">
        {optionsByCategory.map(({ key, label, color, bg, border, dot, options }) => (
          <div key={key}>
            {/* Category header */}
            <div className={`flex items-center gap-2 mb-2.5 px-2 py-1 rounded-lg ${bg} border ${border} w-fit`}>
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
              <span className={`text-[10px] font-semibold ${color} opacity-60`}>({options.length})</span>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map(({ id, label: optLabel }) => {
                const meta = MATERIAL_META[id];
                if (!meta) return null;
                return (
                  <MaterialCard
                    key={id}
                    id={id}
                    label={optLabel}
                    meta={meta}
                    isActive={materialType === id}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-center text-[11px] text-gray-400 mt-5 italic">
        Задржи се над картичка за да ги видиш сите опции
      </p>
    </div>
  );
};
