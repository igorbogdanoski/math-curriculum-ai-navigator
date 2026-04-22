import { logger } from '../utils/logger';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Globe, Lock, Trash2, Edit3, Check, X, RefreshCw, Search, Users, Sparkles, Archive, ArchiveRestore, Star, Loader2, Eye, Zap } from 'lucide-react';
import { firestoreService, type CachedMaterial, fetchLibraryPage } from '../services/firestoreService';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import { callEmbeddingProxy } from '../services/gemini/core';
import { bm25Score, cosineSimilarity, hybridScore } from '../utils/search';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import {
    type ScoredMaterial,
    type ExtractionSource,
    getAvgRating,
    toDateValue,
    extractMaterialDokLevels,
    extractMaterialDifficulties,
    getExtractionSource,
    getExtractionBundleStats,
    getExtractionQuality,
    getExtractionSearchSnippet,
    sourceLabel,
    typeLabel,
    typeColor,
} from './contentLibrary/contentLibraryHelpers';
import { AITutorModal } from './contentLibrary/AITutorModal';
import { PreviewModal } from './contentLibrary/PreviewModal';
import { StarDisplay } from './contentLibrary/StarDisplay';


export const ContentLibraryView: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const { navigate } = useNavigation();
    const { openGeneratorPanel } = useGeneratorPanel();
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
    const [previewMaterial, setPreviewMaterial] = useState<CachedMaterial | null>(null);

    // Wave C1 — AI Tutor state
    const [aiTutorMateriaId, setAiTutorMaterialId] = useState<string | null>(null);

    // И3 — rating + sort + fork
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'rating'>('newest');
    const [minRating, setMinRating] = useState(0);
    const [ratingState, setRatingState] = useState<Record<string, number>>({});
    const [ratingHover, setRatingHover] = useState<Record<string, number>>({});
    const [forkingId, setForkingId] = useState<string | null>(null);

    // Wave B1 — advanced library filters
    const [gradeFilter, setGradeFilter] = useState<'all' | number>('all');
    const [topicFilter, setTopicFilter] = useState('all');
    const [dokFilter, setDokFilter] = useState<'all' | number>('all');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | ExtractionSource>('all');
    const [typeFilter, setTypeFilter] = useState<CachedMaterial['type'] | 'all'>('all');

    // Pagination state for 'my' view
    const [hasMoreMaterials, setHasMoreMaterials] = useState(false);
    const [lastMaterialDoc, setLastMaterialDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // Wave B2 — multi-select batch actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchLoading, setBatchLoading] = useState(false);

    // Wave B3 — sticky action row context
    const [hoveredMaterialId, setHoveredMaterialId] = useState<string | null>(null);

    const load = async () => {
        if (!firebaseUser?.uid) return;
        setLoading(true);
        setLastMaterialDoc(null);
        setHasMoreMaterials(false);
        try {
            let data: CachedMaterial[];
            if (viewMode === 'archive') {
                data = await firestoreService.fetchArchivedMaterials(firebaseUser.uid);
            } else if (viewMode === 'national') {
                data = await firestoreService.fetchGlobalLibraryMaterials();
            } else {
                const page = await fetchLibraryPage(firebaseUser.uid, 50);
                data = page.items;
                setHasMoreMaterials(page.hasMore);
                setLastMaterialDoc(page.lastDoc);
            }
            setMaterials(data);
            if (firebaseUser.uid) {
                const seeds: Record<string, number> = {};
                data.forEach(m => {
                    const r = m.ratingsByUid?.[firebaseUser.uid];
                    if (r) seeds[m.id] = r;
                });
                setRatingState(prev => ({ ...prev, ...seeds }));
            }
        } catch {
            addNotification('Грешка при вчитување на библиотеката.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!firebaseUser?.uid || !lastMaterialDoc || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await fetchLibraryPage(firebaseUser.uid, 50, lastMaterialDoc);
            setMaterials(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                return [...prev, ...page.items.filter(m => !existingIds.has(m.id))];
            });
            setHasMoreMaterials(page.hasMore);
            setLastMaterialDoc(page.lastDoc);
        } catch {
            addNotification('Грешка при вчитување на повеќе материјали.', 'error');
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => { load(); }, [firebaseUser?.uid, viewMode]);

    // Wave B2 — clear selection when view mode changes
    useEffect(() => {
        clearSelection();
    }, [viewMode]);

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
                logger.error('Semantic search error:', err);
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
                results = (results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''} ${getExtractionSearchSnippet(m)}`;
                        const cosine = m.embedding ? cosineSimilarity(queryEmbedding, m.embedding) : 0;
                        const bm25 = bm25Score(searchQuery, docText);
                        const score = hybridScore(cosine, bm25);
                        return { ...m, score } as ScoredMaterial;
                    })
                    .filter((m: ScoredMaterial) => m.score > 0.15)
                    .sort((a: ScoredMaterial, b: ScoredMaterial) => b.score - a.score)) as CachedMaterial[];
            } else {
                // BM25 keyword ranking (exact + partial term matching)
                results = (results
                    .map(m => {
                        const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''} ${getExtractionSearchSnippet(m)}`;
                        return { ...m, score: bm25Score(searchQuery, docText) } as ScoredMaterial;
                    })
                    .filter((m: ScoredMaterial) => m.score > 0)
                    .sort((a: ScoredMaterial, b: ScoredMaterial) => b.score - a.score)) as CachedMaterial[];
            }
        }

        // 2. Status Filter (only for 'my' view)
        if (viewMode === 'my') {
            if (filter === 'draft') results = results.filter(m => m.status === 'draft' || !m.status);
            if (filter === 'published') results = results.filter(m => m.status === 'published');
        }

        // 3. Wave B1 advanced metadata filters
        if (gradeFilter !== 'all') {
            results = results.filter(m => m.gradeLevel === gradeFilter);
        }
        if (topicFilter !== 'all') {
            results = results.filter(m => (m.topicId || '').trim() === topicFilter);
        }
        if (dokFilter !== 'all') {
            results = results.filter(m => extractMaterialDokLevels(m).includes(dokFilter));
        }
        if (difficultyFilter !== 'all') {
            results = results.filter(m => extractMaterialDifficulties(m).includes(difficultyFilter));
        }
        if (sourceFilter !== 'all') {
            results = results.filter(m => getExtractionSource(m) === sourceFilter);
        }
        if (typeFilter !== 'all') {
            results = results.filter(m => m.type === typeFilter);
        }

        // 4. И3: Min rating filter (national view)
        if (viewMode === 'national' && minRating > 0) {
            results = results.filter(m => {
                const avg = getAvgRating(m);
                return avg !== null && avg >= minRating;
            });
        }

        // 5. Sorting (if no explicit search ranking active)
        if (!searchQuery.trim()) {
            if (sortBy === 'rating' && viewMode === 'national') {
                results = [...results].sort((a, b) => (getAvgRating(b) ?? 0) - (getAvgRating(a) ?? 0));
            } else if (sortBy === 'oldest') {
                results = [...results].sort((a, b) => toDateValue(a.createdAt) - toDateValue(b.createdAt));
            } else if (sortBy === 'title') {
                results = [...results].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'mk'));
            } else {
                results = [...results].sort((a, b) => toDateValue(b.createdAt) - toDateValue(a.createdAt));
            }
        }

        return results;
    }, [
        materials,
        searchQuery,
        filter,
        viewMode,
        useSemanticSearch,
        queryEmbedding,
        sortBy,
        minRating,
        gradeFilter,
        topicFilter,
        dokFilter,
        difficultyFilter,
        sourceFilter,
        typeFilter,
    ]);

    const handlePublish = async (m: CachedMaterial) => {
        try {
            const name = firebaseUser?.displayName || 'Наставник';
            await firestoreService.publishMaterialWithAttribution(m.id, firebaseUser!.uid, name);
            setMaterials(prev => prev.map(x => x.id === m.id ? { ...x, status: 'published', publishedByName: name } : x));
            addNotification(`„${m.title || 'Материјал'}" е публикуван! Достапен за ученици. ✅`, 'success');
        } catch { addNotification('Грешка при публикување.', 'error'); }
    };

    const handleRate = async (materialId: string, rating: number) => {
        if (!firebaseUser?.uid) return;
        try {
            await firestoreService.rateMaterial(materialId, firebaseUser.uid, rating);
            setRatingState(prev => ({ ...prev, [materialId]: rating }));
            setMaterials(prev => prev.map(m => {
                if (m.id !== materialId) return m;
                const updated = { ...(m.ratingsByUid ?? {}), [firebaseUser.uid]: rating };
                return { ...m, ratingsByUid: updated };
            }));
        } catch { addNotification('Грешка при оценување.', 'error'); }
    };

    const handleFork = async (m: CachedMaterial) => {
        if (!firebaseUser?.uid) return;
        if (!confirm(`Форкај „${m.title || 'Материјал'}" во твоја библиотека (нацрт)?`)) return;
        setForkingId(m.id);
        try {
            await firestoreService.forkCachedMaterial(m.id, firebaseUser.uid);
            addNotification(`„${m.title || 'Материјал'}" е форкан во твоите материјали! 🍴`, 'success');
        } catch { addNotification('Грешка при форкање.', 'error'); }
        finally { setForkingId(null); }
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

    const gradeOptions = useMemo(() => {
        const set = new Set<number>();
        materials.forEach(m => { if (m.gradeLevel > 0) set.add(m.gradeLevel); });
        return [...set].sort((a, b) => a - b);
    }, [materials]);

    const topicOptions = useMemo(() => {
        const set = new Set<string>();
        materials.forEach(m => {
            if (m.topicId && m.topicId.trim()) set.add(m.topicId.trim());
        });
        return [...set].sort((a, b) => a.localeCompare(b, 'mk'));
    }, [materials]);

    const dokOptions = useMemo(() => {
        const set = new Set<number>();
        materials.forEach(m => {
            extractMaterialDokLevels(m).forEach(v => set.add(v));
        });
        return [...set].sort((a, b) => a - b);
    }, [materials]);

    const difficultyOptions = useMemo(() => {
        const set = new Set<string>();
        materials.forEach(m => {
            extractMaterialDifficulties(m).forEach(v => set.add(v));
        });
        return [...set].sort((a, b) => a.localeCompare(b, 'mk'));
    }, [materials]);

    const formatDifficultyLabel = (value: string) => {
        if (value === 'easy') return 'Easy';
        if (value === 'medium') return 'Medium';
        if (value === 'hard') return 'Hard';
        if (value === 'support') return 'Support';
        return value;
    };

    // Wave B3 — Extract action rendering logic into reusable component
    const renderQuickActions = (m: CachedMaterial, isPublished: boolean) => (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* Wave C1 — AI Tutor button (always available) */}
            <button
                type="button"
                title="Ask AI Tutor about this material"
                onClick={() => setAiTutorMaterialId(m.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
                <Sparkles className="w-3.5 h-3.5" />
                Tutor
            </button>
            {/* Generate with AI — opens generator panel pre-filled with material context */}
            {viewMode === 'my' && (
                <button
                    type="button"
                    title="Генерирај квиз, тест или флешкартички од овој материјал"
                    onClick={() => openGeneratorPanel({
                        selectedGrade: m.gradeLevel ? `grade-${m.gradeLevel}` : '',
                        selectedTopic: m.topicId ?? '',
                        selectedConcepts: m.conceptId ? [m.conceptId] : [],
                        extractedText: typeof m.content === 'string'
                            ? m.content.slice(0, 4000)
                            : JSON.stringify(m.content).slice(0, 4000),
                    })}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                >
                    <Zap className="w-3.5 h-3.5" />
                    Генерирај
                </button>
            )}

            {/* Flashcard player — available for quiz/assessment/problems */}
            {(['quiz', 'assessment', 'problems'] as CachedMaterial['type'][]).includes(m.type) && (
                <button
                    type="button"
                    title="Отвори ги флешкартичките за овој материјал"
                    onClick={() => navigate(`/flashcard-player?id=${m.id}`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition"
                >
                    🃏 Флешкартички
                </button>
            )}

            {viewMode === 'national' ? (
                <>
                    {m.isApproved ? (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">✅ МОН</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                            <Users className="w-3.5 h-3.5" /> Заедница
                        </span>
                    )}
                    <button
                        type="button"
                        title="Форкај — копирај во твоја библиотека"
                        onClick={() => handleFork(m)}
                        disabled={forkingId === m.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                    >
                        {forkingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🍴'}
                        Форкај
                    </button>
                </>
            ) : viewMode === 'archive' ? (
                <>
                    <button type="button" onClick={() => handleRestore(m)} title="Врати во библиотеката" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        <ArchiveRestore className="w-3.5 h-3.5" />Врати
                    </button>
                    <button type="button" onClick={() => handleDeleteForever(m.id)} title="Избриши засекогаш" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            ) : (
                <>
                    {isPublished ? (
                        <button type="button" onClick={() => handleUnpublish(m)} title="Врати на нацрт" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                            <Lock className="w-3.5 h-3.5" />Нацрт
                        </button>
                    ) : (
                        <button type="button" onClick={() => handlePublish(m)} title="Публикувај за ученици" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                            <Globe className="w-3.5 h-3.5" />Публикувај
                        </button>
                    )}
                    <button type="button" onClick={() => handleArchive(m)} title="Архивирај (скриј од библиотеката)" className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                        <Archive className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );

    const resetAdvancedFilters = () => {
        setGradeFilter('all');
        setTopicFilter('all');
        setDokFilter('all');
        setDifficultyFilter('all');
        setSourceFilter('all');
        setTypeFilter('all');
        setSortBy('newest');
        setMinRating(0);
    };

    // Wave B2 — batch action handlers
    const toggleSelectId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(filtered.map(m => m.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const batchPublish = async () => {
        if (selectedIds.size === 0 || !firebaseUser?.uid) return;
        setBatchLoading(true);
        try {
            const name = firebaseUser.displayName || 'Наставник';
            const ids = Array.from(selectedIds);
            await Promise.all(
                ids.map(id => firestoreService.publishMaterialWithAttribution(id, firebaseUser!.uid, name))
            );
            setMaterials(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, status: 'published', publishedByName: name } : m));
            addNotification(`${ids.length} материјалите публикувани! ✅`, 'success');
            clearSelection();
        } catch {
            addNotification('Грешка при массивно публикување.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    const batchUnpublish = async () => {
        if (selectedIds.size === 0) return;
        setBatchLoading(true);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => firestoreService.unpublishMaterial(id)));
            setMaterials(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, status: 'draft' } : m));
            addNotification(`${ids.length} материјалите враќени на нацрт. 🔒`, 'info');
            clearSelection();
        } catch {
            addNotification('Грешка при враќање на нацрт.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    const batchArchive = async () => {
        if (selectedIds.size === 0 || !confirm(`Архивирај ${selectedIds.size} материјалите? Можете да ги вратите од архивата.`)) return;
        setBatchLoading(true);
        try {
            const ids = Array.from(selectedIds);
            await Promise.all(ids.map(id => firestoreService.archiveMaterial(id)));
            setMaterials(prev => prev.filter(m => !selectedIds.has(m.id)));
            addNotification(`${ids.length} материјалите архивирани. 📦`, 'info');
            clearSelection();
        } catch {
            addNotification('Грешка при архивирање.', 'error');
        } finally {
            setBatchLoading(false);
        }
    };

    return (
        <>
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
                        type="button"
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

            {/* Wave B1 — Advanced Filter Bar */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Advanced Filters</span>
                    <span className="text-[11px] text-slate-400">тип / одделение / тема / DoK / тежина / сортирање</span>
                    <button
                        type="button"
                        onClick={resetAdvancedFilters}
                        className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                        Ресет
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-2">
                    <select
                        title="Филтер по тип на материјал"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as CachedMaterial['type'] | 'all')}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Тип: Сите</option>
                        <option value="quiz">Квиз</option>
                        <option value="assessment">Тест</option>
                        <option value="problems">Задачи</option>
                        <option value="analogy">Аналогија</option>
                        <option value="outline">Резиме</option>
                        <option value="rubric">Рубрика</option>
                        <option value="thematicplan">Тематски план</option>
                        <option value="ideas">Идеи</option>
                        <option value="discussion">Дискусија</option>
                        <option value="solver">Решение</option>
                        <option value="package">Пакет</option>
                    </select>
                    <select
                        title="Филтер по одделение"
                        value={gradeFilter}
                        onChange={(e) => setGradeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Одделение: Сите</option>
                        {gradeOptions.map(g => <option key={g} value={g}>{g}. одд.</option>)}
                    </select>

                    <select
                        title="Филтер по тема"
                        value={topicFilter}
                        onChange={(e) => setTopicFilter(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Тема: Сите</option>
                        {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                        title="Филтер по DoK"
                        value={dokFilter}
                        onChange={(e) => setDokFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">DoK: Сите</option>
                        {dokOptions.map(d => <option key={d} value={d}>DoK {d}</option>)}
                    </select>

                    <select
                        title="Филтер по тежина"
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Тежина: Сите</option>
                        {difficultyOptions.map(d => <option key={d} value={d}>{formatDifficultyLabel(d)}</option>)}
                    </select>

                    <select
                        title="Сортирај"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'title' | 'rating')}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="newest">Сортирај: Најнови</option>
                        <option value="oldest">Сортирај: Најстари</option>
                        <option value="title">Сортирај: Наслов A-Z</option>
                        {viewMode === 'national' && <option value="rating">Сортирај: Оценка</option>}
                    </select>

                    <select
                        title="Филтер по extraction извор"
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value as 'all' | ExtractionSource)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="all">Извор: Сите</option>
                        <option value="video">Извор: Видео</option>
                        <option value="image">Извор: Слика</option>
                        <option value="web">Извор: Веб</option>
                    </select>

                    <div className="flex items-center gap-1 overflow-x-auto">
                        {viewMode === 'national' ? [0, 3, 4, 5].map(v => (
                            <button key={v} type="button" onClick={() => setMinRating(v)}
                                className={`px-2 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${minRating === v ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                {v === 0 ? 'Оцена: Сите' : `${v}⭐+`}
                            </button>
                        )) : (
                            <span className="text-[11px] text-slate-400 px-1">Оценка филтер важи за национална библиотека</span>
                        )}
                    </div>
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

            {/* Wave B2 — Batch action toolbar (sticky) */}
            {viewMode === 'my' && selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-indigo-400 shadow-2xl z-40 px-4 md:px-6 py-3">
                    <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                title="Избери/одбери сите"
                                checked={selectedIds.size === filtered.length && filtered.length > 0}
                                onChange={() => selectedIds.size === filtered.length ? clearSelection() : selectAll()}
                                className="w-5 h-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-gray-700">{selectedIds.size} избрани</span>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                            >
                                Очисти избор
                            </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={batchPublish}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                            >
                                {batchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                Публикувај
                            </button>
                            <button
                                type="button"
                                onClick={batchUnpublish}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                На нацрт
                            </button>
                            <button
                                type="button"
                                onClick={batchArchive}
                                disabled={batchLoading}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition"
                            >
                                <Archive className="w-3.5 h-3.5" />
                                Архивирај
                            </button>
                        </div>
                    </div>
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
                <div className={`space-y-3 ${viewMode === 'my' && selectedIds.size > 0 ? 'pb-32' : ''}`}>
                    {filtered.map((m) => {
                        const isPublished = m.status === 'published';
                        const isEditing = editingId === m.id;
                        const isSelected = selectedIds.has(m.id);
                        const extractionSource = getExtractionSource(m);
                        const extractionStats = getExtractionBundleStats(m);
                        const extractionQuality = getExtractionQuality(m);

                        return (
                            <div 
                                key={m.id}
                                onMouseEnter={() => setHoveredMaterialId(m.id)}
                                onMouseLeave={() => setHoveredMaterialId(null)}
                                className="relative"
                            >
                                <Card className={`p-4 border-l-4 transition ${isPublished ? 'border-green-400' : 'border-amber-300'} ${isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : ''}`}>
                                <div className="flex items-start gap-3">
                                    {/* Wave B2 — checkbox for multi-select */}
                                    {viewMode === 'my' && (
                                        <input
                                            type="checkbox"
                                            title="Избери материјал"
                                            checked={isSelected}
                                            onChange={() => toggleSelectId(m.id)}
                                            className="mt-0.5 w-5 h-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    )}
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
                                            {m.isForked && m.sourceAuthor && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-600 font-semibold rounded-full border border-violet-100">
                                                    🍴 Форк од {m.sourceAuthor}
                                                </span>
                                            )}
                                            {extractionSource && (
                                                <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 font-semibold rounded-full border border-cyan-200">
                                                    📎 {sourceLabel[extractionSource]} extract
                                                </span>
                                            )}
                                            {extractionStats && (
                                                <span className="px-1.5 py-0.5 bg-slate-50 text-slate-600 font-medium rounded-full border border-slate-200">
                                                    F:{extractionStats.formulas} · T:{extractionStats.theories} · Z:{extractionStats.tasks}
                                                </span>
                                            )}
                                            {extractionQuality && (
                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-full border border-emerald-200">
                                                    Quality: {extractionQuality.score}% ({extractionQuality.label})
                                                </span>
                                            )}
                                            {useSemanticSearch && typeof (m as ScoredMaterial).score === 'number' && (
                                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded-full border border-indigo-100" title="Семантичка сличност">
                                                    <Sparkles className="w-2.5 h-2.5" />
                                                    {Math.round((m as ScoredMaterial).score * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        {/* И3: Rating row (national view) */}
                                        {viewMode === 'national' && (() => {
                                            const avg = getAvgRating(m);
                                            const cnt = m.ratingsByUid ? Object.keys(m.ratingsByUid).length : 0;
                                            const myR = ratingState[m.id] ?? 0;
                                            const hover = ratingHover[m.id] ?? 0;
                                            return (
                                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                    <StarDisplay avg={avg} count={cnt} />
                                                    <div className="flex items-center gap-0.5">
                                                        <span className="text-xs text-gray-400 mr-1">Твоја:</span>
                                                        {[1, 2, 3, 4, 5].map(s => (
                                                            <button
                                                                key={s}
                                                                type="button"
                                                                title={`Оцени ${s} ⭐`}
                                                                onClick={() => handleRate(m.id, s)}
                                                                onMouseEnter={() => setRatingHover(p => ({ ...p, [m.id]: s }))}
                                                                onMouseLeave={() => setRatingHover(p => ({ ...p, [m.id]: 0 }))}
                                                                className="p-0.5 transition"
                                                            >
                                                                <Star className={`w-3.5 h-3.5 ${s <= (hover || myR) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'}`} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {m.publishedByName && (
                                                        <span className="text-xs text-gray-400">од <span className="font-semibold text-gray-600">{m.publishedByName}</span></span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                        {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {/* Preview button — always visible */}
                                        <button
                                            type="button"
                                            title="Прегледај содржина"
                                            onClick={() => setPreviewMaterial(m)}
                                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            Прегледај
                                        </button>
                                    </div>

                                    {/* Wave B3 — Floating action toolbar (appears on hover) */}
                                    {hoveredMaterialId === m.id && (
                                        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-30 animate-in fade-in duration-150">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-gray-600">Опции:</span>
                                                {renderQuickActions(m, isPublished)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                            </div>
                        );
                    })}

                    {viewMode === 'my' && hasMoreMaterials && (
                        <div className="flex justify-center pt-4 pb-2">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                            >
                                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {loadingMore ? 'Вчитување...' : 'Вчитај уште материјали'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Preview Modal */}
        {previewMaterial && (
            <PreviewModal material={previewMaterial} onClose={() => setPreviewMaterial(null)} />
        )}

        {/* Wave C1 — AI Tutor Modal */}
        {aiTutorMateriaId && materials.find(m => m.id === aiTutorMateriaId) && (
            <AITutorModal
              material={materials.find(m => m.id === aiTutorMateriaId)!}
              onClose={() => setAiTutorMaterialId(null)}
            />
        )}
        </>
    );
};

