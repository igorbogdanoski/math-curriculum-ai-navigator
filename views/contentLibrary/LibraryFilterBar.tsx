import React from 'react';
import type { CachedMaterial } from '../../services/firestoreService';
import type { ExtractionSource } from './contentLibraryHelpers';

interface LibraryFilterBarProps {
    typeFilter: CachedMaterial['type'] | 'all';
    setTypeFilter: (v: CachedMaterial['type'] | 'all') => void;
    gradeFilter: 'all' | number;
    setGradeFilter: (v: 'all' | number) => void;
    gradeOptions: number[];
    topicFilter: string;
    setTopicFilter: (v: string) => void;
    topicOptions: string[];
    dokFilter: 'all' | number;
    setDokFilter: (v: 'all' | number) => void;
    dokOptions: number[];
    difficultyFilter: string;
    setDifficultyFilter: (v: string) => void;
    difficultyOptions: string[];
    formatDifficultyLabel: (value: string) => string;
    sortBy: 'newest' | 'oldest' | 'title' | 'rating';
    setSortBy: (v: 'newest' | 'oldest' | 'title' | 'rating') => void;
    sourceFilter: 'all' | ExtractionSource;
    setSourceFilter: (v: 'all' | ExtractionSource) => void;
    viewMode: 'my' | 'national' | 'archive';
    minRating: number;
    setMinRating: (v: number) => void;
    onReset: () => void;
}

export const LibraryFilterBar: React.FC<LibraryFilterBarProps> = ({
    typeFilter, setTypeFilter,
    gradeFilter, setGradeFilter, gradeOptions,
    topicFilter, setTopicFilter, topicOptions,
    dokFilter, setDokFilter, dokOptions,
    difficultyFilter, setDifficultyFilter, difficultyOptions, formatDifficultyLabel,
    sortBy, setSortBy,
    sourceFilter, setSourceFilter,
    viewMode,
    minRating, setMinRating,
    onReset,
}) => {
    return (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Advanced Filters</span>
                <span className="text-[11px] text-slate-400">тип / одделение / тема / DoK / тежина / сортирање</span>
                <button
                    type="button"
                    onClick={onReset}
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
    );
};
