import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Globe, Lock, Trash2, Edit3, Check, X, RefreshCw, Search, Users, Sparkles, Archive, ArchiveRestore } from 'lucide-react';
import { firestoreService, type CachedMaterial } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import { callEmbeddingProxy } from '../services/gemini/core';
import { bm25Score, cosineSimilarity, hybridScore } from '../utils/search';

const typeLabel: Record<string, string> = {
    quiz: 'Квиз', assessment: 'Тест', rubric: 'Рубрика',
    ideas: 'Идеи', analogy: 'Аналогија', outline: 'План',
    thematicplan: 'Тематски план', discussion: 'Дискусија',
    problems: 'Задачи', solver: 'Решенија',
};

const typeColor: Record<string, string> = {
    quiz: 'bg-blue-100 text-blue-700',
    assessment: 'bg-purple-100 text-purple-700',
    rubric: 'bg-orange-100 text-orange-700',
};

export const ContentLibraryView: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const [materials, setMaterials] = useState<CachedMaterial[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [viewMode, setViewMode] = useState<'my' | 'national' | 'archive'>('my');
    const [searchQuery, setSearchQuery] = useState('');
    const [useSemanticSearch, setUseSemanticSearch] = useState(false);
    const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
    const [isEmbedding, setIsEmbedding] = useState(false);
    const embeddingCacheRef = useRef<Map<string, number[]>>(new Map());

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const load = async () => {
        if (!firebaseUser?.uid) return;
        setLoading(true);
        try {
            let data: CachedMaterial[];
            if (viewMode === 'archive') {
                data = await firestoreService.fetchArchivedMaterials(firebaseUser.uid);
            } else if (viewMode === 'national') {
                data = await firestoreService.fetchGlobalLibraryMaterials();
            } else {
                data = (await firestoreService.fetchLibraryMaterials(firebaseUser.uid))
                    .filter(m => !m.archivedAt);
            }
            setMaterials(data);
        } catch {
            addNotification('Грешка при вчитување на библиотеката.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [firebaseUser?.uid, viewMode]);

    // Generate query embedding when semantic search is toggled and query changes
    useEffect(() => {
        const getQueryEmbedding = async () => {
            if (!useSemanticSearch || !searchQuery.trim()) {
                setQueryEmbedding(null);
                return;
            }
            // Serve from cache to avoid redundant API calls when toggling mode
            const cached = embeddingCacheRef.current.get(searchQuery);
            if (cached) { setQueryEmbedding(cached); return; }
            setIsEmbedding(true);
            try {
                const emb = await callEmbeddingProxy(searchQuery);
                embeddingCacheRef.current.set(searchQuery, emb);
                setQueryEmbedding(emb);
            } catch (err) {
                console.error('Semantic search error:', err);
                addNotification('Проблем со семантичкото пребарување.', 'warning');
            } finally {
                setIsEmbedding(false);
            }
        };

        const timer = setTimeout(getQueryEmbedding, 500); // Debounce
        return () => clearTimeout(timer);
    }, [searchQuery, useSemanticSearch]);

    const filtered = useMemo(() => {
        let results = [...materials];

        // 1. Text or Semantic Filter
        if (searchQuery.trim()) {
            if (useSemanticSearch && queryEmbedding) {
                // Hybrid ranking: 60% cosine semantic + 40% BM25 keyword
                results = results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''}`;
                        const cosine = m.embedding ? cosineSimilarity(queryEmbedding, m.embedding) : 0;
                        const bm25 = bm25Score(searchQuery, docText);
                        const score = hybridScore(cosine, bm25);
                        return { ...m, score };
                    })
                    .filter(m => (m as any).score > 0.15)
                    .sort((a, b) => (b as any).score - (a as any).score);
            } else {
                // BM25 keyword ranking (exact + partial term matching)
                results = results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''}`;
                        return { ...m, score: bm25Score(searchQuery, docText) };
                    })
                    .filter(m => (m as any).score > 0)
                    .sort((a, b) => (b as any).score - (a as any).score);
            }
        }

        // 2. Status Filter (only for 'my' view)
        if (viewMode === 'my') {
            if (filter === 'draft') results = results.filter(m => m.status === 'draft' || !m.status);
            if (filter === 'published') results = results.filter(m => m.status === 'published');
        }

        return results;
    }, [materials, searchQuery, filter, viewMode, useSemanticSearch, queryEmbedding]);

    const handlePublish = async (m: CachedMaterial) => {
        try {
            await firestoreService.publishMaterial(m.id);
            setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, status: 'published' } : x));
            addNotification(`„${m.title || 'Материјал'}" е публикуван! Достапен за ученици. ✅`, 'success');
        } catch { addNotification('Грешка при публикување.', 'error'); }
    };

const handleUnpublish = async (m: CachedMaterial) => {
        try {
            await firestoreService.unpublishMaterial(m.id);
            setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, status: 'draft' } : x));
            addNotification('Материјалот е вратен на нацрт.', 'info');
        } catch { addNotification('Грешка.', 'error'); }
    };

    const handleArchive = async (m: CachedMaterial) => {
        try {
            await firestoreService.archiveMaterial(m.id);
            setMaterials(prev => prev.filter(x => x.id !== m.id));
            addNotification(`„${m.title || 'Материјал'}" е архивиран.`, 'info');
        } catch { addNotification('Грешка при архивирање.', 'error'); }
    };

    const handleRestore = async (m: CachedMaterial) => {
        try {
            await firestoreService.restoreMaterial(m.id);
            setMaterials(prev => prev.filter(x => x.id !== m.id));
            addNotification(`„${m.title || 'Материјал'}" е вратен во библиотеката.`, 'success');
        } catch { addNotification('Грешка при враќање.', 'error'); }
    };

    const handleDeleteForever = async (id: string) => {
        if (!confirm('Трајно бришење — ова не може да се врати. Продолжи?')) return;
        try {
            await firestoreService.deleteCachedMaterial(id);
            setMaterials(prev => prev.filter(m => m.id !== id));
            addNotification('Трајно избришано.', 'info');
        } catch { addNotification('Грешка при бришење.', 'error'); }
    };

    const handleSaveTitle = async (id: string) => {
        if (!editTitle.trim()) return;
        try {
            await firestoreService.updateMaterialTitle(id, editTitle.trim());
            setMaterials(prev => prev.map(m => m.id === id ? { ...m, title: editTitle.trim() } : m));
            setEditingId(null);
            addNotification('Насловот е ажуриран.', 'success');
        } catch { addNotification('Грешка.', 'error'); }
    };

    const formatDate = (ts: any) => {
        if (!ts) return '—';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const draftCount = materials.filter(m => m.status === 'draft' || !m.status).length;
    const publishedCount = materials.filter(m => m.status === 'published').length;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    Библиотека на материјали
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Прегледај, едитирај и публикувај генерирани материјали. Само „Публикувани" се достапни за ученици.
                </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                {/* View Mode Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                    <button
                        type="button"
                        onClick={() => setViewMode('my')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'my' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Lock className="w-4 h-4" /> Мои материјали
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('national')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'national' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Globe className="w-4 h-4" /> Национална библиотека
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('archive')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'archive' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Archive className="w-4 h-4" /> Архива
                    </button>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col gap-2 w-full md:w-80">
                    <div className="relative w-full">
                        <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isEmbedding ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                        <input 
                            type="text"
                            placeholder={useSemanticSearch ? "Опишете што барате..." : "Пребарај материјали..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setUseSemanticSearch(!useSemanticSearch)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            useSemanticSearch 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <Sparkles className={`w-3 h-3 ${useSemanticSearch ? 'fill-indigo-500' : ''}`} />
                        Семантичко пребарување (AI)
                        {useSemanticSearch && <span className="ml-auto bg-indigo-500 text-white px-1.5 py-0.5 rounded text-[10px]">PRO</span>}
                    </button>
                </div>
            </div>

            {/* Stats + Filter */}
            {viewMode === 'my' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                        {([
                            { id: 'all', label: `Сите (${materials.length})` },
                            { id: 'draft', label: `🔒 Нацрт (${draftCount})` },
                            { id: 'published', label: `🌐 Публикувани (${publishedCount})` },
                        ] as const).map(f => (
                            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${filter === f.id ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {viewMode === 'national' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <p className="text-sm text-gray-500">
                        Истражете материјали креирани од заедницата и ресурси официјално одобрени од МОН.
                    </p>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {viewMode === 'archive' && (
                <div className="flex flex-wrap items-center gap-3 mb-5">
                    <p className="text-sm text-gray-500">
                        Архивираните материјали се скриени од главната библиотека. Можете да ги вратите или трајно да ги избришете.
                    </p>
                    <button type="button" onClick={load}
                        className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Освежи
                    </button>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-gray-400">Вчитувам…</div>
            ) : filtered.length === 0 ? (
                <Card className="p-10 text-center">
                    {viewMode === 'archive'
                        ? <Archive className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        : <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />}
                    <p className="text-gray-500 font-medium">
                        {viewMode === 'archive'
                            ? 'Архивата е празна.'
                            : filter === 'all' ? 'Нема зачувани материјали.'
                            : filter === 'draft' ? 'Нема нацрти.'
                            : 'Нема публикувани материјали.'}
                    </p>
                    {viewMode !== 'archive' && filter === 'all' && (
                        <p className="text-sm text-gray-400 mt-1">
                            Генерирајте квиз или тест и кликнете „Зачувај" за да го зачувате овде.
                        </p>
                    )}
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(m => {
                        const isPublished = m.status === 'published';
                        const isEditing = editingId === m.id;

                        return (
                            <Card key={m.id} className={`p-4 border-l-4 ${isPublished ? 'border-green-400' : 'border-amber-300'}`}>
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        {/* Title row */}
                                        {isEditing ? (
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    autoFocus
                                                    title="Наслов на материјал"
                                                    placeholder="Внеси наслов…"
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(m.id); if (e.key === 'Escape') setEditingId(null); }}
                                                    className="flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                                <button type="button" title="Зачувај наслов" onClick={() => handleSaveTitle(m.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                                                <button type="button" title="Откажи" onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-gray-800 truncate">{m.title || 'Без наслов'}</p>
                                                {viewMode !== 'national' && (
                                                    <button type="button" title="Уреди наслов" onClick={() => { setEditingId(m.id); setEditTitle(m.title || ''); }}
                                                        className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600 rounded">
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Meta */}
                                        <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500">
                                            <span className={`font-bold px-2 py-0.5 rounded-full ${typeColor[m.type] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {typeLabel[m.type] ?? m.type}
                                            </span>
                                            {m.gradeLevel > 0 && <span>{m.gradeLevel}. Одд.</span>}
                                            <span>{formatDate(m.createdAt)}</span>
                                            <span className={`flex items-center gap-0.5 font-semibold ${isPublished ? 'text-green-600' : 'text-amber-600'}`}>
                                                {isPublished ? <><Globe className="w-3 h-3" />Публикуван</> : <><Lock className="w-3 h-3" />Нацрт</>}
                                            </span>
                                        </div>
                                    </div>

                                        {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {viewMode === 'national' ? (
                                            m.isApproved ? (
                                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">Одобрено</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200" title="Креирано од друг наставник">
                                                    <Users className="w-3.5 h-3.5" /> Од заедницата
                                                </span>
                                            )
                                        ) : viewMode === 'archive' ? (
                                            <>
                                                <button type="button" onClick={() => handleRestore(m)}
                                                    title="Врати во библиотеката"
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                                                    <ArchiveRestore className="w-3.5 h-3.5" />Врати
                                                </button>
                                                <button type="button" onClick={() => handleDeleteForever(m.id)}
                                                    title="Избриши засекогаш"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {isPublished ? (
                                                    <button type="button" onClick={() => handleUnpublish(m)}
                                                        title="Врати на нацрт"
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                                                        <Lock className="w-3.5 h-3.5" />Нацрт
                                                    </button>
                                                ) : (
                                                    <button type="button" onClick={() => handlePublish(m)}
                                                        title="Публикувај за ученици"
                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                                                        <Globe className="w-3.5 h-3.5" />Публикувај
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => handleArchive(m)}
                                                    title="Архивирај (скриј од библиотеката)"
                                                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                                                    <Archive className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
