import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Wand2 } from 'lucide-react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { usePlanner } from '../../contexts/PlannerContext';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { ICONS } from '../../constants';
import type { Topic, LessonPlan, NationalStandard, Grade, Concept } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';

const RECENT_KEY = 'gsb_recent';
const MAX_RECENT = 5;

function loadRecent(): string[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function saveRecent(terms: string[]) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
}

interface SearchResult {
    id: string;
    title: string;
    type: 'concept' | 'topic' | 'lesson' | 'standard';
    path: string;
    description: string;
    // For quick-generate action
    gradeId?: string;
    topicId?: string;
    conceptId?: string;
}

/** Convert curriculum grade level to short display label */
function gradeLabel(level: number): string {
    const gymNums = ['I', 'II', 'III', 'IV'];
    return level >= 10
        ? `${gymNums[level - 10] ?? String(level - 9)} год. гимназија`
        : `${level}. Одд.`;
}

const typeLabels: Record<SearchResult['type'], string> = {
    concept: 'Поими',
    topic: 'Теми',
    lesson: 'Подготовки',
    standard: 'Стандарди'
};

const filterOptions: { id: SearchResult['type'] | 'all', label: string }[] = [
    { id: 'all', label: 'Сите' },
    { id: 'concept', label: 'Поими' },
    { id: 'topic', label: 'Теми' },
    { id: 'lesson', label: 'Подготовки' },
    { id: 'standard', label: 'Стандарди' },
];

export const GlobalSearchBar: React.FC = () => {
    const { navigate } = useNavigation();
    const { openGeneratorPanel } = useGeneratorPanel();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | SearchResult['type']>('all');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);

    const { allConcepts, curriculum, allNationalStandards } = useCurriculum();
    const { lessonPlans } = usePlanner();
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef   = useRef<HTMLInputElement>(null);
    const resultListRef = useRef<HTMLUListElement>(null);

    // Grade ID lookup map: level → id
    const gradeLevelToId = useMemo(() => {
        const map = new Map<number, string>();
        curriculum?.grades?.forEach((g: Grade) => map.set(g.level, g.id));
        return map;
    }, [curriculum]);

    const allTopics = (curriculum?.grades || []).flatMap((g: Grade) => g.topics.map((t: Topic) => ({ ...t, gradeLevel: g.level }))) ?? [];

    // Calculate grouped and flattened results for keyboard navigation
    const groupedResults = useMemo(() => {
        return results.reduce((acc: Record<SearchResult['type'], SearchResult[]>, result: SearchResult) => {
            const type = result.type;
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(result);
            return acc;
        }, {} as Record<SearchResult['type'], SearchResult[]>);
    }, [results]);

    // Flatten grouped results for indexing
    const flatResults = useMemo(() => {
        const flat: SearchResult[] = [];
        Object.entries(groupedResults || {}).forEach(([_, groupResults]) => {
            flat.push(...(groupResults as SearchResult[]).slice(0, 10));
        });
        return flat;
    }, [groupedResults]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (query.trim().length > 1) {
                const lowerCaseQuery = query.toLowerCase();
                
                const conceptResults: SearchResult[] = allConcepts
                    .filter((c: Concept & { gradeLevel: number; topicId: string }) =>
                        c.title.toLowerCase().includes(lowerCaseQuery) ||
                        c.description.toLowerCase().includes(lowerCaseQuery)
                    )
                    .map((c: Concept & { gradeLevel: number; topicId: string }) => ({
                        id: c.id,
                        title: c.title,
                        type: 'concept' as const,
                        path: `/concept/${c.id}`,
                        description: gradeLabel(c.gradeLevel),
                        gradeId: gradeLevelToId.get(c.gradeLevel),
                        topicId: c.topicId,
                        conceptId: c.id,
                    }));

                const topicResults: SearchResult[] = allTopics
                    .filter((t: Topic & { gradeLevel: number }) =>
                        t.title.toLowerCase().includes(lowerCaseQuery) ||
                        t.description?.toLowerCase().includes(lowerCaseQuery)
                    )
                    .map((t: Topic & { gradeLevel: number }) => ({
                        id: t.id,
                        title: t.title,
                        type: 'topic' as const,
                        path: `/topic/${t.id}`,
                        description: gradeLabel(t.gradeLevel),
                        gradeId: gradeLevelToId.get(t.gradeLevel),
                        topicId: t.id,
                    }));

                const lessonResults: SearchResult[] = lessonPlans
                    .filter((p: LessonPlan) => 
                        p.title.toLowerCase().includes(lowerCaseQuery) ||
                        p.objectives?.map((o: any) => typeof o === 'string' ? o : o.text).join(' ').toLowerCase().includes(lowerCaseQuery)
                    )
                    .map((p: LessonPlan) => ({
                        id: p.id,
                        title: p.title,
                        type: 'lesson',
                        path: `/planner/lesson/view/${p.id}`,
                        description: `Моја подготовка`
                    }));

                const standardResults: SearchResult[] = (allNationalStandards || [])
                    .filter((s: NationalStandard) => 
                        s.code.toLowerCase().includes(lowerCaseQuery) ||
                        s.description.toLowerCase().includes(lowerCaseQuery)
                    )
                    .map((s: NationalStandard) => ({
                        id: s.id,
                        title: s.description,
                        type: 'standard',
                        path: `/generator?contextType=STANDARD&standardId=${s.id}`,
                        description: `Национален стандард: ${s.code} (${s.gradeLevel}. одд)`
                    }));
                
                const allResults = [...lessonResults, ...conceptResults, ...topicResults, ...standardResults];

                const filtered = activeFilter === 'all' 
                    ? allResults
                    : allResults.filter(r => r.type === activeFilter);
                
                setResults(filtered);
                setIsOpen(true);
                setFocusedIndex(-1); // Reset focus on new search
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300); // Debounce delay

        return () => {
            clearTimeout(handler);
        };
    }, [query, allConcepts, allTopics, lessonPlans, allNationalStandards, activeFilter]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Ctrl+K / Cmd+K → focus search from anywhere
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    useEffect(() => {
        // Scroll focused item into view
        if (isOpen && resultListRef.current && focusedIndex >= 0) {
            const focusedElement = resultListRef.current.children[0]?.querySelectorAll('li[role="option"]')[focusedIndex] as HTMLElement;
            if (focusedElement) {
                focusedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || flatResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex((prev: number) => (prev + 1) % flatResults.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex((prev: number) => (prev - 1 + flatResults.length) % flatResults.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < flatResults.length) {
                    handleResultClick(flatResults[focusedIndex].path);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const addToRecent = useCallback((term: string) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        setRecentSearches(prev => {
            const updated = [trimmed, ...prev.filter(r => r !== trimmed)].slice(0, MAX_RECENT);
            saveRecent(updated);
            return updated;
        });
    }, []);

    const removeRecent = useCallback((term: string) => {
        setRecentSearches(prev => {
            const updated = prev.filter(r => r !== term);
            saveRecent(updated);
            return updated;
        });
    }, []);

    const clearRecent = useCallback(() => {
        saveRecent([]);
        setRecentSearches([]);
    }, []);

    const handleResultClick = (path: string) => {
        if (query.trim().length > 1) addToRecent(query);
        navigate(path);
        setQuery('');
        setIsOpen(false);
    };
    
    return (
        <div className="relative w-full" ref={searchRef}>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <ICONS.search className="w-5 h-5 text-gray-400" />
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim().length > 1) setIsOpen(true);
                        else if (recentSearches.length > 0) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Пребарај… (Ctrl+K)"
                    aria-label="Пребарај низ целата апликација"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    aria-expanded={isOpen}
                    aria-controls="search-results"
                    aria-activedescendant={focusedIndex >= 0 ? `result-${flatResults[focusedIndex]?.id}` : undefined}
                />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-[70vh] flex flex-col z-30">
                    <div className="p-2 border-b flex flex-wrap items-center gap-2">
                        {filterOptions.map(filter => (
                            <button
                                key={filter.id}
                                onClick={() => { setActiveFilter(filter.id); setFocusedIndex(-1); }}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                    activeFilter === filter.id 
                                        ? 'bg-brand-primary text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    
                    {/* Recent searches — shown when query is empty */}
                    {query.trim().length <= 1 && recentSearches.length > 0 && (
                        <div className="py-2">
                            <div className="flex items-center justify-between px-4 py-1.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Последни пребарувања</span>
                                <button
                                    type="button"
                                    onClick={clearRecent}
                                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    Избриши сите
                                </button>
                            </div>
                            {recentSearches.map(term => (
                                <div key={term} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 group">
                                    <ICONS.search className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                    <button
                                        type="button"
                                        className="flex-1 text-left text-sm text-gray-700 truncate"
                                        onClick={() => { setQuery(term); setIsOpen(true); }}
                                    >
                                        {term}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Отстрани "${term}" од историјата`}
                                        onClick={() => removeRecent(term)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-red-500"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {flatResults.length > 0 ? (
                        <ul className="overflow-y-auto" id="search-results" role="listbox" ref={resultListRef}>
                            {Object.entries(groupedResults).map(([type, groupResults]) => (
                                <React.Fragment key={type}>
                                    <li className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0 border-b border-gray-100">
                                        {typeLabels[type as SearchResult['type']]}
                                    </li>
                                    {(groupResults as SearchResult[]).slice(0, 10).map((result) => {
                                        const absoluteIndex = flatResults.findIndex((r: SearchResult) => r === result);
                                        const isFocused = absoluteIndex === focusedIndex;
                                        return (
                                            <li
                                                key={`${result.type}-${result.id}`}
                                                role="option"
                                                id={`result-${result.id}`}
                                                aria-selected={isFocused}
                                                className={`border-b last:border-b-0 border-gray-50 group ${isFocused ? 'bg-blue-50' : ''}`}
                                            >
                                                <div className="flex items-center gap-1 pr-2">
                                                    <a
                                                        href={`#${result.path}`}
                                                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); handleResultClick(result.path); }}
                                                        className="flex-1 block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none min-w-0"
                                                    >
                                                        <p className="font-semibold truncate pr-2 flex items-center">
                                                            {isFocused && <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full mr-2 inline-block flex-shrink-0"></span>}
                                                            {result.title}
                                                        </p>
                                                        <p className="text-xs text-gray-500 pl-3.5">{result.description}</p>
                                                    </a>
                                                    {(result.type === 'concept' || result.type === 'topic') && result.gradeId && result.topicId && (
                                                        <button
                                                            type="button"
                                                            title="Генерирај материјал за ова"
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                openGeneratorPanel({
                                                                    selectedGrade: result.gradeId,
                                                                    selectedTopic: result.topicId,
                                                                    selectedConcepts: result.conceptId ? [result.conceptId] : [],
                                                                    contextType: result.conceptId ? 'CONCEPT' : 'ACTIVITY',
                                                                });
                                                                setIsOpen(false);
                                                                setQuery('');
                                                            }}
                                                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Wand2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </ul>
                    ) : query.trim().length > 1 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                            Нема резултати за „{query}"
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};