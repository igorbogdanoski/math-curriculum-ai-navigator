import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ICONS } from '../../constants';

interface DroppableDayCellProps {
  dateStr: string;
  children: [React.ReactNode, React.ReactNode];
  onAdd: () => void;
}

export const DroppableDayCell: React.FC<DroppableDayCellProps> = ({ dateStr, children, onAdd }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: dateStr,
  });

  const style = {
    backgroundColor: isOver ? 'rgba(66, 165, 245, 0.2)' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-md p-1 min-h-[120px] bg-white group relative flex flex-col transition-colors hover:bg-gray-50"
    >
        {children[0]} {/* Renders the day number and add button */}
        <div className="flex-1" onClick={onAdd}>
             {children[1]} {/* Renders the planner items */}
        </div>
    </div>
  );
};