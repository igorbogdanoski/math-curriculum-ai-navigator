/**
 * TeacherForumView — Ж7.2 (upgraded Сесија 10)
 *
 * Наставнички форум — Q&A нишки по концепти.
 * World-class: категории, hot sort, реакции, pinned нишки, stats banner.
 *
 * Педагошка основа: Wenger Communities of Practice,
 * Social Constructivism (Vygotsky), Peer Learning
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { markForumVisited } from '../hooks/useForumUnreadCount';
import {
  MessageSquare, Plus, ThumbsUp, Award, ChevronLeft,
  Send, Loader2, Search, Tag, X, CheckCircle2, Pin,
  TrendingUp, Clock, Sparkles, Users, Box,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import type { Concept } from '../types';
import { DokBadge } from '../components/common/DokBadge';
import { DOK_META } from '../types';
import type { DokLevel } from '../types';
import { uploadForumImage } from '../services/storageService';

const Shape3DViewer = React.lazy(() =>
  import('../components/math/Shape3DViewer').then(m => ({ default: m.Shape3DViewer }))
);
import { SHAPE_ORDER } from '../components/math/Shape3DViewer';
import type { Shape3DType } from '../components/math/Shape3DViewer';

type EnrichedConcept = Concept & { gradeLevel: number; topicId: string };
type SortMode = 'new' | 'hot' | 'active';

type FormEv = React.FormEvent<HTMLFormElement>;
import {
  fetchForumThread,
  subscribeForumReplies,
  subscribeForumThreads,
  createForumThread,
  createForumReply,
  toggleThreadUpvote,
  toggleReplyUpvote,
  toggleForumReaction,
  markBestAnswer,
  softDeleteThread,
  pinThread,
  hotScore,
  CATEGORY_CONFIG,
  REACTIONS,
  type ThreadCategory,
  type ForumThread,
  type ForumReply,
  type ForumStats,
  type ReactionField,
} from '../services/firestoreService.forum';
import { callGeminiProxy, DEFAULT_MODEL } from '../services/gemini/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Type-safe accessor for dynamic reaction fields on threads and replies. */
function reactionArr(obj: ForumThread | ForumReply, field: ReactionField): string[] {
  return (obj[field as keyof (ForumThread | ForumReply)] as string[] | undefined) ?? [];
}

function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

function timeAgo(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'току што';
    if (mins < 60) return `пред ${mins} мин`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `пред ${hrs} ч`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `пред ${days} д`;
    const weeks = Math.floor(days / 7);
    return `пред ${weeks} нед`;
  } catch { return ''; }
}

function isHot(thread: ForumThread): boolean {
  if (!thread.createdAt) return false;
  const ageHours = (Date.now() - thread.createdAt.toDate().getTime()) / 3_600_000;
  return ageHours < 72 && (thread.upvotedBy.length + thread.replyCount) >= 3;
}

// ── Category badge ─────────────────────────────────────────────────────────

const CategoryBadge: React.FC<{ category: ThreadCategory; size?: 'sm' | 'xs' }> = ({ category, size = 'xs' }) => {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.question;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold border ${cfg.color} ${cfg.border} ${size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
      <span>{cfg.emoji}</span> {cfg.label}
    </span>
  );
};

// ── Author avatar ─────────────────────────────────────────────────────────────

const AuthorAvatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'sm' }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials || '?'}
    </div>
  );
};

// ── Reaction bar ──────────────────────────────────────────────────────────────

interface ReactionBarProps {
  reactions: Pick<ForumThread | ForumReply, 'reactionsHelpful'> & {
    reactionsSame?: string[];
    reactionsGreat?: string[];
  };
  myUid: string;
  onReact: (field: ReactionField) => void;
  compact?: boolean;
}

const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, myUid, onReact, compact }) => (
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
          {!compact && arr.length > 0 && <span className="tabular-nums">{arr.length}</span>}
          {compact && arr.length > 0 && <span className="tabular-nums">{arr.length}</span>}
        </button>
      );
    })}
  </div>
);

// ── Stats Banner ──────────────────────────────────────────────────────────────

const StatsBanner: React.FC<{ stats: ForumStats }> = ({ stats }) => (
  <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl">
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
        <MessageSquare className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <div className="font-black text-indigo-700 text-base leading-none">
          {stats.totalThreads}
        </div>
        <div className="text-[10px] text-gray-500 font-medium">вкупно нишки</div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
      </div>
      <div>
        <div className="font-black text-emerald-700 text-base leading-none">
          {stats.activeThisWeek}
        </div>
        <div className="text-[10px] text-gray-500 font-medium">нови оваа недела</div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
        <Users className="w-4 h-4 text-violet-600" />
      </div>
      <div>
        <div className="font-black text-violet-700 text-base leading-none">CoP</div>
        <div className="text-[10px] text-gray-500 font-medium">Community of Practice</div>
      </div>
    </div>
  </div>
);

// ── New Thread Modal ──────────────────────────────────────────────────────────

interface NewThreadModalProps {
  onClose: () => void;
  onCreated: (thread: ForumThread) => void;
  concepts: EnrichedConcept[];
  authorUid: string;
  authorName: string;
  initialImageDataUrl?: string | null;
}

const NewThreadModal: React.FC<NewThreadModalProps> = ({ onClose, onCreated, concepts, authorUid, authorName, initialImageDataUrl }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [category, setCategory] = useState<ThreadCategory>('question');
  const [saving, setSaving] = useState(false);
  const [dokLevel, setDokLevel] = useState<DokLevel | 0>(0);
  const [imageDataUrl] = useState<string | null>(initialImageDataUrl ?? null);
  const [show3d, setShow3d] = useState(false);
  const [shape3dShape, setShape3dShape] = useState<string>('cube');

  const selectedConcept = concepts.find(c => c.id === conceptId);

  const handleSubmit = async (e: FormEv) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      let forumImageUrl: string | null = null;
      if (imageDataUrl) {
        forumImageUrl = await uploadForumImage(imageDataUrl, authorUid);
      }
      const id = await createForumThread({
        authorUid,
        authorName,
        conceptId:    selectedConcept?.id,
        conceptTitle: selectedConcept?.title,
        category,
        title:  title.trim(),
        body:   body.trim(),
        ...(dokLevel ? { dokLevel } : {}),
        ...(forumImageUrl ? { forumImageUrl } : {}),
        ...(show3d ? { shape3dShape } : {}),
      });
      const thread = await fetchForumThread(id);
      if (thread) onCreated(thread);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in-up"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-800 text-lg">Ново прашање / пост</h2>
          <button type="button" aria-label="Затвори" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Category selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Тип на пост *</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_CONFIG) as ThreadCategory[]).map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      category === cat
                        ? `${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span>{cfg.emoji}</span> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Concept anchor */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Поврзи со поим (опционално)</label>
            <select
              title="Избери поим"
              value={conceptId}
              onChange={e => setConceptId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="">— Без поврзан поим —</option>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.gradeLevel}. одд. · {c.title}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Наслов *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Кратко и јасно опишете го прашањето..."
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Содржина *</label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Детално опишете го прашањето, контекстот, она што сте го пробале..."
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            />
          </div>

          {/* DoK level (optional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Webb's DoK ниво (опционално)</label>
            <div className="flex gap-1.5 flex-wrap">
              {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
                const meta = DOK_META[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDokLevel(dokLevel === lvl ? 0 : lvl)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      dokLevel === lvl
                        ? `${meta.color} border-current ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    DoK {lvl} — {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image preview (from Algebra Tiles share) */}
          {imageDataUrl && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Прикачена слика</label>
              <img src={imageDataUrl} alt="Алгебарски плочки" className="rounded-xl border border-gray-200 max-h-40 w-auto" />
            </div>
          )}

          {/* Shape3D toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShow3d(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                show3d
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-700 ring-2 ring-offset-1 ring-cyan-300'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-cyan-300 hover:text-cyan-600'
              }`}
            >
              <Box className="w-3.5 h-3.5" /> Додај 3D тело
            </button>
            {show3d && (
              <div className="mt-2">
                <select
                  title="Избери 3D тело"
                  value={shape3dShape}
                  onChange={e => setShape3dShape(e.target.value)}
                  className="border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                >
                  {SHAPE_ORDER.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Откажи
            </button>
            <button type="submit" disabled={saving || !title.trim() || !body.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Објави
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Thread Card ───────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: ForumThread;
  myUid: string;
  onClick: () => void;
  onUpvote: () => void;
  onDelete: () => void;
}

const ThreadCard: React.FC<ThreadCardProps> = ({ thread, myUid, onClick, onUpvote, onDelete }) => {
  const hasUpvoted = thread.upvotedBy.includes(myUid);
  const trending = isHot(thread);
  const totalReactions = thread.reactionsHelpful.length + thread.reactionsSame.length + thread.reactionsGreat.length;

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group ${thread.isPinned ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}
      onClick={onClick}
    >
      <div className="flex gap-3 p-4">
        {/* Vote column */}
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top meta row */}
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

          {/* Title + reply count */}
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

          {/* Bottom meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <AuthorAvatar name={thread.authorName} />
            <span className="text-[10px] text-gray-600 font-medium">{thread.authorName}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Thread Detail ─────────────────────────────────────────────────────────────

interface ThreadDetailProps {
  thread: ForumThread;
  myUid: string;
  myName: string;
  onBack: () => void;
  onUpvoteThread: () => void;
  onReactThread: (field: ReactionField) => void;
}

const ThreadDetail: React.FC<ThreadDetailProps> = ({ thread, myUid, myName, onBack, onUpvoteThread, onReactThread }) => {
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const replyUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoadingReplies(true);
    replyUnsubRef.current?.();
    replyUnsubRef.current = subscribeForumReplies(thread.id, (updated) => {
      setReplies(updated);
      setLoadingReplies(false);
    });
    return () => { replyUnsubRef.current?.(); };
  }, [thread.id]);

  const handleSendReply = async (e: FormEv) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSendingReply(true);
    try {
      await createForumReply({
        threadId:   thread.id,
        authorUid:  myUid,
        authorName: myName,
        body:       replyBody.trim(),
      });
      setReplyBody('');
      // onSnapshot subscription delivers the new reply automatically
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpvoteReply = async (reply: ForumReply) => {
    const hasUpvoted = reply.upvotedBy.includes(myUid);
    setReplies(prev => prev.map(r => r.id === reply.id
      ? { ...r, upvotedBy: hasUpvoted ? r.upvotedBy.filter(u => u !== myUid) : [...r.upvotedBy, myUid] }
      : r));
    await toggleReplyUpvote(reply.id, myUid, hasUpvoted);
  };

  const handleReactReply = async (reply: ForumReply, field: ReactionField) => {
    const arr = reactionArr(reply, field);
    const hasReacted = arr.includes(myUid);
    setReplies(prev => prev.map(r => r.id === reply.id
      ? { ...r, [field]: hasReacted ? arr.filter((u: string) => u !== myUid) : [...arr, myUid] }
      : r));
    await toggleForumReaction('forum_replies', reply.id, field, myUid, hasReacted);
  };

  const handleMarkBest = async (reply: ForumReply) => {
    if (thread.authorUid !== myUid) return;
    setReplies(prev => prev.map(r => ({ ...r, isBestAnswer: r.id === reply.id ? !r.isBestAnswer : false })));
    await markBestAnswer(reply.id, thread.id);
  };

  const hasUpvotedThread = thread.upvotedBy.includes(myUid);
  const catCfg = CATEGORY_CONFIG[thread.category ?? 'question'];

  return (
    <div className="space-y-4">
      {/* Back */}
      <button type="button" onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition font-medium">
        <ChevronLeft className="w-4 h-4" /> Назад кон форумот
      </button>

      {/* Thread body — border-l colour comes from Tailwind class, not inline style */}
      <div className={`bg-white rounded-xl border-l-4 shadow-sm p-5 ${catCfg.border}`}>
        <div className="flex gap-4">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              type="button"
              aria-label={hasUpvotedThread ? 'Отстрани глас' : 'Гласај за нишката'}
              onClick={onUpvoteThread}
              className={`p-1.5 rounded-lg transition-colors ${hasUpvotedThread ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-600">{thread.upvotedBy.length}</span>
          </div>

          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <CategoryBadge category={thread.category ?? 'question'} size="sm" />
              {thread.isPinned && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5" /> Прикачено
                </span>
              )}
              {thread.hasBestAnswer && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Решено
                </span>
              )}
              {thread.conceptTitle && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                  <Tag className="w-2.5 h-2.5" />{thread.conceptTitle}
                </span>
              )}
              {thread.dokLevel && <DokBadge level={thread.dokLevel} size="compact" />}
            </div>

            <h2 className="text-xl font-black text-gray-900 leading-snug mb-3">{thread.title}</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{thread.body}</p>
            {thread.forumImageUrl && (
              <img
                src={thread.forumImageUrl}
                alt="Прикачена слика"
                className="mt-3 rounded-xl border border-gray-200 max-h-64 w-auto"
              />
            )}
            {thread.shape3dShape && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-cyan-200 bg-slate-800">
                <React.Suspense fallback={<div className="h-48 bg-slate-700 animate-pulse" />}>
                  <Shape3DViewer
                    initialShape={(thread.shape3dShape && SHAPE_ORDER.includes(thread.shape3dShape as Shape3DType) ? thread.shape3dShape as Shape3DType : 'cube')}
                    hideSelector={false}
                    compact={false}
                  />
                </React.Suspense>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              <AuthorAvatar name={thread.authorName} size="md" />
              <div>
                <div className="text-xs font-semibold text-gray-700">{thread.authorName}</div>
                <div className="text-[10px] text-gray-400">{formatDate(thread.createdAt)}</div>
              </div>
              <div className="ml-auto">
                <ReactionBar
                  reactions={thread}
                  myUid={myUid}
                  onReact={onReactThread}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          {replies.length} {replies.length === 1 ? 'одговор' : 'одговори'}
        </h3>

        {loadingReplies ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-3">
            {replies.map(reply => {
              const hasUpvoted = reply.upvotedBy.includes(myUid);
              return (
                <div key={reply.id}
                     className={`bg-white rounded-xl border shadow-sm p-4 ${reply.isBestAnswer ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-200'}`}>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        aria-label={hasUpvoted ? 'Отстрани глас' : 'Гласај за одговорот'}
                        onClick={() => handleUpvoteReply(reply)}
                        className={`p-1 rounded transition-colors ${hasUpvoted ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-gray-500">{reply.upvotedBy.length}</span>
                      {thread.authorUid === myUid && (
                        <button
                          type="button"
                          title={reply.isBestAnswer ? 'Отстрани како најдобар одговор' : 'Означи како најдобар одговор'}
                          onClick={() => handleMarkBest(reply)}
                          className={`p-1 rounded transition-colors mt-1 ${reply.isBestAnswer ? 'text-emerald-600' : 'text-gray-300 hover:text-emerald-500'}`}
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {reply.isBestAnswer && (
                        <div className="flex items-center gap-1 text-xs font-black text-emerald-700 mb-1.5">
                          <Award className="w-3.5 h-3.5" /> Најдобар одговор
                        </div>
                      )}
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{reply.body}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <AuthorAvatar name={reply.authorName} />
                        <div>
                          <div className="text-[11px] font-semibold text-gray-600">{reply.authorName}</div>
                          <div className="text-[10px] text-gray-400">{timeAgo(reply.createdAt)}</div>
                        </div>
                        <div className="ml-auto">
                          <ReactionBar
                            reactions={reply}
                            myUid={myUid}
                            onReact={(field) => handleReactReply(reply, field)}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply box */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Твој одговор</h4>
        <form onSubmit={handleSendReply} className="flex flex-col gap-3">
          <textarea
            rows={4}
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder="Напиши одговор... Биди конкретен и педагошки јасен."
            className="w-full border border-gray-300 rounded-lg text-sm p-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendingReply || !replyBody.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Одговори
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Category tab bar ──────────────────────────────────────────────────────────

const ALL_CATEGORIES: Array<{ id: ThreadCategory | ''; label: string; emoji: string }> = [
  { id: '', label: 'Сите', emoji: '🌐' },
  ...Object.entries(CATEGORY_CONFIG).map(([id, cfg]) => ({
    id: id as ThreadCategory,
    label: cfg.label,
    emoji: cfg.emoji,
  })),
];

// ── Main view ─────────────────────────────────────────────────────────────────

export const TeacherForumView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();
  const { allConcepts } = useCurriculum();

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ForumThread | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterConceptId, setFilterConceptId] = useState('');
  const [filterCategory, setFilterCategory] = useState<ThreadCategory | ''>('');
  const [filterDok, setFilterDok] = useState<DokLevel | 0>(0);
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const concepts = (allConcepts ?? []) as EnrichedConcept[];

  // Mark forum as visited (clears unread badge in sidebar)
  useEffect(() => { markForumVisited(); }, []);

  // Check for Algebra Tiles image shared from TopicView
  useEffect(() => {
    const img = sessionStorage.getItem('forum_draft_img');
    if (img) {
      sessionStorage.removeItem('forum_draft_img');
      setDraftImageUrl(img);
      setShowNewModal(true);
    }
  }, []);

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = subscribeForumThreads(
      { conceptId: filterConceptId || undefined },
      (updated) => {
        setThreads(updated);
        setLoading(false);
        // Keep activeThread in sync with server state
        setActiveThread(prev => {
          if (!prev) return prev;
          const fresh = updated.find(t => t.id === prev.id);
          return fresh ?? prev;
        });
      },
    );
    return () => { unsubRef.current?.(); };
  }, [filterConceptId]);

  // ── Derived live stats (from real-time threads array) ──────────────────────
  const stats: ForumStats = useMemo(() => ({
    totalThreads: threads.length,
    activeThisWeek: threads.filter(t => {
      if (!t.createdAt) return false;
      return Date.now() - t.createdAt.toDate().getTime() < 7 * 86400000;
    }).length,
  }), [threads]);

  const handleUpvoteThread = async (thread: ForumThread) => {
    if (!firebaseUser?.uid) return;
    const hasUpvoted = thread.upvotedBy.includes(firebaseUser.uid);
    const update = (t: ForumThread): ForumThread => t.id !== thread.id ? t : {
      ...t,
      upvotedBy: hasUpvoted
        ? t.upvotedBy.filter(u => u !== firebaseUser.uid)
        : [...t.upvotedBy, firebaseUser.uid],
    };
    setThreads(prev => prev.map(update));
    if (activeThread?.id === thread.id) setActiveThread(prev => prev ? update(prev) : prev);
    await toggleThreadUpvote(thread.id, firebaseUser.uid, hasUpvoted);
  };

  const handleReactThread = async (thread: ForumThread, field: ReactionField) => {
    if (!firebaseUser?.uid) return;
    const arr = reactionArr(thread, field);
    const hasReacted = arr.includes(firebaseUser.uid);
    const update = (t: ForumThread): ForumThread => t.id !== thread.id ? t : {
      ...t,
      [field]: hasReacted ? arr.filter((u: string) => u !== firebaseUser!.uid) : [...arr, firebaseUser!.uid],
    };
    setThreads(prev => prev.map(update));
    if (activeThread?.id === thread.id) setActiveThread(prev => prev ? update(prev) : prev);
    await toggleForumReaction('forum_threads', thread.id, field, firebaseUser.uid, hasReacted);
  };

  const handleDelete = async (thread: ForumThread) => {
    if (!firebaseUser?.uid || thread.authorUid !== firebaseUser.uid) return;
    if (!window.confirm('Да се избрише оваа нишка?')) return;
    await softDeleteThread(thread.id);
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    addNotification('Нишката е избришана.', 'info');
  };

  const handleThreadCreated = (thread: ForumThread) => {
    // onSnapshot will update threads automatically; just navigate into the new thread
    setActiveThread(thread);
  };

  const handleGenerateDokChallenge = async () => {
    if (generatingChallenge) return;
    setGeneratingChallenge(true);
    try {
      const weekStr = new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });
      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{
          parts: [{ text: `Генерирај „DoK Предизвик на неделата" (${weekStr}) за заедница на македонски наставници по математика (5–12 одд).
Предизвикот треба да поттикнува размислување на DoK ниво 3–4.
Врати САМО валиден JSON: { "title": "...", "body": "..." }
Наслов: кратко (до 80 знаки), привлечен.
Тело: 3–4 пасуси на македонски — опис на предизвикот, прашања за рефлексија по DoK нивоа, повик за акција.` }],
        }],
        systemInstruction: 'Одговори САМО со валиден JSON објект. Без markdown, без обjaснувања.',
        generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
      });
      const raw = resp.text ?? '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON');
      const parsed = JSON.parse(match[0]) as { title: string; body: string };
      const threadId = await createForumThread({
        authorUid: myUid,
        authorName: 'DoK Предизвик 📌',
        category: 'resource',
        title: parsed.title,
        body: parsed.body,
        dokLevel: 3,
      });
      await pinThread(threadId, true);
      addNotification('DoK Предизвик создаден и прикачен!', 'success');
    } catch {
      addNotification('Грешка при генерирање на предизвикот.', 'error');
    } finally {
      setGeneratingChallenge(false);
    }
  };

  // ── Filtering + sorting ────────────────────────────────────────────────────

  const pinned = threads.filter(t => t.isPinned);
  const unpinned = threads.filter(t => !t.isPinned);

  const filtered = unpinned.filter(t => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (filterDok && t.dokLevel !== filterDok) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'hot') return hotScore(b) - hotScore(a);
    if (sortMode === 'active') {
      const aTime = a.lastActivityAt?.toDate?.()?.getTime() ?? 0;
      const bTime = b.lastActivityAt?.toDate?.()?.getTime() ?? 0;
      return bTime - aTime;
    }
    // 'new'
    const aTime = a.createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

  const myUid  = firebaseUser?.uid ?? '';
  const myName = user?.name ?? firebaseUser?.email ?? 'Наставник';

  return (
    <div className="p-6 md:p-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900">Наставнички Форум</h1>
            <p className="text-sm text-gray-500">Заедница за размена на искуства, идеи и совети</p>
          </div>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={handleGenerateDokChallenge}
              disabled={generatingChallenge}
              title="Генерирај DoK Предизвик на неделата (admin)"
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition disabled:opacity-50 shadow-sm"
            >
              {generatingChallenge
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Pin className="w-3.5 h-3.5" />}
              DoK Предизвик
            </button>
          )}
        </div>
      </header>

      {activeThread ? (
        <ThreadDetail
          thread={activeThread}
          myUid={myUid}
          myName={myName}
          onBack={() => setActiveThread(null)}
          onUpvoteThread={() => handleUpvoteThread(activeThread)}
          onReactThread={(field) => handleReactThread(activeThread, field)}
        />
      ) : (
        <>
          {/* Stats */}
          <StatsBanner stats={stats} />

          {/* Category tabs */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {ALL_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  filterCategory === cat.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                <span>{cat.emoji}</span> {cat.label}
              </button>
            ))}
          </div>

          {/* DoK filter row */}
          <div className="flex gap-1.5 mb-4 flex-wrap items-center">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mr-1">DoK:</span>
            <button
              type="button"
              onClick={() => setFilterDok(0)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                filterDok === 0
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}
            >
              Сите
            </button>
            {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
              const meta = DOK_META[lvl];
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterDok(filterDok === lvl ? 0 : lvl)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                    filterDok === lvl
                      ? `${meta.color} border-current ring-2 ring-offset-1 ring-current`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  DoK {lvl}
                </button>
              );
            })}
          </div>

          {/* Toolbar: search + sort + new */}
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Пребарај нишки..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>

            {/* Sort tabs */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
              {([
                { id: 'new', icon: Sparkles, label: 'Ново' },
                { id: 'hot', icon: TrendingUp, label: 'Топло' },
                { id: 'active', icon: Clock, label: 'Активно' },
              ] as const).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSortMode(id)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-bold transition-colors ${
                    sortMode === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Concept filter */}
            <select
              title="Филтрирај по поим"
              value={filterConceptId}
              onChange={e => setFilterConceptId(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full sm:w-48 flex-shrink-0"
            >
              <option value="">Сите поими</option>
              {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.gradeLevel}. одд. · {c.title}</option>
              ))}
            </select>

            {/* New thread */}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition flex-shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Нов пост
            </button>
          </div>

          {/* Pinned threads */}
          {pinned.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wide">
                <Pin className="w-3.5 h-3.5" /> Прикачени нишки
              </div>
              {pinned.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  myUid={myUid}
                  onClick={() => setActiveThread(thread)}
                  onUpvote={() => handleUpvoteThread(thread)}
                  onDelete={() => handleDelete(thread)}
                />
              ))}
            </div>
          )}

          {/* Thread list */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">
                {search || filterCategory ? 'Нема резултати за филтерот' : 'Форумот е сè уште празен'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!search && !filterCategory && 'Биди прв! Постави прашање или сподели искуство.'}
              </p>
              {!search && !filterCategory && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" /> Постави прашање
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  myUid={myUid}
                  onClick={() => setActiveThread(thread)}
                  onUpvote={() => handleUpvoteThread(thread)}
                  onDelete={() => handleDelete(thread)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showNewModal && (
        <NewThreadModal
          onClose={() => { setShowNewModal(false); setDraftImageUrl(null); }}
          onCreated={handleThreadCreated}
          concepts={concepts}
          authorUid={myUid}
          authorName={myName}
          initialImageDataUrl={draftImageUrl}
        />
      )}
    </div>
  );
};

export default TeacherForumView;
