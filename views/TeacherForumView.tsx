import { logger } from '../utils/logger';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { markForumVisited } from '../hooks/useForumUnreadCount';
import {
  MessageSquare, Plus, Loader2, Search, Shield, Pin,
  TrendingUp, Clock, Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { DOK_META } from '../types';
import type { DokLevel } from '../types';
import {
  fetchForumThread,
  subscribeForumThreads,
  toggleThreadUpvote,
  toggleForumReaction,
  softDeleteThread,
  pinThread,
  hotScore,
  approveForumThread,
  rejectForumThread,
  fetchPendingForumThreads,
  createForumThread,
  CATEGORY_CONFIG,
  type ThreadCategory,
  type ForumThread,
  type ForumStats,
  type ReactionField,
} from '../services/firestoreService.forum';
import { callGeminiProxy, DEFAULT_MODEL } from '../services/gemini/core';
import { AppError, ErrorCode } from '../utils/errors';
import {
  reactionArr,
  EnrichedConcept,
  StatsBanner,
  NewThreadModal,
  ThreadCard,
  ThreadDetail,
} from '../components/forum/ForumInternals';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortMode = 'new' | 'hot' | 'active';

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

export const TeacherForumView: React.FC<{ thread?: string }> = ({ thread: threadIdProp }) => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();
  const { allConcepts } = useCurriculum();

  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadsTruncated, setThreadsTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ForumThread | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [draftTitle,   setDraftTitle]   = useState<string | null>(null);
  const [draftBody,    setDraftBody]    = useState<string | null>(null);
  const [draftScenarioId,    setDraftScenarioId]    = useState<string | null>(null);
  const [draftScenarioTitle, setDraftScenarioTitle] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterConceptId, setFilterConceptId] = useState('');
  const [filterCategory, setFilterCategory] = useState<ThreadCategory | ''>('');
  const [filterDok, setFilterDok] = useState<DokLevel | 0>(0);
  const [sortMode, setSortMode] = useState<SortMode>('new');
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const [showModerationTab, setShowModerationTab] = useState(false);
  const [pendingThreads, setPendingThreads] = useState<ForumThread[]>([]);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [generatingChallenge, setGeneratingChallenge] = useState(false);
  const [showMyOnly, setShowMyOnly] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const didDeepLink = useRef(false);

  const concepts = (allConcepts ?? []) as EnrichedConcept[];

  const openThread = (t: ForumThread) => {
    setActiveThread(t);
    window.history.replaceState(null, '', `${window.location.pathname}#/forum?thread=${t.id}`);
  };

  const closeThread = () => {
    setActiveThread(null);
    window.history.replaceState(null, '', `${window.location.pathname}#/forum`);
  };

  useEffect(() => { markForumVisited(); }, [markForumVisited]);

  useEffect(() => {
    const img = sessionStorage.getItem('forum_draft_img');
    const ctx = sessionStorage.getItem('forum_new_context');
    if (img) {
      sessionStorage.removeItem('forum_draft_img');
      setDraftImageUrl(img);
      setShowNewModal(true);
    }
    if (ctx) {
      sessionStorage.removeItem('forum_new_context');
      setDraftTitle(ctx);
      setShowNewModal(true);
    }
    const prefill = sessionStorage.getItem('forum_new_thread_prefill');
    if (prefill) {
      sessionStorage.removeItem('forum_new_thread_prefill');
      try {
        const p = JSON.parse(prefill);
        if (p.title)         setDraftTitle(p.title);
        if (p.body)          setDraftBody(p.body);
        if (p.scenarioId)    setDraftScenarioId(p.scenarioId);
        if (p.scenarioTitle) setDraftScenarioTitle(p.scenarioTitle);
        setShowNewModal(true);
      } catch { /* malformed */ }
    }
  }, []);

  useEffect(() => {
    if (!threadIdProp || loading || didDeepLink.current) return;
    didDeepLink.current = true;
    const found = threads.find(t => t.id === threadIdProp);
    if (found) {
      setActiveThread(found);
    } else {
      fetchForumThread(threadIdProp).then(t => { if (t) setActiveThread(t); });
    }
  }, [threadIdProp, loading, threads]);

  useEffect(() => {
    if (!showModerationTab) return;
    fetchPendingForumThreads().then(setPendingThreads);
  }, [showModerationTab]);

  const handleApprove = async (thread: ForumThread) => {
    setModeratingId(thread.id);
    try {
      await approveForumThread(thread.id);
      setPendingThreads(prev => prev.filter(t => t.id !== thread.id));
      addNotification('Нишката е одобрена и видлива.', 'success');
    } finally { setModeratingId(null); }
  };

  const handleReject = async (thread: ForumThread) => {
    setModeratingId(thread.id);
    try {
      await rejectForumThread(thread.id);
      setPendingThreads(prev => prev.filter(t => t.id !== thread.id));
      addNotification('Нишката е отфрлена.', 'info');
    } finally { setModeratingId(null); }
  };

  useEffect(() => {
    setLoading(true);
    unsubRef.current?.();
    unsubRef.current = subscribeForumThreads(
      { conceptId: filterConceptId || undefined },
      (updated, hasMore) => {
        setThreads(updated);
        setThreadsTruncated(hasMore);
        setLoading(false);
        setActiveThread(prev => {
          if (!prev) return prev;
          const fresh = updated.find(t => t.id === prev.id);
          return fresh ?? prev;
        });
      },
    );
    return () => { unsubRef.current?.(); };
  }, [filterConceptId]);

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
    openThread(thread);
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
      if (!match) {
        throw new AppError(
          'AI did not return valid JSON',
          ErrorCode.AI_PARSE_FAILED,
          'Генериањето на предизвик не успеа. Обидете се повторно.',
          true,
        );
      }
      const parsed = JSON.parse(match[0]) as { title: string; body: string };
      if (!myUid) throw new Error('Не сте логирани — освежете ја страната.');
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
    } catch (err) {
      logger.error('[DoK Challenge]', err);
      const msg = err instanceof Error ? err.message : '';
      addNotification(
        msg.includes('permission') || msg.includes('PERMISSION')
          ? 'Нема Firestore право за пинирање. Проверете admin custom claims.'
          : msg || 'Грешка при генерирање на предизвикот.',
        'error',
      );
    } finally {
      setGeneratingChallenge(false);
    }
  };

  const pinned = threads.filter(t => t.isPinned);
  const unpinned = threads.filter(t => !t.isPinned);

  const filtered = unpinned.filter(t => {
    if (showMyOnly && t.authorUid !== myUid) return false;
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
    const aTime = a.createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

  const myUid    = firebaseUser?.uid ?? '';
  const myName   = user?.name ?? firebaseUser?.email ?? 'Наставник';
  const isAdmin  = user?.role === 'admin' || user?.role === 'school_admin';

  return (
    <div className="p-6 md:p-8 animate-fade-in max-w-4xl mx-auto">
      <header className="mb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-900">Наставнички Форум</h1>
            <p className="text-sm text-gray-500">Заедница за размена на искуства, идеи и совети</p>
          </div>
          {isAdmin && pendingThreads.length === 0 && !showModerationTab && (
            <button type="button" onClick={() => setShowModerationTab(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-50 transition">
              <Shield className="w-3.5 h-3.5" /> Модерација
            </button>
          )}
          {isAdmin && (pendingThreads.length > 0 || showModerationTab) && (
            <button type="button" onClick={() => setShowModerationTab(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${showModerationTab ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
              <Shield className="w-3.5 h-3.5" />
              Модерација {pendingThreads.length > 0 && `(${pendingThreads.length})`}
            </button>
          )}
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
          onBack={closeThread}
          onUpvoteThread={() => handleUpvoteThread(activeThread)}
          onReactThread={(field) => handleReactThread(activeThread, field)}
        />
      ) : (
        <>
          {isAdmin && showModerationTab && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <h2 className="text-sm font-black text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Редица за модерација
                {pendingThreads.length > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingThreads.length}</span>}
              </h2>
              {pendingThreads.length === 0 ? (
                <p className="text-sm text-amber-600">Нема нишки кои чекаат одобрување.</p>
              ) : (
                <div className="space-y-2">
                  {pendingThreads.map(t => (
                    <div key={t.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{t.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{t.authorName} · {t.category}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" disabled={moderatingId === t.id}
                          onClick={() => handleApprove(t)}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                          {moderatingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓ Одобри'}
                        </button>
                        <button type="button" disabled={moderatingId === t.id}
                          onClick={() => handleReject(t)}
                          className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition">
                          ✕ Отфрли
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <StatsBanner stats={stats} />

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
            <button type="button" onClick={() => setShowMyOnly(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ml-auto ${
                showMyOnly
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
              }`}>
              👤 Моите нишки
            </button>
          </div>

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

          <div className="flex flex-col sm:flex-row gap-2 mb-5">
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

            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition flex-shrink-0 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Нов пост
            </button>
          </div>

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
                  onClick={() => openThread(thread)}
                  onUpvote={() => handleUpvoteThread(thread)}
                  onDelete={() => handleDelete(thread)}
                />
              ))}
            </div>
          )}

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
            <div className="space-y-3">
              {sorted.map(thread => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  myUid={myUid}
                  onClick={() => openThread(thread)}
                  onUpvote={() => handleUpvoteThread(thread)}
                  onDelete={() => handleDelete(thread)}
                />
              ))}
              {threadsTruncated && (
                <p className="text-center text-xs text-gray-400 py-3">
                  Прикажани се само последните теми — постарите не се вчитани.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {showNewModal && (
        <NewThreadModal
          onClose={() => {
            setShowNewModal(false);
            setDraftImageUrl(null);
            setDraftTitle(null);
            setDraftBody(null);
            setDraftScenarioId(null);
            setDraftScenarioTitle(null);
          }}
          onCreated={handleThreadCreated}
          concepts={concepts}
          authorUid={myUid}
          authorName={myName}
          initialImageDataUrl={draftImageUrl}
          initialTitle={draftTitle ?? undefined}
          initialBody={draftBody ?? undefined}
          initialScenarioId={draftScenarioId ?? undefined}
          initialScenarioTitle={draftScenarioTitle ?? undefined}
          skipModeration={true}
        />
      )}
    </div>
  );
};

export default TeacherForumView;
