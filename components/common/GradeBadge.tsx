import React from 'react';
import { pctToGrade } from '../../utils/grading';

interface GradeBadgeProps {
  pct: number;
  showLabel?: boolean; // true → "5 Одличен", false → само "5"
  className?: string;
}

export const GradeBadge: React.FC<GradeBadgeProps> = ({ pct, showLabel = false, className = '' }) => {
  const { grade, label, bgClass, textClass } = pctToGrade(pct);
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded px-1.5 py-0.5 text-xs ${bgClass} ${textClass} ${className}`}>
      {grade}{showLabel ? ` ${label}` : ''}
    </span>
  );
};
