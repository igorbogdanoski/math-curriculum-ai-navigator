/**
 * TeacherForumView — Ж7.2
 *
 * Наставнички форум — Q&A нишки по концепти.
 * Наставниците можат да постават прашање, да одговорат,
 * да гласаат и да означат најдобар одговор.
 *
 * Педагошка основа: Wenger Communities of Practice,
 * Social Constructivism (Vygotsky), Peer Learning
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Plus, ThumbsUp, Award, ChevronLeft,
  Send, Loader2, Search, Tag, X,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import type { Concept } from '../types';

type EnrichedConcept = Concept & { gradeLevel: number; topicId: string };

// Suppress React.FormEvent deprecation — FormEvent is fine in React 18
type FormEv = React.FormEvent<HTMLFormElement>;
import {
  fetchForumThreads,
  fetchForumThread,
  fetchForumReplies,
  createForumThread,
  createForumReply,
  toggleThreadUpvote,
  toggleReplyUpvote,
  markBestAnswer,
  softDeleteThread,
  type ForumThread,
  type ForumReply,
} from '../services/firestoreService.forum';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
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
    return `пред ${days} д`;
  } catch {
    return '';
  }
}

// ── New Thread Modal ──────────────────────────────────────────────────────────

interface NewThreadModalProps {
  onClose: () => void;
  onCreated: (thread: ForumThread) => void;
  concepts: EnrichedConcept[];
  authorUid: string;
  authorName: string;
}

const NewThreadModal: React.FC<NewThreadModalProps> = ({ onClose, onCreated, concepts, authorUid, authorName }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedConcept = concepts.find(c => c.id === conceptId);

  const handleSubmit = async (e: FormEv) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const id = await createForumThread({
        authorUid,
        authorName,
        conceptId:    selectedConcept?.id,
        conceptTitle: selectedConcept?.title,
        title:        title.trim(),
        body:         body.trim(),
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
          <h2 className="font-bold text-gray-800 text-lg">Ново прашање</h2>
          <button type="button" aria-label="Затвори" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Concept anchor (optional) */}
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Опис *</label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Детално опишете го прашањето, контекстот, она што сте го пробале..."
              className="w-full border border-gray-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex gap-3">
        {/* Upvote column */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onUpvote(); }}
            className={`p-1.5 rounded-lg transition-colors ${hasUpvoted ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
            title={hasUpvoted ? 'Отстрани глас' : 'Гласај'}
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-gray-600">{thread.upvotedBy.length}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">{thread.title}</h3>
            {thread.replyCount > 0 && (
              <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                <MessageSquare className="w-2.5 h-2.5" />{thread.replyCount}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">{thread.body}</p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {thread.conceptTitle && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                <Tag className="w-2.5 h-2.5" />{thread.conceptTitle}
              </span>
            )}
            <span className="text-[10px] text-gray-400">{thread.authorName}</span>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{timeAgo(thread.createdAt)}</span>
            {thread.authorUid === myUid && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="ml-auto text-[10px] text-red-400 hover:text-red-600 transition"
              >
                Избриши
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

// ── Thread Detail ─────────────────────────────────────────────────────────────

interface ThreadDetailProps {
  thread: ForumThread;
  myUid: string;
  myName: string;
  onBack: () => void;
  onUpvoteThread: () => void;
}

const ThreadDetail: React.FC<ThreadDetailProps> = ({ thread, myUid, myName, onBack, onUpvoteThread }) => {
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    setLoadingReplies(true);
    fetchForumReplies(thread.id)
      .then(setReplies)
      .finally(() => setLoadingReplies(false));
  }, [thread.id]);

  const handleSendReply = async (e: FormEv) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSendingReply(true);
    try {
      const id = await createForumReply({
        threadId:   thread.id,
        authorUid:  myUid,
        authorName: myName,
        body:       replyBody.trim(),
      });
      setReplies(prev => [...prev, {
        id,
        threadId:     thread.id,
        authorUid:    myUid,
        authorName:   myName,
        body:         replyBody.trim(),
        createdAt:    null,
        upvotedBy:    [],
        isBestAnswer: false,
      }]);
      setReplyBody('');
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpvoteReply = async (reply: ForumReply) => {
    const hasUpvoted = reply.upvotedBy.includes(myUid);
    setReplies(prev => prev.map(r => r.id === reply.id ? {
      ...r,
      upvotedBy: hasUpvoted
        ? r.upvotedBy.filter(u => u !== myUid)
        : [...r.upvotedBy, myUid],
    } : r));
    await toggleReplyUpvote(reply.id, myUid, hasUpvoted);
  };

  const handleMarkBest = async (reply: ForumReply) => {
    if (thread.authorUid !== myUid) return;
    setReplies(prev => prev.map(r => ({ ...r, isBestAnswer: r.id === reply.id ? !r.isBestAnswer : false })));
    await markBestAnswer(reply.id, thread.id);
  };

  const hasUpvotedThread = thread.upvotedBy.includes(myUid);

  return (
    <div className="space-y-4">
      {/* Back */}
      <button type="button" onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition font-medium">
        <ChevronLeft className="w-4 h-4" /> Назад кон форумот
      </button>

      {/* Thread body */}
      <Card className="border-l-4 border-l-indigo-400">
        <div className="flex gap-3">
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
            {thread.conceptTitle && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 mb-2">
                <Tag className="w-2.5 h-2.5" />{thread.conceptTitle}
              </span>
            )}
            <h2 className="text-lg font-bold text-gray-900 leading-snug mb-2">{thread.title}</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{thread.body}</p>
            <p className="text-[10px] text-gray-400 mt-3">
              {thread.authorName} · {formatDate(thread.createdAt)}
            </p>
          </div>
        </div>
      </Card>

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
                <Card key={reply.id} className={reply.isBestAnswer ? 'border-emerald-300 bg-emerald-50/40' : ''}>
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
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 mb-1">
                          <Award className="w-3 h-3" /> Најдобар одговор
                        </div>
                      )}
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{reply.body}</p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        {reply.authorName} · {timeAgo(reply.createdAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reply box */}
      <Card>
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
      </Card>
    </div>
  );
};

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

  const concepts = (allConcepts ?? []) as EnrichedConcept[];

  const loadThreads = useCallback(() => {
    setLoading(true);
    fetchForumThreads({ conceptId: filterConceptId || undefined })
      .then(setThreads)
      .finally(() => setLoading(false));
  }, [filterConceptId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const handleUpvoteThread = async (thread: ForumThread) => {
    if (!firebaseUser?.uid) return;
    const hasUpvoted = thread.upvotedBy.includes(firebaseUser.uid);
    // Optimistic
    setThreads(prev => prev.map(t => t.id === thread.id ? {
      ...t,
      upvotedBy: hasUpvoted
        ? t.upvotedBy.filter(u => u !== firebaseUser.uid)
        : [...t.upvotedBy, firebaseUser.uid],
    } : t));
    if (activeThread?.id === thread.id) {
      setActiveThread(prev => prev ? {
        ...prev,
        upvotedBy: hasUpvoted
          ? prev.upvotedBy.filter(u => u !== firebaseUser!.uid)
          : [...prev.upvotedBy, firebaseUser!.uid],
      } : prev);
    }
    await toggleThreadUpvote(thread.id, firebaseUser.uid, hasUpvoted);
  };

  const handleDelete = async (thread: ForumThread) => {
    if (!firebaseUser?.uid || thread.authorUid !== firebaseUser.uid) return;
    if (!window.confirm('Да се избрише оваа нишка?')) return;
    await softDeleteThread(thread.id);
    setThreads(prev => prev.filter(t => t.id !== thread.id));
    addNotification('Нишката е избришана.', 'info');
  };

  const handleThreadCreated = (thread: ForumThread) => {
    setThreads(prev => [thread, ...prev]);
    setActiveThread(thread);
  };

  const filtered = threads.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()),
  );

  const myUid   = firebaseUser?.uid ?? '';
  const myName  = user?.name ?? firebaseUser?.email ?? 'Наставник';

  return (
    <div className="p-6 md:p-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <MessageSquare className="w-8 h-8 text-indigo-500" />
          <h1 className="text-3xl font-bold text-brand-primary">Наставнички Форум</h1>
        </div>
        <p className="text-gray-500 text-base ml-11">
          Размена на искуства, прашања и совети помеѓу наставниците.
        </p>
      </header>

      {activeThread ? (
        <ThreadDetail
          thread={activeThread}
          myUid={myUid}
          myName={myName}
          onBack={() => setActiveThread(null)}
          onUpvoteThread={() => handleUpvoteThread(activeThread)}
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
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

            {/* Concept filter */}
            <select
              title="Филтрирај по поим"
              value={filterConceptId}
              onChange={e => setFilterConceptId(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none w-full sm:w-56"
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Ново прашање
            </button>
          </div>

          {/* Thread list */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
          ) : filtered.length === 0 ? (
            <Card className="text-center py-16">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">
                {search ? 'Нема резултати за пребарувањето' : 'Форумот е сè уште празен'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {!search && 'Биди прв! Постави прашање или сподели искуство.'}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 flex items-center gap-2 mx-auto px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" /> Постави прашање
                </button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(thread => (
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
          onClose={() => setShowNewModal(false)}
          onCreated={handleThreadCreated}
          concepts={concepts}
          authorUid={myUid}
          authorName={myName}
        />
      )}
    </div>
  );
};

export default TeacherForumView;
