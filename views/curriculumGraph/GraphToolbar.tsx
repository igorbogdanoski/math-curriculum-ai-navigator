import React from 'react';
import { Card } from '../../components/common/Card';
import { ICONS } from '../../constants';
import type { Grade } from '../../types';
import { STRANDS, GRADE_COLORS } from './graphUtils';
import type { EnrichedConcept } from './graphUtils';

interface GraphToolbarProps {
    curriculum: { grades: Grade[] } | null;
    selectedGrades: number[];
    setSelectedGrades: React.Dispatch<React.SetStateAction<number[]>>;
    focusNodeId: string | null;
    layoutMode: 'organic' | 'hierarchical';
    setLayoutMode: React.Dispatch<React.SetStateAction<'organic' | 'hierarchical'>>;
    selectedStrand: string | null;
    setSelectedStrand: (s: string | null) => void;
    isClustered: boolean;
    setIsClustered: React.Dispatch<React.SetStateAction<boolean>>;
    showMasteryOverlay: boolean;
    setShowMasteryOverlay: React.Dispatch<React.SetStateAction<boolean>>;
    masteryLoading: boolean;
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    searchResults: EnrichedConcept[];
    onSearchSelect: (id: string) => void;
}

export function GraphToolbar({
    curriculum, selectedGrades, setSelectedGrades, focusNodeId,
    layoutMode, setLayoutMode, selectedStrand, setSelectedStrand,
    isClustered, setIsClustered, showMasteryOverlay, setShowMasteryOverlay,
    masteryLoading, searchQuery, setSearchQuery, searchResults, onSearchSelect,
}: GraphToolbarProps) {

    const handleGradeToggle = (gradeLevel: number) => {
        if (focusNodeId) return;
        setSelectedGrades(prev =>
            prev.includes(gradeLevel) ? prev.filter(g => g !== gradeLevel) : [...prev, gradeLevel]
        );
    };

    return (
        <Card className="mb-4 flex-shrink-0 overflow-visible z-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className={`flex flex-wrap items-center gap-4 ${focusNodeId ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                if (!curriculum || focusNodeId) return;
                                const allLevels = curriculum.grades.map((g: Grade) => g.level);
                                setSelectedGrades(prev =>
                                    prev.length === allLevels.length ? [6] : allLevels
                                );
                            }}
                            disabled={!!focusNodeId}
                            className={`px-3 py-1 text-xs font-bold rounded-full border-2 transition-all duration-200 ${
                                curriculum && selectedGrades.length === curriculum.grades.length
                                    ? 'bg-slate-700 text-white border-slate-700'
                                    : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'
                            }`}
                            title="Избери / одбери ги сите одделенија"
                        >
                            {curriculum && selectedGrades.length === curriculum.grades.length ? '✕ Сите' : '✓ Сите'}
                        </button>
                        <div className="w-px h-5 bg-gray-300" />
                        {curriculum?.grades.map((grade: Grade) => (
                            <button
                                key={grade.level}
                                type="button"
                                onClick={() => handleGradeToggle(grade.level)}
                                disabled={!!focusNodeId}
                                className={`px-3 py-1 text-sm font-semibold rounded-full transition-all duration-200 border-2 ${
                                    selectedGrades.includes(grade.level)
                                        ? 'text-white border-transparent shadow-md'
                                        : 'text-gray-700 bg-gray-100 border-gray-100 hover:border-gray-300'
                                }`}
                                style={{ backgroundColor: selectedGrades.includes(grade.level) ? GRADE_COLORS[grade.level] : undefined }}
                            >
                                {grade.level}. одд.
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block" />

                    {/* Layout Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button type="button"
                            onClick={() => setLayoutMode('organic')}
                            className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                layoutMode === 'organic'
                                ? 'bg-white text-brand-primary shadow-sm border border-gray-200'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <ICONS.share className="w-3 h-3" /> Органски
                        </button>
                        <button type="button"
                            onClick={() => setLayoutMode('hierarchical')}
                            className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                                layoutMode === 'hierarchical'
                                ? 'bg-white text-brand-primary shadow-sm border border-gray-200'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <ICONS.gitBranch className="w-3 h-3 rotate-90" /> Прогресија
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block" />

                    {/* Strand Filter */}
                    <div className="flex items-center">
                        <select
                            value={selectedStrand || ''}
                            onChange={(e) => setSelectedStrand(e.target.value || null)}
                            disabled={!!focusNodeId}
                            aria-label="Филтер по подрачје"
                            className={`bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-brand-primary focus:border-brand-primary block w-32 md:w-40 p-1.5 ${focusNodeId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Сите Подрачја</option>
                            {STRANDS.map(strand => (
                                <option key={strand.id} value={strand.id}>{strand.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block" />

                    <button type="button"
                        onClick={() => setIsClustered(v => !v)}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 border ${
                            isClustered
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <ICONS.menu className="w-4 h-4" />
                        {isClustered ? 'Групирано по Теми' : 'Детален приказ (Поими)'}
                    </button>

                    <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block" />

                    <button type="button"
                        onClick={() => setShowMasteryOverlay(v => !v)}
                        disabled={!!focusNodeId}
                        title="Прикажи ги поимите обоени според просечниот резултат на твоите ученици"
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 border ${
                            showMasteryOverlay
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } ${focusNodeId ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        {masteryLoading
                            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <ICONS.activity className="w-4 h-4" />}
                        {showMasteryOverlay ? 'Мастери ON' : 'Прикажи Мастери'}
                    </button>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ICONS.search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                        placeholder="Пронајди поим во графот..."
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                    {searchResults.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {searchResults.map((result: EnrichedConcept) => (
                                <li
                                    key={result.id}
                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 text-gray-900"
                                    onClick={() => onSearchSelect(result.id)}
                                >
                                    <span className="block truncate font-medium">{result.title}</span>
                                    <span className="block truncate text-xs text-gray-500">{result.gradeLevel}. одд</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Card>
    );
}
