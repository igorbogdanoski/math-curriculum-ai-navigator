import React from 'react';
import { BloomsLevel } from '../../types';

interface BloomBadgeProps {
  level?: BloomsLevel;
  showLabel?: boolean;
}

const levelColors: Record<BloomsLevel, string> = {
  'Remembering': 'bg-slate-100 text-slate-700 border-slate-200',
  'Understanding': 'bg-blue-100 text-blue-700 border-blue-200',
  'Applying': 'bg-green-100 text-green-700 border-green-200',
  'Analyzing': 'bg-amber-100 text-amber-700 border-amber-200',
  'Evaluating': 'bg-orange-100 text-orange-700 border-orange-200',
  'Creating': 'bg-purple-100 text-purple-700 border-purple-200'
};

const labelsMK: Record<BloomsLevel, string> = {
  'Remembering': 'Помнење',
  'Understanding': 'Разбирање',
  'Applying': 'Примена',
  'Analyzing': 'Анализа',
  'Evaluating': 'Евалуација',
  'Creating': 'Креирање'
};

export const BloomBadge: React.FC<BloomBadgeProps> = ({ level = 'Understanding', showLabel = true }) => {
  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${levelColors[level]}`}
      title={labelsMK[level]}
    >
      <span className="w-2 h-2 rounded-full bg-current mr-1.5 opacity-70"></span>
      {showLabel ? labelsMK[level] : level}
    </span>
  );
};
