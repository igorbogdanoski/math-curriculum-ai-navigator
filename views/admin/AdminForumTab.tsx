import React from 'react';
import { Card } from '../../components/common/Card';
import { MessageSquare, RefreshCw, Trash2 } from 'lucide-react';

interface AdminForumTabProps {
    forumThreads: any[];
    isLoadingForum: boolean;
    forumSearch: string;
    setForumSearch: (v: string) => void;
    forumActionUid: string | null;
    handleForumDelete: (id: string) => void;
    handleForumRestore: (id: string) => void;
    onRefresh: () => void;
}

export function AdminForumTab({
    forumThreads, isLoadingForum, forumSearch, setForumSearch,
    forumActionUid, handleForumDelete, handleForumRestore, onRefresh,
}: AdminForumTabProps) {
    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-gray-500" />
                    Модерирање на форум ({forumThreads.length})
                </h2>
                <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 underline">
                    <RefreshCw className="w-3.5 h-3.5" /> Освежи
                </button>
            </div>

            <input
                type="search"
                placeholder="Пребарај по наслов или автор..."
                value={forumSearch}
                onChange={e => setForumSearch(e.target.value)}
                className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none"
            />

            {isLoadingForum ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : forumThreads.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-sm">Нема нишки во форумот.</p>
            ) : (
                <div className="divide-y divide-gray-100">
                    {forumThreads
                        .filter(t => {
                            if (!forumSearch.trim()) return true;
                            const q = forumSearch.toLowerCase();
                            return (t.title ?? '').toLowerCase().includes(q) || (t.authorName ?? '').toLowerCase().includes(q);
                        })
                        .map(thread => (
                            <div key={thread.id} className={`flex items-start gap-3 py-3 ${thread.deleted ? 'opacity-50' : ''}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                                        {thread.title}
                                        {thread.deleted && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">ИЗБРИШАНА</span>}
                                    </p>
                                    <p className="text-xs text-gray-400">{thread.authorName} · {thread.replyCount} одговори · {thread.upvotedBy?.length ?? 0} гласови</p>
                                    {thread.conceptTitle && <p className="text-[11px] text-indigo-500 mt-0.5">📌 {thread.conceptTitle}</p>}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {thread.deleted ? (
                                        <button
                                            type="button"
                                            disabled={forumActionUid === thread.id}
                                            onClick={() => handleForumRestore(thread.id)}
                                            className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-40 transition font-medium"
                                        >
                                            Врати
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={forumActionUid === thread.id}
                                            onClick={() => handleForumDelete(thread.id)}
                                            className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition font-medium flex items-center gap-1"
                                        >
                                            <Trash2 className="w-3 h-3" /> Избриши
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    }
                </div>
            )}
        </Card>
    );
}
