import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, ThumbsUp, Award, ChevronLeft, Send, Loader2,
  Tag, X, CheckCircle2, Pin, Sparkles,
  Link, Pencil, Camera, Check, Lightbulb, Flag, Trash2,
} from 'lucide-react';
import { DokBadge } from '../common/DokBadge';
import { MathRenderer } from '../common/MathRenderer';
import { uploadForumImage } from '../../services/storageService';
import { AcademyBadgeRow } from '../academy/AcademyBadgeChip';

const Shape3DViewer = React.lazy(() =>
  import('../math/Shape3DViewer').then(m => ({ default: m.Shape3DViewer }))
);
import { SHAPE_ORDER } from '../math/Shape3DViewer';
import type { Shape3DType } from '../math/Shape3DViewer';

import {
  subscribeForumReplies,
  createForumReply,
  toggleReplyUpvote,
  toggleForumReaction,
  markBestAnswer,
  toggleFeynmanBadge,
  updateForumReply,
  updateForumThread,
  reportForumThread,
  reportForumReply,
  deleteForumReply,
  CATEGORY_CONFIG,
  type ForumThread,
  type ForumReply,
  type ReactionField,
} from '../../services/firestoreService.forum';
import { callGeminiProxy, DEFAULT_MODEL } from '../../services/gemini/core';
import { CategoryBadge } from './CategoryBadge';
import { AuthorAvatar } from './AuthorAvatar';
import { ReactionBar } from './ReactionBar';
import { reactionArr, formatDate, timeAgo } from './forumHelpers';
import { useLanguage } from '../../i18n/LanguageContext';

type FormEv = React.FormEvent<HTMLFormElement>;

interface ThreadDetailProps {
  thread: ForumThread;
  myUid: string;
  myName: string;
  isAdmin?: boolean;
  onBack: () => void;
  onUpvoteThread: () => void;
  onReactThread: (field: ReactionField) => void;
}

export const ThreadDetail: React.FC<ThreadDetailProps> = ({ thread, myUid, myName, isAdmin, onBack, onUpvoteThread, onReactThread }) => {
  const { t } = useLanguage();
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyImg, setReplyImg] = useState<string | null>(null);
  const replyImgRef = useRef<HTMLInputElement | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyBody, setEditingReplyBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const replyUnsubRef = useRef<(() => void) | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingAIAnswer, setLoadingAIAnswer] = useState(false);
  const [showReplyPreview, setShowReplyPreview] = useState(false);
  const [threadReported, setThreadReported] = useState((thread.reportedBy ?? []).includes(myUid));
  const [editingThread, setEditingThread] = useState(false);
  const [editThreadTitle, setEditThreadTitle] = useState(thread.title);
  const [editThreadBody, setEditThreadBody] = useState(thread.body);
  const [savingThreadEdit, setSavingThreadEdit] = useState(false);

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
      let imgUrl: string | undefined;
      if (replyImg) imgUrl = await uploadForumImage(replyImg, myUid);
      await createForumReply({
        threadId:   thread.id,
        authorUid:  myUid,
        authorName: myName,
        body:       replyBody.trim(),
        ...(imgUrl ? { forumImageUrl: imgUrl } : {}),
      });
      setReplyBody('');
      setReplyImg(null);
      if (replyImgRef.current) replyImgRef.current.value = '';
    } finally {
      setSendingReply(false);
    }
  };

  const handleSaveReplyEdit = async (reply: ForumReply) => {
    if (!editingReplyBody.trim()) return;
    setSavingEdit(true);
    try {
      await updateForumReply(reply.id, { body: editingReplyBody.trim() });
      setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, body: editingReplyBody.trim() } : r));
      setEditingReplyId(null);
    } finally {
      setSavingEdit(false);
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

  const handleAIThreadSummary = async () => {
    if (loadingSummary || replies.length < 2) return;
    setLoadingSummary(true);
    try {
      const context = `Нишка: ${thread.title}\n\n${thread.body}\n\nОдговори:\n${replies.map((r, i) => `${i + 1}. ${r.authorName}: ${r.body}`).join('\n')}`;
      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ parts: [{ text: `Ти си педагошки асистент. Резимирај ја следнава дискусија на македонски наставници по математика во 3 кратки точки (bullet points). Биди конкретен. Нагласи ги клучните педагошки увиди и решенија.\n\n${context}` }] }],
        systemInstruction: 'Пиши на македонски. Врати само 3 bullet point резиме, без воведна реченица.',
        generationConfig: { maxOutputTokens: 300 },
      });
      setAiSummary(resp.text?.trim() ?? '');
    } catch {
      setAiSummary(t('forum.threadDetail.summaryFailed'));
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleAskAIExpert = async () => {
    if (loadingAIAnswer) return;
    setLoadingAIAnswer(true);
    try {
      const context = `Прашање: ${thread.title}\n\n${thread.body}${replies.length > 0 ? `\n\nПостоечки одговори:\n${replies.map(r => `• ${r.authorName}: ${r.body}`).join('\n')}` : ''}`;
      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ parts: [{ text: `Ти си искусен македонски наставник по математика и педагошки ментор. Одговори на следново прашање од колега наставник со детален, педагошки структуриран одговор. Вклучи конкретни примери, LaTeX формули каде е потребно ($формула$), и практични совети.\n\n${context}` }] }],
        systemInstruction: 'Пиши на македонски. Биди практичен, педагошки и конкретен.',
        generationConfig: { maxOutputTokens: 800 },
      });
      const aiBody = resp.text?.trim();
      if (!aiBody) return;
      await createForumReply({
        threadId: thread.id,
        authorUid: 'ai-expert',
        authorName: '🤖 AI Eксперт',
        body: aiBody,
      });
    } catch { /* non-critical */ }
    finally { setLoadingAIAnswer(false); }
  };

  const handleMarkBest = async (reply: ForumReply) => {
    if (thread.authorUid !== myUid) return;
    setReplies(prev => prev.map(r => ({ ...r, isBestAnswer: r.id === reply.id ? !r.isBestAnswer : false })));
    await markBestAnswer(reply.id, thread.id);
  };

  const handleToggleFeynman = async (reply: ForumReply) => {
    if (thread.authorUid !== myUid) return;
    setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, feynmanBadge: !r.feynmanBadge } : r));
    await toggleFeynmanBadge(reply.id, reply.feynmanBadge ?? false);
  };

  const handleReportThread = async () => {
    if (threadReported) return;
    setThreadReported(true);
    try { await reportForumThread(thread.id, myUid); } catch { setThreadReported(false); }
  };

  const handleSaveThreadEdit = async () => {
    if (!editThreadTitle.trim() || !editThreadBody.trim() || savingThreadEdit) return;
    setSavingThreadEdit(true);
    try {
      await updateForumThread(thread.id, { title: editThreadTitle.trim(), body: editThreadBody.trim() });
      setEditingThread(false);
    } finally {
      setSavingThreadEdit(false);
    }
  };

  const handleReportReply = async (reply: ForumReply) => {
    if ((reply.reportedBy ?? []).includes(myUid)) return;
    setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, reportedBy: [...(r.reportedBy ?? []), myUid] } : r));
    await reportForumReply(reply.id, myUid);
  };

  const handleDeleteReply = async (reply: ForumReply) => {
    if (!isAdmin) return;
    if (!window.confirm(t('forum.threadDetail.deleteReplyConfirm'))) return;
    setReplies(prev => prev.filter(r => r.id !== reply.id));
    await deleteForumReply(reply.id);
  };

  const hasUpvotedThread = thread.upvotedBy.includes(myUid);
  const catCfg = CATEGORY_CONFIG[thread.category ?? 'question'];

  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/forum?thread=${thread.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 transition font-medium">
          <ChevronLeft className="w-4 h-4" /> {t('forum.threadDetail.backToForum')}
        </button>
        <div className="flex items-center gap-2">
          {thread.authorUid === myUid && !editingThread && (
            <button type="button" onClick={() => { setEditingThread(true); setEditThreadTitle(thread.title); setEditThreadBody(thread.body); }}
                    title={t('forum.threadDetail.editThreadTitle')}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              <Pencil className="w-3.5 h-3.5" /> {t('forum.threadDetail.edit')}
            </button>
          )}
          {thread.authorUid !== myUid && (
            <button type="button" onClick={handleReportThread} disabled={threadReported}
                    title={threadReported ? t('forum.card.alreadyReported') : t('forum.card.reportThreadTitle')}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      threadReported
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
                    }`}>
              <Flag className="w-3.5 h-3.5" /> {threadReported ? t('forum.threadDetail.reported') : t('forum.threadDetail.report')}
            </button>
          )}
          <button type="button" onClick={handleCopyLink}
                  title={t('forum.threadDetail.copyLinkTitle')}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                    copied
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
            <Link className="w-3.5 h-3.5" />
            {copied ? t('forum.threadDetail.copied') : t('forum.threadDetail.copyLink')}
          </button>
        </div>
      </div>

      {thread.scenarioId && (
        <a
          href="#/scenario-bank"
          onClick={e => { e.preventDefault(); window.location.hash = '/scenario-bank'; }}
          className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm text-sky-700 hover:bg-sky-100 transition-colors font-semibold"
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          {t('forum.newThread.linkedScenario')}<span className="font-black">{thread.scenarioTitle ?? t('forum.threadDetail.openInBank')}</span>
          <span className="ml-auto text-sky-400 text-xs">→</span>
        </a>
      )}

      <div className={`bg-white rounded-xl border-l-4 shadow-sm p-5 ${catCfg.border}`}>
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              type="button"
              aria-label={hasUpvotedThread ? t('forum.card.removeVote') : t('forum.threadDetail.voteThread')}
              onClick={onUpvoteThread}
              className={`p-1.5 rounded-lg transition-colors ${hasUpvotedThread ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-600">{thread.upvotedBy.length}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <CategoryBadge category={thread.category ?? 'question'} size="sm" />
              {thread.isPinned && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5" /> {t('forum.card.pinned')}
                </span>
              )}
              {thread.hasBestAnswer && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> {t('forum.card.solved')}
                </span>
              )}
              {thread.conceptTitle && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                  <Tag className="w-2.5 h-2.5" />{thread.conceptTitle}
                </span>
              )}
              {thread.dokLevel && <DokBadge level={thread.dokLevel} size="compact" />}
            </div>

            {editingThread ? (
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={editThreadTitle}
                  onChange={e => setEditThreadTitle(e.target.value)}
                  maxLength={120}
                  aria-label={t('forum.threadDetail.threadTitleAria')}
                  placeholder={t('forum.threadDetail.titlePlaceholder')}
                  className="w-full border border-indigo-300 rounded-lg text-lg font-black p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                />
                <textarea
                  rows={5}
                  value={editThreadBody}
                  onChange={e => setEditThreadBody(e.target.value)}
                  aria-label={t('forum.threadDetail.threadBodyAria')}
                  placeholder={t('forum.threadDetail.bodyPlaceholder')}
                  className="w-full border border-indigo-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={savingThreadEdit} onClick={handleSaveThreadEdit}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                    {savingThreadEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} {t('common.save')}
                  </button>
                  <button type="button" onClick={() => setEditingThread(false)}
                    className="px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black text-gray-900 leading-snug mb-3">{thread.title}</h2>
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {thread.body.includes('$') ? <MathRenderer text={thread.body} /> : thread.body}
                </div>
              </>
            )}
            {thread.forumImageUrl && (
              <img
                src={thread.forumImageUrl}
                alt={t('forum.threadDetail.attachedImageAlt')}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-700">{thread.authorName}</span>
                  <AcademyBadgeRow uid={thread.authorUid} />
                </div>
                <div className="text-[10px] text-gray-400">{formatDate(thread.createdAt)}</div>
              </div>
              <div className="ml-auto">
                <ReactionBar reactions={thread} myUid={myUid} onReact={onReactThread} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {replies.length} {replies.length === 1 ? t('forum.threadDetail.replySingular') : t('forum.threadDetail.repliesPlural')}
          </h3>
          {replies.length >= 2 && (
            <button type="button" onClick={handleAIThreadSummary} disabled={loadingSummary}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition disabled:opacity-50">
              {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {t('forum.threadDetail.aiSummaryBtn')}
            </button>
          )}
        </div>

        {aiSummary && (
          <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-xs font-bold text-violet-700">{t('forum.threadDetail.aiSummaryHeader')}</span>
              <button type="button" aria-label={t('forum.threadDetail.closeSummaryAria')} onClick={() => setAiSummary(null)} className="ml-auto text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
              <MathRenderer text={aiSummary} />
            </div>
          </div>
        )}

        {loadingReplies ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-3">
            {replies.map(reply => {
              const hasUpvoted = reply.upvotedBy.includes(myUid);
              return (
                <div key={reply.id}
                     className={`bg-white rounded-xl border shadow-sm p-4 ${reply.isBestAnswer ? 'border-emerald-300 bg-emerald-50/40' : reply.authorUid === 'ai-expert' ? 'border-violet-200 bg-violet-50/30' : 'border-gray-200'}`}>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        aria-label={hasUpvoted ? t('forum.card.removeVote') : t('forum.threadDetail.voteReply')}
                        onClick={() => handleUpvoteReply(reply)}
                        className={`p-1 rounded transition-colors ${hasUpvoted ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-gray-500">{reply.upvotedBy.length}</span>
                      {thread.authorUid === myUid && (
                        <>
                          <button
                            type="button"
                            title={reply.isBestAnswer ? t('forum.threadDetail.unmarkBest') : t('forum.threadDetail.markBest')}
                            onClick={() => handleMarkBest(reply)}
                            className={`p-1 rounded transition-colors mt-1 ${reply.isBestAnswer ? 'text-emerald-600' : 'text-gray-300 hover:text-emerald-500'}`}
                          >
                            <Award className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title={reply.feynmanBadge ? t('forum.threadDetail.unmarkFeynman') : t('forum.threadDetail.markFeynman')}
                            onClick={() => handleToggleFeynman(reply)}
                            className={`p-1 rounded transition-colors mt-1 ${reply.feynmanBadge ? 'text-yellow-600' : 'text-gray-300 hover:text-yellow-500'}`}
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {(reply.isBestAnswer || reply.feynmanBadge) && (
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {reply.isBestAnswer && (
                            <span className="flex items-center gap-1 text-xs font-black text-emerald-700">
                              <Award className="w-3.5 h-3.5" /> {t('forum.threadDetail.bestAnswerBadge')}
                            </span>
                          )}
                          {reply.feynmanBadge && (
                            <span className="flex items-center gap-1 text-xs font-black text-yellow-700">
                              <Lightbulb className="w-3.5 h-3.5" /> {t('forum.threadDetail.feynmanBadge')}
                            </span>
                          )}
                        </div>
                      )}
                      {editingReplyId === reply.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={4}
                            value={editingReplyBody}
                            onChange={e => setEditingReplyBody(e.target.value)}
                            className="w-full border border-indigo-300 rounded-lg text-sm p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
                          />
                          <div className="flex gap-2">
                            <button type="button" disabled={savingEdit} onClick={() => handleSaveReplyEdit(reply)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                              {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} {t('common.save')}
                            </button>
                            <button type="button" onClick={() => setEditingReplyId(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                            {reply.body.includes('$') ? <MathRenderer text={reply.body} /> : reply.body}
                          </div>
                          {reply.forumImageUrl && (
                            <img src={reply.forumImageUrl} alt={t('forum.threadDetail.attachedImageAlt')}
                              className="mt-2 rounded-xl border border-gray-200 max-h-56 w-auto" />
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <AuthorAvatar name={reply.authorName} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-gray-600">{reply.authorName}</span>
                            {reply.authorUid === 'ai-expert' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">AI</span>
                            )}
                            <AcademyBadgeRow uid={reply.authorUid} />
                          </div>
                          <div className="text-[10px] text-gray-400">{timeAgo(reply.createdAt, t)}</div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <ReactionBar
                            reactions={reply}
                            myUid={myUid}
                            onReact={(field) => handleReactReply(reply, field)}
                            compact
                          />
                          {reply.authorUid === myUid && editingReplyId !== reply.id && (
                            <button type="button" title={t('forum.threadDetail.editReplyTitle')}
                              onClick={() => { setEditingReplyId(reply.id); setEditingReplyBody(reply.body); }}
                              className="p-1 rounded text-gray-300 hover:text-indigo-500 transition">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {reply.authorUid !== myUid && reply.authorUid !== 'ai-expert' && (
                            <button type="button"
                              title={(reply.reportedBy ?? []).includes(myUid) ? t('forum.card.alreadyReported') : t('forum.threadDetail.reportReply')}
                              disabled={(reply.reportedBy ?? []).includes(myUid)}
                              onClick={() => handleReportReply(reply)}
                              className={`p-1 rounded transition-colors ${(reply.reportedBy ?? []).includes(myUid) ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}>
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdmin && (
                            <button type="button" title={t('forum.threadDetail.deleteReplyTitle')}
                              onClick={() => handleDeleteReply(reply)}
                              className="p-1 rounded text-gray-300 hover:text-red-500 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {(reply.reportedBy ?? []).length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <Flag className="w-3 h-3" /> {t((reply.reportedBy ?? []).length === 1 ? 'forum.threadDetail.reportedByCountSingular' : 'forum.threadDetail.reportedByCountPlural').replace('{n}', String((reply.reportedBy ?? []).length))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">{t('forum.threadDetail.yourReplyHeader')}</h4>
          <button type="button" onClick={handleAskAIExpert} disabled={loadingAIAnswer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 transition disabled:opacity-50 shadow-sm">
            {loadingAIAnswer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {t('forum.threadDetail.aiExpertReplyBtn')}
          </button>
        </div>
        <div className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 mb-3">
          {t('forum.threadDetail.latexTipPre')}<code className="font-mono bg-indigo-100 px-1 rounded">$x^2 + 2x$</code>{t('forum.threadDetail.latexTipPost')}
        </div>
        <form onSubmit={handleSendReply} className="flex flex-col gap-3">
          <textarea
            rows={4}
            value={replyBody}
            onChange={e => { setReplyBody(e.target.value); if (showReplyPreview && !e.target.value) setShowReplyPreview(false); }}
            placeholder={t('forum.threadDetail.replyPlaceholder')}
            className="w-full border border-gray-300 rounded-lg text-sm p-3 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
          />
          {replyBody.includes('$') && (
            <div>
              <button type="button" onClick={() => setShowReplyPreview(v => !v)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {showReplyPreview ? t('forum.newThread.hidePreview') : t('forum.newThread.showMathPreview')}
              </button>
              {showReplyPreview && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800">
                  <MathRenderer text={replyBody} />
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={replyImgRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setReplyImg(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
            <button type="button" onClick={() => replyImgRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition">
              <Camera className="w-3.5 h-3.5" /> {t('forum.threadDetail.attachImageBtn')}
            </button>
            {replyImg && (
              <div className="relative inline-block">
                <img src={replyImg} alt="Preview" className="h-14 w-auto rounded-lg border border-gray-200 object-cover" />
                <button type="button" onClick={() => { setReplyImg(null); if (replyImgRef.current) replyImgRef.current.value = ''; }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold hover:bg-red-600 transition">
                  ×
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={sendingReply || !replyBody.trim()}
              className="ml-auto flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('forum.threadDetail.replySubmitBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
