import React, { useState } from 'react';
import { ThumbsUp, Pin, CheckCircle2, MessageSquare, Tag, Flag } from 'lucide-react';
import { DokBadge } from '../common/DokBadge';
import { AcademyBadgeRow } from '../academy/AcademyBadgeChip';
import { reportForumThread, type ForumThread } from '../../services/firestoreService.forum';
import { CategoryBadge } from './CategoryBadge';
import { AuthorAvatar } from './AuthorAvatar';
import { isHot, timeAgo } from './forumHelpers';

interface ThreadCardProps {
  thread: ForumThread;
  myUid: string;
  onClick: () => void;
  onUpvote: () => void;
  onDelete: () => void;
}

export const ThreadCard: React.FC<ThreadCardProps> = ({ thread, myUid, onClick, onUpvote, onDelete }) => {
  const hasUpvoted = thread.upvotedBy.includes(myUid);
  const trending = isHot(thread);
  const totalReactions = thread.reactionsHelpful.length + thread.reactionsSame.length + thread.reactionsGreat.length;
  const alreadyReported = (thread.reportedBy ?? []).includes(myUid);
  const [reporting, setReporting] = useState(false);

  const handleReport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (alreadyReported || reporting) return;
    setReporting(true);
    try { await reportForumThread(thread.id, myUid); } finally { setReporting(false); }
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${thread.isPinned ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}
      onClick={onClick}
    >
      <div className="flex gap-3 p-4">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUpvote(); }}
            className={`p-1.5 rounded-lg transition-colors ${hasUpvoted ? 'bg-indigo-100 text-indigo-600' : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
            title={hasUpvoted ? 'Отстрани глас' : 'Гласај'}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <span className={`text-xs font-black ${thread.upvotedBy.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
            {thread.upvotedBy.length}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {thread.isPinned && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <Pin className="w-2.5 h-2.5" /> Прикачено
              </span>
            )}
            <CategoryBadge category={thread.category} />
            {trending && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">
                🔥 Топло
              </span>
            )}
            {thread.hasBestAnswer && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-2.5 h-2.5" /> Решено
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug group-hover:text-indigo-700 transition-colors">
              {thread.title}
            </h3>
            {thread.replyCount > 0 && (
              <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                <MessageSquare className="w-2.5 h-2.5" />{thread.replyCount}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5 leading-relaxed">{thread.body}</p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <AuthorAvatar name={thread.authorName} />
            <span className="text-[10px] text-gray-600 font-medium">{thread.authorName}</span>
            <AcademyBadgeRow uid={thread.authorUid} />
            {thread.conceptTitle && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                <Tag className="w-2.5 h-2.5" />{thread.conceptTitle}
              </span>
            )}
            {thread.dokLevel && <DokBadge level={thread.dokLevel} size="compact" />}
            <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(thread.lastActivityAt ?? thread.createdAt)}</span>
            {totalReactions > 0 && (
              <span className="text-[10px] text-gray-400">{totalReactions} реакции</span>
            )}
            {thread.authorUid === myUid && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="text-[10px] text-red-400 hover:text-red-600 transition"
              >
                Избриши
              </button>
            )}
            {thread.authorUid !== myUid && (
              <button
                type="button"
                onClick={handleReport}
                disabled={alreadyReported || reporting}
                title={alreadyReported ? 'Веќе пријавено' : 'Пријави ја нишката за модерирање'}
                className={`flex items-center gap-0.5 text-[10px] transition ${alreadyReported ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
              >
                <Flag className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
