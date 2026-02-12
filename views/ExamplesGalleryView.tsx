import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { usePlanner } from '../contexts/PlannerContext';
import { ICONS } from '../constants';
import type { LessonPlan } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { EmptyState } from '../components/common/EmptyState';
import { firestoreService, type CachedMaterial } from '../services/firestoreService';
import { MathRenderer } from '../components/common/MathRenderer';
import { useCurriculum } from '../hooks/useCurriculum';

interface ExamplesGalleryViewProps {
}

type TabType = 'community' | 'ai-materials';

const calculateAverageRating = (ratings?: number[]) => {
    if (!ratings || ratings.length === 0) return { avg: 0, count: 0 };
    const sum = ratings.reduce((a, b) => a + b, 0);
    return {
        avg: sum / ratings.length,
        count: ratings.length
    };
}

const RatingStars: React.FC<{ rating: number }> = ({ rating }) => {
    const fullStars = Math.round(rating);
    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                i < fullStars 
                    ? <ICONS.starSolid key={i} className="w-4 h-4 text-yellow-500" />
                    : <ICONS.star key={i} className="w-4 h-4 text-gray-300" />
            ))}
        </div>
    );
};

const LessonPlanCard: React.FC<{ plan: LessonPlan; navigate: (path: string) => void; }> = ({ plan, navigate }) => {
    const rating = calculateAverageRating(plan.ratings);
    
    const summaryText = useMemo(() => {
        const intro = typeof plan.scenario.introductory === 'string' ? plan.scenario.introductory : plan.scenario.introductory.text;
        const main = plan.scenario.main.map(m => typeof m === 'string' ? m : m.text);
        const conc = typeof plan.scenario.concluding === 'string' ? plan.scenario.concluding : plan.scenario.concluding.text;
        return [intro, ...main, conc].join(' ');
    }, [plan.scenario]);

    return (
        <Card 
            onClick={() => navigate(`/planner/lesson/view/${plan.id}`)}
            className="hover:shadow-md transition-shadow cursor-pointer"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3crect width='100' height='100' rx='20' fill='rgba(249,250,251,0.5)'/%3e%3cpath d='M25 65 h50 M35 65 v-30 h10 M55 65 v-30' stroke='rgba(243,244,246,0.5)' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'top -20px right -20px',
                backgroundSize: '100px 100px'
            }}
        >
            <h3 className="text-xl font-bold text-brand-primary line-clamp-1">{plan.title}</h3>
            <div className="flex items-center justify-between mt-1 text-sm">
                <span className="font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full inline-block text-xs">{plan.grade}. одделение</span>
                <div className="flex items-center gap-2">
                    <RatingStars rating={rating.avg} />
                    <span className="text-gray-500 text-xs">({rating.count})</span>
                </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">Автор: {plan.authorName}</p>
            <p className="text-gray-600 mt-2 line-clamp-3 text-sm">
                {summaryText}
            </p>
            <div className="mt-4 text-brand-secondary text-sm font-semibold hover:underline">
                Погледни детали
            </div>
        </Card>
    );
};

const MaterialCard: React.FC<{ material: CachedMaterial; conceptName: string }> = ({ material, conceptName }) => {
    const [hasRated, setHasRated] = useState(false);
    const [ratings, setRatings] = useState({ 
        helpful: material.helpfulCount || 0, 
        notHelpful: material.notHelpfulCount || 0 
    });

    const typeLabels = {
        analogy: 'Аналогија',
        outline: 'Презентација',
        quiz: 'Квиз',
        problems: 'Задачи'
    };

    const typeIcons = {
        analogy: <ICONS.sparkles className="w-4 h-4" />,
        outline: <ICONS.mindmap className="w-4 h-4" />,
        quiz: <ICONS.check className="w-4 h-4" />,
        problems: <ICONS.edit className="w-4 h-4" />
    };

    const handleRate = async (isHelpful: boolean) => {
        if (hasRated) return;
        
        const success = await firestoreService.rateCachedMaterial(material.id, isHelpful);
        if (success) {
            setHasRated(true);
            setRatings(prev => ({
                ...prev,
                [isHelpful ? 'helpful' : 'notHelpful']: prev[isHelpful ? 'helpful' : 'notHelpful'] + 1
            }));
        }
    };

    return (
        <Card className="flex flex-col h-full border-l-4 border-l-brand-accent">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-accent flex items-center gap-1">
                    {typeIcons[material.type] || <ICONS.sparkles className="w-4 h-4" />}
                    {typeLabels[material.type] || material.type}
                </span>
                <span className="text-xs text-gray-400">
                    {new Date(material.timestamp).toLocaleDateString('mk-MK')}
                </span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{conceptName}</h3>
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {material.gradeLevel}. одделение
                </span>
                <div className="flex items-center gap-2 ml-auto no-print">
                    <button 
                        onClick={() => handleRate(true)}
                        disabled={hasRated}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${hasRated ? 'bg-green-50 text-green-700 border-green-200' : 'hover:bg-green-50 text-gray-500 hover:text-green-600 border-gray-200'}`}
                        title="Корисно"
                    >
                        <ICONS.check className="w-3 h-3" /> {ratings.helpful}
                    </button>
                    <button 
                        onClick={() => handleRate(false)}
                        disabled={hasRated}
                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${hasRated ? 'bg-red-50 text-red-700 border-red-200' : 'hover:bg-red-50 text-gray-500 hover:text-red-600 border-gray-200'}`}
                        title="Не е корисно"
                    >
                        <ICONS.trash className="w-3 h-3" /> {ratings.notHelpful}
                    </button>
                </div>
            </div>
            <div className="text-sm text-gray-600 line-clamp-6 flex-1 bg-gray-50 p-3 rounded-lg overflow-hidden relative">
                <MathRenderer text={material.content} />
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent"></div>
            </div>
            <button 
                onClick={() => {
                    navigator.clipboard.writeText(material.content);
                    alert('Копирано во меморија!');
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-primary hover:text-brand-secondary transition-colors"
            >
                <ICONS.copy className="w-4 h-4" />
                Копирај содржина
            </button>
        </Card>
    );
}

export const ExamplesGalleryView: React.FC<ExamplesGalleryViewProps> = () => {
    const { navigate } = useNavigation();
    const { communityLessonPlans } = usePlanner();
    const { allConcepts } = useCurriculum();
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState<string>('all');
    const [activeTab, setActiveTab] = useState<TabType>('community');
    const [cachedMaterials, setCachedMaterials] = useState<CachedMaterial[]>([]);
    const [isLoadingAI, setIsLoadingAI] = useState(false);

    useEffect(() => {
        if (activeTab === 'ai-materials' && cachedMaterials.length === 0) {
            setIsLoadingAI(true);
            firestoreService.fetchCachedMaterials(60)
                .then(setCachedMaterials)
                .finally(() => setIsLoadingAI(false));
        }
    }, [activeTab]);

    const filteredPlans = useMemo(() => {
        return communityLessonPlans.filter((plan: LessonPlan) => {
            const gradeMatch = gradeFilter === 'all' || !plan.grade || plan.grade === parseInt(gradeFilter);
            const queryMatch = searchQuery.trim() === '' || plan.title.toLowerCase().includes(searchQuery.toLowerCase());
            return gradeMatch && queryMatch;
        });
    }, [communityLessonPlans, searchQuery, gradeFilter]);

    const filteredMaterials = useMemo(() => {
        return cachedMaterials.filter(m => {
            const gradeMatch = gradeFilter === 'all' || m.gradeLevel === parseInt(gradeFilter);
            const concept = allConcepts.find(c => c.id === m.conceptId);
            const conceptName = concept?.title || '';
            const queryMatch = searchQuery.trim() === '' || conceptName.toLowerCase().includes(searchQuery.toLowerCase()) || m.type.includes(searchQuery.toLowerCase());
            return gradeMatch && queryMatch;
        });
    }, [cachedMaterials, searchQuery, gradeFilter, allConcepts]);

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Библиотека со ресурси</h1>
                <p className="text-lg text-gray-600 mt-2">Инспирирајте се од подготовки и AI материјали споделени од заедницата.</p>
            </header>

            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('community')}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'community' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Заедница (Подготовки)
                </button>
                <button 
                    onClick={() => setActiveTab('ai-materials')}
                    className={`pb-3 px-4 font-bold text-sm transition-all border-b-2 ${activeTab === 'ai-materials' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    AI Материјали (Кеш)
                </button>
            </div>

            <Card className="mb-6">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <label htmlFor="search-title" className="sr-only">Пребарај...</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <ICONS.search className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                id="search-title"
                                type="text"
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                placeholder={activeTab === 'community' ? "Пребарај по наслов..." : "Пребарај по поим или тип..."}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-auto">
                        <label htmlFor="grade-filter" className="sr-only">Одделение</label>
                        <select
                            id="grade-filter"
                            value={gradeFilter}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGradeFilter(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
                        >
                            <option value="all">Сите одделенија</option>
                            <option value="6">VI Одделение</option>
                            <option value="7">VII Одделение</option>
                            <option value="8">VIII Одделение</option>
                            <option value="9">IX Одделение</option>
                        </select>
                    </div>
                </div>
            </Card>

            {activeTab === 'community' ? (
                filteredPlans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPlans.map((plan: LessonPlan) => (
                            <LessonPlanCard key={plan.id} plan={plan} navigate={navigate} />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={<ICONS.search className="w-12 h-12" />}
                        title="Нема пронајдени подготовки"
                        message="Нема споделени подготовки кои одговараат на вашите филтри за пребарување."
                    />
                )
            ) : (
                isLoadingAI ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="animate-pulse bg-gray-200 h-64 rounded-xl"></div>
                        ))}
                    </div>
                ) : filteredMaterials.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMaterials.map((material: CachedMaterial) => {
                            const concept = allConcepts.find(c => c.id === material.conceptId);
                            return <MaterialCard key={material.id} material={material} conceptName={concept?.title || 'Непознат поим'} />;
                        })}
                    </div>
                ) : (
                    <EmptyState
                        icon={<ICONS.sparkles className="w-12 h-12" />}
                        title="Нема пронајдени AI материјали"
                        message="Базата на генерирани материјали е моментално празна или нема резултати за пребарувањето."
                    />
                )
            )}
        </div>
    );
};