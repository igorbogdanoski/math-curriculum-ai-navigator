import React from 'react';
import { CATEGORY_CONFIG, type ThreadCategory } from '../../services/firestoreService.forum';

export const CategoryBadge: React.FC<{ category: ThreadCategory; size?: 'sm' | 'xs' }> = ({ category, size = 'xs' }) => {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.question;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold border ${cfg.color} ${cfg.border} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      <span>{cfg.emoji}</span> {cfg.label}
    </span>
  );
};
