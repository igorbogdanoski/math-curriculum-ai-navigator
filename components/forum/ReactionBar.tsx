import React from 'react';
import { REACTIONS, type ForumThread, type ForumReply, type ReactionField } from '../../services/firestoreService.forum';
import { reactionArr } from './forumHelpers';

interface ReactionBarProps {
  reactions: Pick<ForumThread | ForumReply, 'reactionsHelpful'> & {
    reactionsSame?: string[];
    reactionsGreat?: string[];
  };
  myUid: string;
  onReact: (field: ReactionField) => void;
  compact?: boolean;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, myUid, onReact }) => (
  <div className="flex items-center gap-1 flex-wrap">
    {REACTIONS.map(({ field, emoji, label }) => {
      const arr = reactionArr(reactions as ForumThread | ForumReply, field);
      const hasReacted = arr.includes(myUid);
      return (
        <button
          key={field}
          type="button"
          onClick={() => onReact(field)}
          title={label}
          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
            hasReacted
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
          }`}
        >
          <span>{emoji}</span>
          {arr.length > 0 && <span className="tabular-nums">{arr.length}</span>}
        </button>
      );
    })}
  </div>
);
