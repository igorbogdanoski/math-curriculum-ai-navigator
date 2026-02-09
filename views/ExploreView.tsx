import React, { useState, useMemo, useEffect } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import type { Topic, Grade, NationalStandard } from '../types';
import { ModalType } from '../types';
import { useModal } from '../contexts/ModalContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { exploreTourSteps } from '../tours/tour-steps';

declare var introJs: any;

import { MathRenderer } from '../components/common/MathRenderer';

const GradeSelector: React.FC<{
  grades: Grade[];
  selectedGradeId: string;
  onSelect: (id: string) => void;
}> = ({ grades, selectedGradeId, onSelect }) => (
  <div className="flex flex-col space-y-2">
    {grades.map(grade => (
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
    className="flex flex-col h-full group hover:scale-105 hover:shadow-xl"
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
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGradeId, setSelectedGradeId] = useState<string>('');

    useEffect(() => {
        if (toursSeen.explore === true || typeof introJs === 'undefined' || isLoading || !curriculum) return;

        const timer = setTimeout(() => {
            const tour = introJs();
            tour.setOptions({
                steps: exploreTourSteps,
                showProgress: true,
                showBullets: true,
                showStepNumbers: true,
                nextLabel: 'Следно',
                prevLabel: 'Претходно',
                doneLabel: 'Готово',
            });
            tour.oncomplete(() => markTourAsSeen('explore'));
            tour.onexit(() => markTourAsSeen('explore'));
            tour.start();
        }, 500);

        return () => clearTimeout(timer);
    }, [toursSeen, markTourAsSeen, isLoading, curriculum]);

    useEffect(() => {
        if (curriculum && curriculum.grades.length > 0 && !selectedGradeId) {
            setSelectedGradeId(curriculum.grades[0].id);
        }
    }, [curriculum, selectedGradeId]);
    
    const handleGradeSelect = (id: string) => {
        setSelectedGradeId(id);
        setSearchQuery(''); // Reset search
    };

    const selectedGrade = useMemo(() => 
        curriculum?.grades.find(g => g.id === selectedGradeId)
    , [curriculum, selectedGradeId]);
    
    const handleShowTransversal = (standards: NationalStandard[], gradeTitle: string) => {
        showModal(ModalType.TransversalStandards, { standards, gradeTitle });
    };

    const filteredTopics = useMemo(() => {
        if (!selectedGrade) return [];
        const lowercasedQuery = searchQuery.toLowerCase().trim();
        if (!lowercasedQuery) return selectedGrade.topics;
        
        // Return topics if the topic title matches OR if any of its concepts match
        return selectedGrade.topics.filter(topic => 
            topic.title.toLowerCase().includes(lowercasedQuery) ||
            topic.concepts.some(concept => 
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
            {/* Left Column: Grade Selector */}
            <div data-tour="explore-grade-selector" className="w-full md:w-64 p-4 bg-white border-b md:border-b-0 md:border-r flex-shrink-0">
                <h2 className="text-xl font-bold text-brand-primary mb-4 px-2 hidden md:block">Одделенија</h2>
                <div className="md:hidden">
                     <label htmlFor="grade-select-mobile" className="sr-only">Избери одделение</label>
                        <select
                            id="grade-select-mobile"
                            value={selectedGradeId}
                            onChange={(e) => handleGradeSelect(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                        >
                            {curriculum.grades.map(grade => (
                                <option key={grade.id} value={grade.id}>{grade.title}</option>
                            ))}
                        </select>
                </div>
                <div className="hidden md:block">
                    <GradeSelector grades={curriculum.grades} selectedGradeId={selectedGradeId} onSelect={handleGradeSelect} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                 <header className="mb-6">
                     <div data-tour="explore-header" className="flex justify-between items-center">
                        <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">{selectedGrade?.title}</h1>
                         {selectedGrade?.transversalStandards && (
                             <button
                                onClick={() => handleShowTransversal(selectedGrade.transversalStandards ?? [], selectedGrade.title)}
                                className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold px-3 py-1 rounded-full flex-shrink-0"
                            >
                                Трансверзални компетенции
                            </button>
                        )}
                    </div>
                    <div data-tour="explore-search" className="relative mt-4">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3"><ICONS.search className="w-5 h-5 text-gray-400" /></span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Пребарај теми или поими..."
                            className="w-full max-w-md pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        />
                    </div>
                </header>

                <div data-tour="explore-topics-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in-up">
                    {filteredTopics.map(topic => (
                        <TopicCard key={topic.id} topic={topic} onSelect={() => navigate(`/topic/${topic.id}`)} />
                    ))}
                </div>
            </div>
        </div>
    );
};