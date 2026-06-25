import React, { useState } from 'react';
import type { AIGeneratedAnnualPlanTopic } from '../../types';

// School year: 36 weeks. Winter break ~weeks 18-20 (approx. Jan).
const TOTAL_WEEKS = 36;
const WINTER_START = 17;  // 0-indexed
const WINTER_WEEKS = 2;

// Month labels placed at week boundaries (0-indexed start week)
const MONTH_LABELS = [
  { label: 'СЕП', week: 0 },
  { label: 'ОКТ', week: 4 },
  { label: 'НОЕ', week: 8 },
  { label: 'ДЕК', week: 13 },
  { label: 'ЈАН', week: 17 },
  { label: 'ФЕВ', week: 21 },
  { label: 'МАР', week: 25 },
  { label: 'АПР', week: 29 },
  { label: 'МАЈ', week: 32 },
  { label: 'ЈУН', week: 35 },
];

// Map topic title keywords → Tailwind color classes
function themeColor(title: string): { bg: string; border: string; text: string } {
  const t = title.toLowerCase();
  if (t.includes('бро') || t.includes('number') || t.includes('множества'))
    return { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-white' };
  if (t.includes('операц') || t.includes('пресметувања') || t.includes('арит'))
    return { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' };
  if (t.includes('геом') || t.includes('триаголн') || t.includes('мерк') || t.includes('агол'))
    return { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' };
  if (t.includes('мерење') || t.includes('мер') || t.includes('плоштина') || t.includes('обем'))
    return { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' };
  if (t.includes('алгебра') || t.includes('равенка') || t.includes('функц'))
    return { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-white' };
  if (t.includes('статист') || t.includes('податоци') || t.includes('веројатн') || t.includes('data'))
    return { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-white' };
  if (t.includes('рационал') || t.includes('дропки') || t.includes('децимал'))
    return { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-white' };
  return { bg: 'bg-gray-500', border: 'border-gray-600', text: 'text-white' };
}

interface TopicWithWeeks extends AIGeneratedAnnualPlanTopic {
  startWeek: number; // 0-indexed
  endWeek: number;   // exclusive
}

function computeWeeks(topics: AIGeneratedAnnualPlanTopic[]): TopicWithWeeks[] {
  let cursor = 0;
  return topics.map(t => {
    // Push past winter break if we'd overlap it
    if (cursor < WINTER_START && cursor + t.durationWeeks > WINTER_START) {
      cursor = WINTER_START + WINTER_WEEKS;
    } else if (cursor >= WINTER_START && cursor < WINTER_START + WINTER_WEEKS) {
      cursor = WINTER_START + WINTER_WEEKS;
    }
    const start = cursor;
    cursor += t.durationWeeks;
    return { ...t, startWeek: start, endWeek: cursor };
  });
}

interface Props {
  topics: AIGeneratedAnnualPlanTopic[];
  onTopicClick: (topic: AIGeneratedAnnualPlanTopic) => void;
}

export const PlanGanttChart: React.FC<Props> = ({ topics, onTopicClick }) => {
  const [tooltip, setTooltip] = useState<{ topic: TopicWithWeeks; x: number; y: number } | null>(null);

  const withWeeks = computeWeeks(topics);
  const pct = (w: number) => `${(w / TOTAL_WEEKS) * 100}%`;

  return (
    <div className="w-full select-none">
      {/* Month header row */}
      <div className="relative h-6 mb-1">
        {MONTH_LABELS.map(m => (
          <span
            key={m.label}
            className="absolute text-[10px] font-bold text-gray-400 uppercase"
            style={{ left: pct(m.week), transform: 'translateX(-50%)' }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Timeline bar */}
      <div className="relative h-14 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
        {/* Week grid lines */}
        {Array.from({ length: TOTAL_WEEKS + 1 }, (_, w) => (
          <div
            key={w}
            className="absolute top-0 bottom-0 border-l border-gray-200/60"
            style={{ left: pct(w) }}
          />
        ))}

        {/* Winter break stripe */}
        <div
          className="absolute top-0 bottom-0 bg-gray-300/70 flex items-center justify-center z-10"
          style={{ left: pct(WINTER_START), width: pct(WINTER_WEEKS) }}
        >
          <span className="text-[8px] font-bold text-gray-500 rotate-0 whitespace-nowrap overflow-hidden">
            ❄️
          </span>
        </div>

        {/* Topic blocks */}
        {withWeeks.map((t, i) => {
          const c = themeColor(t.title);
          const widthPct = (t.durationWeeks / TOTAL_WEEKS) * 100;
          return (
            <div
              key={i}
              className={`absolute top-1 bottom-1 rounded-lg cursor-pointer border-2 flex items-center px-2 transition-all duration-150 hover:brightness-110 hover:shadow-md z-20 ${c.bg} ${c.border}`}
              style={{ left: pct(t.startWeek), width: `calc(${pct(t.durationWeeks)} - 2px)` }}
              onClick={() => onTopicClick(t)}
              onMouseEnter={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTooltip({ topic: t, x: rect.left + rect.width / 2, y: rect.top - 8 });
              }}
              onMouseLeave={() => setTooltip(null)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onTopicClick(t)}
              aria-label={`${t.title} — ${t.durationWeeks} недели`}
            >
              {widthPct > 8 && (
                <span className={`text-[10px] font-bold truncate ${c.text}`}>
                  {t.title}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {withWeeks.map((t, i) => {
          const c = themeColor(t.title);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onTopicClick(t)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.border} ${c.text} hover:brightness-110 transition-all`}
            >
              <span>{t.title}</span>
              <span className="opacity-75">· {t.durationWeeks}нед</span>
            </button>
          );
        })}
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-500 border border-gray-300">
          ❄️ Зимски распуст
        </span>
      </div>

      {/* Floating tooltip (portal-less, absolute to viewport via fixed) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <p className="font-bold">{tooltip.topic.title}</p>
          <p className="opacity-75">
            Нед. {tooltip.topic.startWeek + 1}–{tooltip.topic.endWeek} · {tooltip.topic.durationWeeks} недели
          </p>
          {tooltip.topic.objectives[0] && (
            <p className="mt-1 opacity-60 text-[10px] line-clamp-2">{tooltip.topic.objectives[0]}</p>
          )}
          <p className="mt-1 text-[10px] opacity-50 italic">Кликни за тематски план →</p>
        </div>
      )}
    </div>
  );
};
