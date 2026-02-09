import React, { useMemo } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { PlannerItem, PlannerItemType, ModalType } from '../../types';
import { useModal } from '../../contexts/ModalContext';
import { usePlanner } from '../../contexts/PlannerContext';
import { useNavigation } from '../../contexts/NavigationContext';

const AgendaItem: React.FC<{ item: PlannerItem; onClick: () => void; }> = ({ item, onClick }) => {
    const Icon = item.type === PlannerItemType.LESSON ? ICONS.bookOpen : item.type === PlannerItemType.EVENT ? ICONS.lightbulb : ICONS.star;
    return (
        <div onClick={onClick} className="p-2.5 rounded-lg bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer flex items-start gap-3 transition-all border border-transparent hover:border-gray-100 group">
            <div className="mt-0.5 text-gray-500 group-hover:text-brand-secondary bg-white p-1.5 rounded-full shadow-sm group-hover:shadow transition-all">
                 <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-gray-800 truncate group-hover:text-brand-primary transition-colors">{item.title}</p>
                {item.description && <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>}
            </div>
        </div>
    );
}

export const WeeklySchedule: React.FC = () => {
    const { items } = usePlanner();
    const { showModal } = useModal();
    const { navigate } = useNavigation();

    const schedule = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const nextSevenDays: { date: Date, items: PlannerItem[] }[] = [];

        for(let i = 0; i < 7; i++) {
            const day = new Date(today);
            day.setDate(today.getDate() + i);
            const dateStr = day.toISOString().split('T')[0];
            nextSevenDays.push({
                date: day,
                items: items.filter(item => item.date === dateStr)
            });
        }
        return nextSevenDays;
    }, [items]);

    const handleItemClick = (item: PlannerItem) => {
        if (item.type === PlannerItemType.LESSON && item.lessonPlanId) {
            showModal(ModalType.LessonQuickView, { lessonPlanId: item.lessonPlanId });
        } else {
            showModal(ModalType.PlannerItem, { item });
        }
    };

    return (
        <Card className="h-full flex flex-col max-h-[600px] overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                     <div className="p-1.5 bg-green-100 rounded-lg">
                        <ICONS.planner className="w-5 h-5 text-green-700" />
                     </div>
                     <h2 className="text-lg font-bold text-gray-800">Агенда</h2>
                </div>
                <button onClick={() => navigate('/planner')} className="text-xs font-bold text-brand-secondary hover:bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                    Види сè
                </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-5 custom-scrollbar">
                {schedule.map(({ date, items }, idx) => {
                    const isToday = idx === 0;
                    const hasItems = items.length > 0;

                    if (!hasItems && !isToday) return null; // Skip empty days unless it's today

                    return (
                        <div key={date.toISOString()} className={isToday ? "bg-blue-50/50 -mx-2 p-3 rounded-xl border border-blue-100/50" : ""}>
                            <h3 className={`font-bold text-xs mb-3 flex items-center uppercase tracking-wider ${isToday ? 'text-brand-primary' : 'text-gray-400'}`}>
                                {isToday && <span className="w-2 h-2 bg-brand-primary rounded-full mr-2 animate-pulse"></span>}
                                {date.toLocaleDateString('mk-MK', { weekday: 'long', day: 'numeric', month: 'short' })}
                            </h3>
                            {hasItems ? (
                                <div className="space-y-2 relative">
                                    {!isToday && <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-gray-100 rounded-full"></div>}
                                    <div className={isToday ? "" : "pl-4"}>
                                        {items.map(item => <AgendaItem key={item.id} item={item} onClick={() => handleItemClick(item)} />)}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic pl-1">Нема закажани активности за денес.</p>
                            )}
                        </div>
                    );
                })}
                <div className="text-center pt-4 pb-2">
                    <p className="text-xs text-gray-400">Крај на приказот за неделава</p>
                </div>
            </div>
        </Card>
    );
}