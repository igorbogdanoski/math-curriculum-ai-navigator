import { useTour } from '../hooks/useTour';
import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import type { Topic, Grade, NationalStandard, Concept, SecondaryTrack } from '../types';
import { ModalType, SECONDARY_TRACK_LABELS } from '../types';
import { useModal } from '../contexts/ModalContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { exploreTourSteps } from '../tours/tour-steps';



import { MathRenderer } from '../components/common/MathRenderer';
import { QuickToolsPanel } from '../components/common/QuickToolsPanel';

const GradeSelector: React.FC<{
  grades: Grade[];
  selectedGradeId: string;
  onSelect: (id: string) => void;
}> = ({ grades, selectedGradeId, onSelect }) => (
  <div className="flex flex-col space-y-2">
    {grades.map((grade: Grade) => (
      <button
        key={grade.id}
        onClick={() => onSelect(grade.id)}
        className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-colors duration-200 ${
          selectedGradeId === grade.id
            ? 'bg-brand-primary text-white shadow-md'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        {grade.title}
      </button>
    ))}
  </div>
);

const TopicCard: React.FC<{ topic: Topic; onSelect: () => void }> = ({ topic, onSelect }) => (
  <Card
    onClick={onSelect}
    className="flex flex-col h-full group"
  >
    <div className="flex-shrink-0 mb-3">
      <ICONS.bookOpen className="w-8 h-8 text-brand-accent" />
    </div>
    <div className="flex-grow">
      <h3 className="text-xl font-bold text-brand-primary"><MathRenderer text={topic.title} /></h3>
      <p className="text-sm text-gray-600 mt-2 line-clamp-3"><MathRenderer text={topic.description} /></p>
    </div>
    <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500">{topic.concepts.length} поими</span>
        <span className="text-sm font-semibold text-brand-secondary opacity-0 group-hover:opacity-100 transition-opacity">
            Истражи &rarr;
        </span>
    </div>
  </Card>
);

export const ExploreView: React.FC = () => {
    const { curriculum, isLoading } = useCurriculum();
    const { showModal } = useModal();
    const { navigate } = useNavigation();
    useTour('explore', exploreTourSteps, !isLoading);
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedGradeId, setSelectedGradeId] = useState<string>('');
    // Track selector — '' = primary (I–IX), otherwise shows the secondary track grades
    const [selectedTrack, setSelectedTrack] = useState<SecondaryTrack | ''>('');
    const [secondaryData, setSecondaryData] = useState<Record<string, { curriculum: { grades: Grade[] } }> | null>(null);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
        return () => clearTimeout(t);
    }, [searchQuery]);

    // Lazy-load secondary curriculum only when user switches to a secondary track
    useEffect(() => {
        if (!selectedTrack) return;
        import('../data/secondaryCurriculum').then(({ secondaryCurriculumByTrack }) => {
            setSecondaryData(secondaryCurriculumByTrack);
        });
    }, [selectedTrack]);

    // Grades to display — primary or secondary track
    const activeGrades: Grade[] = useMemo(() => {
        if (selectedTrack) {
            return secondaryData?.[selectedTrack]?.curriculum.grades ?? [];
        }
        return curriculum?.grades ?? [];
    }, [curriculum, selectedTrack, secondaryData]);

    useEffect(() => {
        if (activeGrades.length > 0) {
            setSelectedGradeId(activeGrades[0].id);
        }
    }, [selectedTrack, curriculum]); // eslint-disable-line react-hooks/exhaustive-deps
    
    const handleGradeSelect = (id: string) => {
        setSelectedGradeId(id);
        setSearchQuery(''); // Reset search
    };

    const selectedGrade = useMemo(() =>
        activeGrades.find((g: Grade) => g.id === selectedGradeId)
    , [activeGrades, selectedGradeId]);
    
    const handleShowTransversal = (standards: NationalStandard[], gradeTitle: string) => {
        showModal(ModalType.TransversalStandards, { standards, gradeTitle });
    };

    const filteredTopics = useMemo(() => {
        if (!selectedGrade) return [];
        const lowercasedQuery = debouncedQuery.toLowerCase().trim();
        if (!lowercasedQuery) return selectedGrade.topics;
        
        // Return topics if the topic title matches OR if any of its concepts match
        return selectedGrade.topics.filter((topic: Topic) => 
            topic.title.toLowerCase().includes(lowercasedQuery) ||
            topic.concepts.some((concept: Concept) => 
                concept.title.toLowerCase().includes(lowercasedQuery) || 
                concept.description.toLowerCase().includes(lowercasedQuery)
            )
        );
    }, [selectedGrade, searchQuery]);
    
    if (isLoading) {
        return (
             <div className="p-8">
                <header className="mb-8 animate-pulse">
                    <div className="h-10 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2 mt-2"></div>
                </header>
                <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
        );
    }
    
    if (!curriculum) {
        return <div className="p-8 text-center"><h2 className="text-2xl font-bold text-red-600">Наставната програма не можеше да се вчита.</h2></div>;
    }

    return (
        <div className="flex flex-col md:flex-row h-full">
            {/* Left Column: Track + Grade Selector */}
            <div data-tour="explore-grade-selector" className="w-full md:w-64 p-4 bg-white border-b md:border-b-0 md:border-r flex-shrink-0 flex flex-col gap-3">
                {/* ── Track selector ── */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">Ниво на образование</p>
                  <div className="flex flex-col gap-1">
                    {([
                      { id: '' as const, label: '🏫 Основно (I–IX)' },
                      { id: 'gymnasium' as SecondaryTrack, label: `🎓 ${SECONDARY_TRACK_LABELS.gymnasium}` },
                      { id: 'gymnasium_elective' as SecondaryTrack, label: `📐 ${SECONDARY_TRACK_LABELS.gymnasium_elective}` },
                      { id: 'vocational4' as SecondaryTrack, label: `🔧 ${SECONDARY_TRACK_LABELS.vocational4}` },
                      { id: 'vocational3' as SecondaryTrack, label: `🔧 ${SECONDARY_TRACK_LABELS.vocational3}` },
                      { id: 'vocational2' as SecondaryTrack, label: `🔧 ${SECONDARY_TRACK_LABELS.vocational2}` },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedTrack(id)}
                        className={`text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTrack === id
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'text-gray-600 hover:bg-blue-50 hover:text-brand-primary'
                        }`}
                      >
                        {label}
                        {(id === 'vocational4' || id === 'vocational3') && (
                          <span className="ml-1 text-[9px] opacity-70">(БЕТА)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* ── Grade list ── */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">Одделение / Година</p>
                  <div className="md:hidden">
                      <label htmlFor="grade-select-mobile" className="sr-only">Избери одделение</label>
                      <div className="relative">
                          <select
                              id="grade-select-mobile"
                              value={selectedGradeId}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleGradeSelect(e.target.value)}
                              className="w-full appearance-none bg-brand-primary text-white font-semibold px-4 py-3 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                          >
                              {activeGrades.map((grade: Grade) => (
                                  <option key={grade.id} value={grade.id}>{grade.title}</option>
                              ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                              <ICONS.chevronDown className="w-4 h-4 text-white" />
                          </div>
                      </div>
                  </div>
                  <div className="hidden md:block">
                      <GradeSelector grades={activeGrades} selectedGradeId={selectedGradeId} onSelect={handleGradeSelect} />
                  </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                 <header className="mb-6">
                     <div data-tour="explore-header" className="flex justify-between items-center">
                        <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">{selectedGrade?.title}</h1>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {selectedGrade?.transversalStandards && (
                                <button
                                    type="button"
                                    onClick={() => handleShowTransversal(selectedGrade.transversalStandards ?? [], selectedGrade.title)}
                                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded-full"
                                >
                                    Трансверзални компетенции
                                </button>
                            )}
                            {filteredTopics.length > 0 && (
                                <button
                                    type="button"
                                    title="Визуализирај покриеност по теми во DataViz Studio"
                                    onClick={() => {
                                        sessionStorage.setItem('dataviz_import', JSON.stringify({
                                            tableData: {
                                                headers: ['Тема', 'Поими'],
                                                rows: filteredTopics.map((t: Topic) => [t.title.slice(0, 28), t.concepts.length]),
                                            },
                                            config: {
                                                title: `Покриеност — ${selectedGrade?.title ?? ''}`,
                                                xLabel: 'Тема',
                                                yLabel: 'Број на поими',
                                                type: 'bar',
                                            },
                                        }));
                                        navigate('/data-viz');
                                    }}
                                    className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-semibold px-3 py-1 rounded-full flex items-center gap-1"
                                >
                                    📊 DataViz
                                </button>
                            )}
                        </div>
                    </div>
                    <div data-tour="explore-search" className="mt-4">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3"><ICONS.search className="w-5 h-5 text-gray-400" /></span>
                            <input
                                type="text"
                                aria-label="Пребарај теми или поими"
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                placeholder="Пребарај теми или поими..."
                                className="w-full pl-10 pr-10 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                    aria-label="Исчисти пребарување"
                                >
                                    <ICONS.close className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {searchQuery.trim() && (
                            <p className="mt-2 text-sm text-gray-500">
                                Пронајдени <span className="font-semibold text-brand-primary">{filteredTopics.length}</span> {filteredTopics.length === 1 ? 'тема' : 'теми'}
                            </p>
                        )}
                    </div>
                </header>

                <div data-tour="explore-topics-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in-up">
                    {filteredTopics.length > 0 ? (
                        filteredTopics.map((topic: Topic) => (
                            <TopicCard key={topic.id} topic={topic} onSelect={() => navigate(`/topic/${topic.id}`)} />
                        ))
                    ) : searchQuery.trim() ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                            <ICONS.search className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-xl font-semibold text-gray-600">Нема резултати за „{searchQuery}"</p>
                            <p className="text-gray-400 mt-2 text-sm">Обиди се со друг поим или тема.</p>
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="mt-4 text-sm font-semibold text-brand-primary hover:underline"
                            >
                                Исчисти пребарување
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>

            {selectedGrade && (
                <QuickToolsPanel
                    gradeId={selectedGrade.id}
                    topicId={selectedGrade.topics?.[0]?.id ?? ''}
                    conceptIds={selectedGrade.topics?.flatMap((t: Topic) => t.concepts?.map((c: Concept) => c.id) ?? []) ?? []}
                    gradeName={selectedGrade.title}
                    topicName={selectedGrade.topics?.[0]?.title ?? selectedGrade.title}
                />
            )}
        </div>
    );
};