import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { usePlanner } from '../../contexts/PlannerContext';
import { ICONS } from '../../constants';
import type { Topic, LessonPlan, NationalStandard, Grade, Concept } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';

interface SearchResult {
    id: string;
    title: string;
    type: 'concept' | 'topic' | 'lesson' | 'standard';
    path: string;
    description: string;
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
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | SearchResult['type']>('all');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    
    const { allConcepts, curriculum, allNationalStandards } = useCurriculum();
    const { lessonPlans } = usePlanner();
    const searchRef = useRef<HTMLDivElement>(null);
    const resultListRef = useRef<HTMLUListElement>(null);

    const allTopics = curriculum?.grades.flatMap((g: Grade) => g.topics.map((t: Topic) => ({ ...t, gradeLevel: g.level }))) ?? [];

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
        Object.entries(groupedResults).forEach(([_, groupResults]) => {
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
                        type: 'concept',
                        path: `/concept/${c.id}`,
                        description: `${c.gradeLevel}. Одделение`
                    }));

                const topicResults: SearchResult[] = allTopics
                    .filter((t: Topic & { gradeLevel: number }) => 
                        t.title.toLowerCase().includes(lowerCaseQuery) ||
                        t.description.toLowerCase().includes(lowerCaseQuery)
                    )
                    .map((t: Topic & { gradeLevel: number }) => ({
                        id: t.id,
                        title: t.title,
                        type: 'topic',
                        path: `/topic/${t.id}`,
                        description: `${t.gradeLevel}. Одделение`
                    }));

                const lessonResults: SearchResult[] = lessonPlans
                    .filter((p: LessonPlan) => 
                        p.title.toLowerCase().includes(lowerCaseQuery) ||
                        p.objectives.join(' ').toLowerCase().includes(lowerCaseQuery)
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

    const handleResultClick = (path: string) => {
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
                    type="text"
                    value={query}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    onFocus={() => query.trim().length > 1 && setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Пребарај низ целата апликација (поими, теми, подготовки, стандарди)..."
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
                    
                    {flatResults.length > 0 ? (
                        <ul className="overflow-y-auto" id="search-results" role="listbox" ref={resultListRef}>
                            {Object.entries(groupedResults).map(([type, groupResults]) => (
                                <React.Fragment key={type}>
                                    <li className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0 border-b border-gray-100">
                                        {typeLabels[type as SearchResult['type']]}
                                    </li>
                                    {(groupResults as SearchResult[]).slice(0, 10).map((result, idx) => {
                                        // Find absolute index in flattened list for highlighting
                                        const absoluteIndex = flatResults.findIndex((r: SearchResult) => r === result);
                                        const isFocused = absoluteIndex === focusedIndex;
                                        
                                        return (
                                            <li 
                                                key={`${result.type}-${result.id}`}
                                                role="option"
                                                id={`result-${result.id}`}
                                                aria-selected={isFocused}
                                                className={`border-b last:border-b-0 border-gray-50 ${isFocused ? 'bg-blue-50' : ''}`}
                                            >
                                                <a
                                                    href={`#${result.path}`}
                                                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); handleResultClick(result.path); }}
                                                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none"
                                                >
                                                    <p className="font-semibold truncate pr-2 flex items-center">
                                                        {isFocused && <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full mr-2 inline-block"></span>}
                                                        {result.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 pl-3.5">{result.description}</p>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </ul>
                    ) : (
                         <div className="p-4 text-center text-sm text-gray-500">
                            Нема резултати за "{query}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};