import React, { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { PlannerItem } from '../../types';
import { PlannerItemType } from '../../types';
import { ICONS } from '../../constants';

interface DraggablePlannerItemProps {
  item: PlannerItem;
  onSelect: () => void;
  hasReflection?: boolean;
  onAddReflection?: () => void;
}

const itemIcons: Record<PlannerItemType, React.ComponentType<{ className?: string }>> = {
    [PlannerItemType.LESSON]: ICONS.bookOpen,
    [PlannerItemType.EVENT]: ICONS.edit, // Changed icon for notes/events
    [PlannerItemType.HOLIDAY]: ICONS.star,
};

export const DraggablePlannerItem: React.FC<DraggablePlannerItemProps> = memo(({ item, onSelect, hasReflection, onAddReflection }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  const isNote = item.type === PlannerItemType.EVENT;

  // Distinct styles for Notes vs Lessons
  // Note style is now yellow and looks like a sticky note
  const baseClasses = 'text-xs p-2 rounded mb-1.5 flex flex-col justify-between transition-all duration-200 ease-in-out group/item relative';
  
  const typeClasses = {
    [PlannerItemType.LESSON]: 'bg-blue-50 text-blue-900 border-l-4 border-blue-500 hover:bg-blue-100',
    [PlannerItemType.EVENT]: 'bg-yellow-100 text-yellow-900 border border-yellow-200 shadow-sm hover:shadow-md rotate-1 transform hover:rotate-0', // Sticky note effect
    [PlannerItemType.HOLIDAY]: 'bg-green-50 text-green-900 border-l-4 border-green-500 hover:bg-green-100',
  };
  
  const draggingClasses = isDragging ? 'shadow-lg ring-2 ring-brand-accent scale-105' : '';
  
  const handleReflectionClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddReflection?.();
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  }

  const reflectionClasses = hasReflection
    ? 'text-brand-primary opacity-100'
    : 'text-gray-400 opacity-0 group-hover/item:opacity-100';

  const Icon = itemIcons[item.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${typeClasses[item.type]} ${draggingClasses}`}
      onClick={handleSelectClick}
      title={item.description || item.title}
    >
      <div className="flex items-start gap-1.5 w-full mb-1">
        {!isNote && <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-600`} />}
        {isNote && <ICONS.edit className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-700" />}
        
        <div className="flex-1 overflow-hidden">
            <span className={`font-bold block truncate leading-tight ${isNote ? 'text-yellow-900' : ''}`}>{item.title}</span>
            
            {/* For notes (Events), show the description directly on the card */}
            {isNote && item.description && (
                <p className="text-[10px] leading-snug text-yellow-800 mt-1 line-clamp-3 font-sans italic">
                    {item.description}
                </p>
            )}
        </div>
      </div>

      {onAddReflection && (
         <div className="flex justify-end mt-0.5">
             <button 
                onClick={handleReflectionClick} 
                className={`p-0.5 rounded-full hover:bg-white/50 transition-all ${reflectionClasses}`}
                aria-label={hasReflection ? 'Види рефлексија' : 'Додади рефлексија'}
                title="Рефлексија"
            >
                 <ICONS.chatBubble className="w-3.5 h-3.5" />
            </button>
         </div>
      )}
    </div>
  );
});