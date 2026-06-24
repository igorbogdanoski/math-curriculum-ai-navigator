import React, { useMemo } from 'react';
import type { PlannerItem } from '../../types';
import { PlannerItemType } from '../../types';
import { Plus, BookOpen, Star, CalendarDays, FileText } from 'lucide-react';
import { CurriculumPaceBanner } from './CurriculumPaceBanner';

interface Props {
  currentDate: Date;
  items: PlannerItem[];
  onItemClick: (item: PlannerItem) => void;
  onOpenModal: (item: Partial<PlannerItem> | null) => void;
}

const MK_DAYS_SHORT = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед'];

function getMonWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    return nd;
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

const typeConfig: Record<PlannerItemType, { icon: React.ElementType; bg: string; text: string; dot: string }> = {
  [PlannerItemType.LESSON]: { icon: BookOpen, bg: 'bg-blue-50 border-blue-100', text: 'text-blue-700', dot: 'bg-blue-400' },
  [PlannerItemType.EVENT]: { icon: FileText, bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  [PlannerItemType.HOLIDAY]: { icon: Star, bg: 'bg-red-50 border-red-100', text: 'text-red-700', dot: 'bg-red-400' },
};

export const PlannerWeekView: React.FC<Props> = ({ currentDate, items, onItemClick, onOpenModal }) => {
  const weekDays = useMemo(() => getMonWeekDays(currentDate), [currentDate]);

  const byDay = useMemo(() => {
    const map: Record<string, PlannerItem[]> = {};
    for (const d of weekDays) map[toDateStr(d)] = [];
    for (const item of items) {
      const key = item.date?.slice(0, 10);
      if (key && map[key]) map[key].push(item);
    }
    return map;
  }, [items, weekDays]);

  const weekStats = useMemo(() => {
    const lessons = items.filter(i => i.type === PlannerItemType.LESSON).length;
    const events = items.filter(i => i.type === PlannerItemType.EVENT).length;
    return { lessons, events };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Official curriculum pace banner */}
      <CurriculumPaceBanner currentDate={currentDate} />

      {/* Week summary bar */}
      <div className="flex items-center gap-4 px-1 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
        <CalendarDays className="w-4 h-4 text-indigo-500 ml-2 flex-shrink-0" />
        <span className="text-xs font-bold text-indigo-700">Оваа недела:</span>
        <span className="text-xs font-semibold text-indigo-600">{weekStats.lessons} {weekStats.lessons === 1 ? 'час' : 'часа'}</span>
        {weekStats.events > 0 && (
          <span className="text-xs font-semibold text-amber-600">· {weekStats.events} {weekStats.events === 1 ? 'настан' : 'настани'}</span>
        )}
      </div>

      {/* 7-column week grid */}
      <div className="grid grid-cols-7 gap-1.5 min-w-[560px] overflow-x-auto">
        {weekDays.map((day, idx) => {
          const key = toDateStr(day);
          const dayItems = byDay[key] ?? [];
          const today = isToday(day);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={key}
              className={`rounded-xl border min-h-[120px] flex flex-col transition-all ${
                today
                  ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-200'
                  : isPast
                  ? 'bg-gray-50 border-gray-100 opacity-70'
                  : 'bg-white border-gray-100 hover:border-indigo-200'
              }`}
            >
              {/* Day header */}
              <div className={`px-2 pt-2 pb-1 flex items-center justify-between ${today ? 'text-white' : 'text-gray-500'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wide">{MK_DAYS_SHORT[idx]}</span>
                <span className={`text-sm font-black ${today ? 'bg-white text-indigo-700 w-6 h-6 flex items-center justify-center rounded-full' : ''}`}>
                  {day.getDate()}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 px-1 pb-1 space-y-0.5 overflow-hidden">
                {dayItems.slice(0, 4).map(item => {
                  const cfg = typeConfig[item.type] ?? typeConfig[PlannerItemType.LESSON];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onItemClick(item)}
                      title={item.title}
                      className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate flex items-center gap-1 border transition-colors ${
                        today ? 'bg-white/20 text-white border-white/20 hover:bg-white/30' : `${cfg.bg} ${cfg.text}`
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${today ? 'bg-white' : cfg.dot}`} />
                      {item.title}
                    </button>
                  );
                })}
                {dayItems.length > 4 && (
                  <p className={`text-[9px] px-1.5 font-bold ${today ? 'text-white/70' : 'text-gray-400'}`}>
                    +{dayItems.length - 4} повеќе
                  </p>
                )}
              </div>

              {/* Add button */}
              <button
                type="button"
                onClick={() => onOpenModal({ date: key, type: PlannerItemType.LESSON })}
                title="Додади настан"
                className={`w-full flex items-center justify-center py-1 rounded-b-xl text-[10px] font-bold transition-colors ${
                  today
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'
                }`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
