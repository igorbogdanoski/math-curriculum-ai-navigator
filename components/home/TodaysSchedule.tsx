import React from 'react';
import { ICONS } from '../../constants';
import { PlannerItem, PlannerItemType, ModalType } from '../../types';
import { useModal } from '../../contexts/ModalContext';

interface TodaysFocusItemsProps {
  items: PlannerItem[];
}

export const TodaysFocusItems: React.FC<TodaysFocusItemsProps> = ({ items }) => {
    const { showModal } = useModal();
    const today = new Date();
    today.setHours(0,0,0,0);

    const handleOpenReflectionModal = (item: PlannerItem) => {
        showModal(ModalType.LessonReflection, { item });
    };

    const handleItemClick = (item: PlannerItem) => {
        if (item.type === PlannerItemType.LESSON && item.lessonPlanId) {
            showModal(ModalType.LessonQuickView, { lessonPlanId: item.lessonPlanId });
        } else {
            showModal(ModalType.PlannerItem, { item });
        }
    };

    return (
        <div className="flex-1 overflow-y-auto pr-2">
            <ul className="space-y-3">
                {items.map(item => {
                    const Icon = item.type === PlannerItemType.LESSON ? ICONS.bookOpen : item.type === PlannerItemType.EVENT ? ICONS.lightbulb : ICONS.star;
                    const itemDate = new Date(item.date);
                    itemDate.setHours(0,0,0,0);
                    const isPast = itemDate < today;
                    const canReflect = item.type === PlannerItemType.LESSON && isPast;

                    return (
                        <li key={item.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleItemClick(item)}>
                                <Icon className="w-5 h-5 text-brand-secondary flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-gray-800">{item.title}</p>
                                    {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {item.lessonPlanId && (
                                    <button onClick={() => handleItemClick(item)} className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded-full">Види подготовка</button>
                                )}
                                {canReflect && (
                                    <button onClick={() => handleOpenReflectionModal(item)} className={`text-xs font-semibold px-3 py-1 rounded-full ${item.reflection ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}`}>
                                        {item.reflection ? 'Види рефлексија' : 'Додади рефлексија'}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};