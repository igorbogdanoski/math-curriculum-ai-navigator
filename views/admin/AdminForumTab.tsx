import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { MessageSquare, RefreshCw, Trash2, Flag, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface AdminForumTabProps {
    forumThreads: any[];
    isLoadingForum: boolean;
    forumSearch: string;
    setForumSearch: (v: string) => void;
    forumActionUid: string | null;
    handleForumDelete: (id: string) => void;
    handleForumRestore: (id: string) => void;
    handleForumApprove: (id: string) => void;
    onRefresh: () => void;
}

export function AdminForumTab({
    forumThreads, isLoadingForum, forumSearch, setForumSearch,
    forumActionUid, handleForumDelete, handleForumRestore, handleForumApprove, onRefresh,
}: AdminForumTabProps) {
    const { t } = useLanguage();
    const [reportedOnly, setReportedOnly] = useState(false);
    const reportedCount = forumThreads.filter(t => (t.reportedBy?.length ?? 0) > 0).length;

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-gray-500" />
                    {t('forum.admin.moderationTitle').replace('{n}', String(forumThreads.length))}
                    {reportedCount > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Flag className="w-3 h-3" /> {t('forum.admin.reportedBadge').replace('{n}', String(reportedCount))}
                        </span>
                    )}
                </h2>
                <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline">
                    <RefreshCw className="w-3.5 h-3.5" /> {t('forum.admin.refresh')}
                </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <input
                    type="search"
                    placeholder={t('forum.admin.searchPlaceholder')}
                    value={forumSearch}
                    onChange={e => setForumSearch(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 whitespace-nowrap">
                    <input type="checkbox" checked={reportedOnly} onChange={e => setReportedOnly(e.target.checked)} className="rounded" />
                    {t('forum.admin.reportedOnlyLabel')}
                </label>
            </div>

            {isLoadingForum ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : forumThreads.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">{t('forum.admin.noThreads')}</p>
            ) : (
                <div className="divide-y divide-gray-100">
                    {forumThreads
                        .filter(t => {
                            if (!forumSearch.trim()) return true;
                            const q = forumSearch.toLowerCase();
                            return (t.title ?? '').toLowerCase().includes(q) || (t.authorName ?? '').toLowerCase().includes(q);
                        })
                        .filter(t => !reportedOnly || (t.reportedBy?.length ?? 0) > 0)
                        // Reported threads first, then by report count, so the moderation queue
                        // doesn't require scrolling through hundreds of unreported threads.
                        .sort((a, b) => (b.reportedBy?.length ?? 0) - (a.reportedBy?.length ?? 0))
                        .map(thread => {
                            const reportCount = thread.reportedBy?.length ?? 0;
                            const isReported = reportCount > 0;
                            return (
                            <div key={thread.id} className={`flex items-start gap-3 py-3 ${thread.deleted ? 'opacity-50' : ''} ${isReported ? 'bg-amber-50/60 -mx-2 px-2 rounded-lg' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                                        {thread.title}
                                        {thread.deleted && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{t('forum.admin.deletedBadge')}</span>}
                                        {isReported && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0">
                                                <Flag className="w-3 h-3" /> {reportCount}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-400">{t('forum.admin.metaTemplate').replace('{author}', thread.authorName).replace('{replies}', String(thread.replyCount)).replace('{votes}', String(thread.upvotedBy?.length ?? 0))}</p>
                                    {thread.conceptTitle && <p className="text-[11px] text-indigo-500 mt-0.5">📌 {thread.conceptTitle}</p>}
                                    {isReported && thread.reportReason && (
                                        <p className="text-[11px] text-amber-700 mt-0.5">🚩 {t('forum.admin.reasonLabel').replace('{reason}', thread.reportReason)}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isReported && !thread.deleted && (
                                        <button
                                            type="button"
                                            disabled={forumActionUid === thread.id}
                                            onClick={() => handleForumApprove(thread.id)}
                                            title={t('forum.admin.approveTitle')}
                                            className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 transition font-medium flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> {t('forum.admin.approve')}
                                        </button>
                                    )}
                                    {thread.deleted ? (
                                        <button
                                            type="button"
                                            disabled={forumActionUid === thread.id}
                                            onClick={() => handleForumRestore(thread.id)}
                                            className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-40 transition font-medium"
                                        >
                                            {t('forum.admin.restore')}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={forumActionUid === thread.id}
                                            onClick={() => handleForumDelete(thread.id)}
                                            className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition font-medium flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" /> {t('forum.card.delete')}
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })
                    }
                </div>
            )}
        </Card>
    );
}
