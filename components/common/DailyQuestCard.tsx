import React from 'react';
import { Flame, CheckCircle2 } from 'lucide-react';
import type { DailyQuest } from '../../utils/dailyQuests';
import { QUEST_META } from '../../utils/dailyQuests';

interface Props {
  quests: DailyQuest[];
  /** Called when the student clicks "Вежбај" on a quest */
  onPlayQuest?: (conceptId: string) => void;
}

export const DailyQuestCard: React.FC<Props> = ({ quests, onPlayQuest }) => {
  if (quests.length === 0) return null;

  const completedCount = quests.filter(q => q.completed).length;
  const allDone = completedCount === quests.length;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-orange-800 text-sm">Дневни Предизвици</span>
        </div>
        <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
          {completedCount}/{quests.length} завршени
        </span>
      </div>

      {/* All done banner */}
      {allDone && (
        <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm font-semibold text-green-700">Одлично! Ги заврши сите предизвици за денес!</span>
        </div>
      )}

      {/* Quest list */}
      <div className="space-y-2">
        {quests.map(q => {
          const meta = QUEST_META[q.difficulty];
          return (
            <div
              key={q.conceptId}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                q.completed
                  ? 'bg-white/60 border-gray-200 opacity-60'
                  : 'bg-white border-orange-200 shadow-sm'
              }`}
            >
              {/* Difficulty icon */}
              <span className="text-lg shrink-0">{meta.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{meta.label}</p>
                <p className="text-sm font-medium text-gray-800 truncate">{q.conceptTitle}</p>
              </div>

              {/* Action */}
              {q.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                onPlayQuest && (
                  <button
                    type="button"
                    onClick={() => onPlayQuest(q.conceptId)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition shrink-0"
                  >
                    Вежбај
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
