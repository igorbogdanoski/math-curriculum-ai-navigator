import React from 'react';

export function PollResultsBar({ options, tally, correctIndex }: { options: string[]; tally: Record<string, number>; correctIndex?: number | null }) {
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  return (
    <div className="mt-2 space-y-1.5 text-left">
      {options.map((opt, i) => {
        const count = tally[opt] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isCorrect = correctIndex === i;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-[10px] text-slate-300 mb-0.5">
              <span className="truncate pr-2">
                {isCorrect && <span className="text-emerald-400 mr-1">✓</span>}
                {String.fromCharCode(65 + i)}. {opt}
              </span>
              <span className="font-bold text-white shrink-0">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full transition-all duration-500 ${isCorrect ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
