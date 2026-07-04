import React from 'react';
import {
    Globe, Lock, Trash2, Edit3, Check, X, Users, Sparkles,
    Archive, ArchiveRestore, Star, Loader2, Eye, Zap, Link,
} from 'lucide-react';
import type { CachedMaterial } from '../../services/firestoreService';
import { Card } from '../../components/common/Card';
import {
    type ScoredMaterial,
    getAvgRating,
    getExtractionSource,
    getExtractionBundleStats,
    getExtractionQuality,
    sourceLabel,
    typeLabel,
    typeColor,
} from './contentLibraryHelpers';
import { StarDisplay } from './StarDisplay';

interface MaterialListItemProps {
    material: CachedMaterial;
    viewMode: 'my' | 'national' | 'archive';
    editingId: string | null;
    editTitle: string;
    setEditingId: (id: string | null) => void;
    setEditTitle: (v: string) => void;
    onSaveTitle: (id: string) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    hoveredMaterialId: string | null;
    onHoverStart: (id: string) => void;
    onHoverEnd: () => void;
    useSemanticSearch: boolean;
    ratingState: Record<string, number>;
    ratingHover: Record<string, number>;
    onRate: (id: string, rating: number) => void;
    setRatingHover: (updater: (p: Record<string, number>) => Record<string, number>) => void;
    forkingId: string | null;
    onFork: (m: CachedMaterial) => void;
    onPublish: (m: CachedMaterial) => void;
    onUnpublish: (m: CachedMaterial) => void;
    onArchive: (m: CachedMaterial) => void;
    onRestore: (m: CachedMaterial) => void;
    onDeleteForever: (id: string) => void;
    onPreview: (m: CachedMaterial) => void;
    onShareLink: (m: CachedMaterial) => void;
    onOpenAiTutor: (id: string) => void;
    onGenerateFromMaterial: (m: CachedMaterial) => void;
    onNavigateFlashcards: (id: string) => void;
    formatDate: (ts: any) => string;
}

export const MaterialListItem: React.FC<MaterialListItemProps> = ({
    material: m,
    viewMode,
    editingId, editTitle, setEditingId, setEditTitle, onSaveTitle,
    selectedIds, onToggleSelect,
    hoveredMaterialId, onHoverStart, onHoverEnd,
    useSemanticSearch,
    ratingState, ratingHover, onRate, setRatingHover,
    forkingId, onFork, onPublish, onUnpublish, onArchive, onRestore, onDeleteForever,
    onPreview, onShareLink, onOpenAiTutor, onGenerateFromMaterial, onNavigateFlashcards,
    formatDate,
}) => {
    const isPublished = m.status === 'published';
    const isEditing = editingId === m.id;
    const isSelected = selectedIds.has(m.id);
    const extractionSource = getExtractionSource(m);
    const extractionStats = getExtractionBundleStats(m);
    const extractionQuality = getExtractionQuality(m);

    const renderQuickActions = () => (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* Wave C1 — AI Tutor button (always available) */}
            <button
                type="button"
                title="Ask AI Tutor about this material"
                onClick={() => onOpenAiTutor(m.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
            >
                <Sparkles className="w-3.5 h-3.5" />
                Tutor
            </button>
            {/* Share link — quiz, outline, thematicplan */}
            {(['quiz', 'outline', 'thematicplan'] as CachedMaterial['type'][]).includes(m.type) && (
                <button
                    type="button"
                    title="Копирај јавен линк за споделување"
                    onClick={() => onShareLink(m)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition"
                >
                    <Link className="w-3.5 h-3.5" />
                    Сподели
                </button>
            )}

            {/* Generate with AI — opens generator panel pre-filled with material context */}
            {viewMode === 'my' && (
                <button
                    type="button"
                    title="Генерирај квиз, тест или флешкартички од овој материјал"
                    onClick={() => onGenerateFromMaterial(m)}
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
                    onClick={() => onNavigateFlashcards(m.id)}
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
                        onClick={() => onFork(m)}
                        disabled={forkingId === m.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                    >
                        {forkingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🍴'}
                        Форкај
                    </button>
                </>
            ) : viewMode === 'archive' ? (
                <>
                    <button type="button" onClick={() => onRestore(m)} title="Врати во библиотеката" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        <ArchiveRestore className="w-3.5 h-3.5" />Врати
                    </button>
                    <button type="button" onClick={() => onDeleteForever(m.id)} title="Избриши засекогаш" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </>
            ) : (
                <>
                    {isPublished ? (
                        <button type="button" onClick={() => onUnpublish(m)} title="Врати на нацрт" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                            <Lock className="w-3.5 h-3.5" />Нацрт
                        </button>
                    ) : (
                        <button type="button" onClick={() => onPublish(m)} title="Публикувај за ученици" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700">
                            <Globe className="w-3.5 h-3.5" />Публикувај
                        </button>
                    )}
                    <button type="button" onClick={() => onArchive(m)} title="Архивирај (скриј од библиотеката)" className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg">
                        <Archive className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );

    return (
        <div
            onMouseEnter={() => onHoverStart(m.id)}
            onMouseLeave={onHoverEnd}
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
                        onChange={() => onToggleSelect(m.id)}
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
                                onKeyDown={e => { if (e.key === 'Enter') onSaveTitle(m.id); if (e.key === 'Escape') setEditingId(null); }}
                                className="flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <button type="button" title="Зачувај наслов" onClick={() => onSaveTitle(m.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
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
                                            onClick={() => onRate(m.id, s)}
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
                        onClick={() => onPreview(m)}
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
                            {renderQuickActions()}
                        </div>
                    </div>
                )}
            </div>
        </Card>
        </div>
    );
};
