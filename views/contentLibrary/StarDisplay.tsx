import React from 'react';
import { Star } from 'lucide-react';

export const StarDisplay: React.FC<{ avg: number | null; count: number }> = ({ avg, count }) => {
    if (avg === null) return <span className="text-xs text-gray-400 italic">Без оценки</span>;
    return (
        <span className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`w-3 h-3 ${s <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
            ))}
            <span className="text-xs text-gray-500 ml-0.5">{avg.toFixed(1)} ({count})</span>
        </span>
    );
};
