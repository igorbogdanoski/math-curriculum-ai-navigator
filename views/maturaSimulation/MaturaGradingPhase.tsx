import React from 'react';
import { Sparkles } from 'lucide-react';

interface MaturaGradingPhaseProps {
    done: number;
    total: number;
}

export function MaturaGradingPhase({ done, total }: MaturaGradingPhaseProps) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl animate-pulse">
                <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-black text-gray-800">AI оценување во тек…</h2>
                <p className="text-sm text-gray-500">
                    {total === 0
                        ? 'Оценување на дел I…'
                        : `Дел II + III: ${done} / ${total} прашања`}
                </p>
            </div>
            <div className="w-full max-w-xs">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <progress
                        className="w-full h-full accent-indigo-600"
                        max={100}
                        value={total > 0 ? pct : 30}
                    />
                </div>
                {total > 0 && (
                    <p className="text-center text-xs font-bold text-indigo-600 mt-2">{pct}%</p>
                )}
            </div>
            <p className="text-xs text-gray-400 max-w-xs text-center">
                Прашањата со ист одговор се вчитуваат од кеш — нема дополнителни AI повици.
            </p>
        </div>
    );
}
