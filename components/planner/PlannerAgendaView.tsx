import React from 'react';
import type { PlannerItem } from '../../types';
import { PlannerItemType } from '../../types';
import { ICONS } from '../../constants';
import { getDaysInWeek } from '../../utils/date';

interface PlannerAgendaViewProps {
    currentDate: Date;
    items: PlannerItem[];
    onItemClick: (item: PlannerItem) => void;
    onOpenModal: (item: Partial<PlannerItem> | null) => void;
}

const AgendaItem: React.FC<{ item: PlannerItem; onClick: () => void; }> = ({ item, onClick }) => {
    const isNote = item.type === PlannerItemType.EVENT;
    
    const itemIcons: Record<PlannerItemType, React.ComponentType<{ className?: string }>> = {
        [PlannerItemType.LESSON]: ICONS.bookOpen,
        [PlannerItemType.EVENT]: ICONS.edit,
        [PlannerItemType.HOLIDAY]: ICONS.star,
    };
    const Icon = itemIcons[item.type];

    return (
        <div 
            onClick={onClick} 
            className={`p-4 rounded-xl shadow-sm border transition-all duration-200 cursor-pointer flex items-start justify-between group ${
                isNote 
                ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300 hover:shadow-md' 
                : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-card-hover'
            }`}
        >
            <div className="flex items-start gap-4 w-full">
                <div className={`p-2 rounded-full flex-shrink-0 ${isNote ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-50 text-brand-secondary'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm mb-1 ${isNote ? 'text-yellow-900' : 'text-brand-primary'}`}>{item.title}</span>
                        {isNote && <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">Белешка</span>}
                    </div>
                    
                    {item.description && (
                        <p className={`text-xs leading-relaxed ${isNote ? 'text-yellow-900 font-medium italic line-clamp-4' : 'text-gray-600 line-clamp-2'}`}>
                            {item.description}
                        </p>
                    )}
                </div>
            </div>
            <ICONS.chevronRight className={`w-5 h-5 transition-colors self-center ${isNote ? 'text-yellow-400 group-hover:text-yellow-600' : 'text-gray-300 group-hover:text-brand-primary'}`} />
        </div>
    );
};

const isToday = (someDate: Date) => {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
           someDate.getMonth() === today.getMonth() &&
           someDate.getFullYear() === today.getFullYear();
};


export const PlannerAgendaView: React.FC<PlannerAgendaViewProps> = ({ currentDate, items, onItemClick, onOpenModal }) => {
    const weekDays = getDaysInWeek(currentDate);
    const dayNames = ['Недела', 'Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота'];

    return (
        <div className="relative pl-6">
             {/* Timeline */}
            <div className="absolute top-0 left-8 w-0.5 h-full bg-gray-200"></div>
            {weekDays.map((day, index) => {
                const dateStr = day.toISOString().split('T')[0];
                const itemsForDay = items.filter(item => item.date === dateStr);
                const isCurrentDayToday = isToday(day);

                return (
                    <div key={dateStr} className="relative mb-8">
                        <div className={`absolute -left-2 top-1 w-5 h-5 rounded-full z-10 ${isCurrentDayToday ? 'bg-brand-primary ring-4 ring-blue-100' : 'bg-gray-300 border-4 border-white'}`}></div>
                        <div className="ml-8">
                             <div className="flex justify-between items-center mb-3">
                                 <div>
                                    <h3 className={`text-lg font-bold ${isCurrentDayToday ? 'text-brand-primary' : 'text-gray-700'}`}>
                                        {dayNames[day.getDay()]}
                                    </h3>
                                    <p className="text-sm text-gray-500">{day.toLocaleDateString('mk-MK', {day: 'numeric', month: 'long'})}</p>
                                 </div>
                                 <button 
                                    onClick={() => onOpenModal({ date: dateStr })}
                                    className="flex items-center text-sm bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-full transition-colors shadow-sm"
                                 >
                                    <ICONS.plus className="w-4 h-4 mr-1"/> Додади
                                 </button>
                            </div>
                            
                            {itemsForDay.length > 0 ? (
                                <div className="space-y-3">
                                    {itemsForDay.map(item => (
                                        <AgendaItem key={item.id} item={item} onClick={() => onItemClick(item)} />
                                    ))}
                                </div>
                            ) : (
                                isCurrentDayToday && <p className="text-sm text-gray-400 italic py-2">Нема закажани активности за денес.</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};