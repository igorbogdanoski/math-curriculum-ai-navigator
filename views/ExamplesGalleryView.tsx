import React, { useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { usePlanner } from '../contexts/PlannerContext';
import { ICONS } from '../constants';
import type { LessonPlan } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { EmptyState } from '../components/common/EmptyState';

interface ExamplesGalleryViewProps {
}

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
    return (
        <Card 
            onClick={() => navigate(`/planner/lesson/view/${plan.id}`)}
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3crect width='100' height='100' rx='20' fill='rgba(249,250,251,0.5)'/%3e%3cpath d='M25 65 h50 M35 65 v-30 h10 M55 65 v-30' stroke='rgba(243,244,246,0.5)' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'top -20px right -20px',
                backgroundSize: '100px 100px'
            }}
        >
            <h3 className="text-xl font-bold text-brand-primary">{plan.title}</h3>
            <div className="flex items-center justify-between mt-1 text-sm">
                <span className="font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full inline-block">{plan.grade}. одделение</span>
                <div className="flex items-center gap-2">
                    <RatingStars rating={rating.avg} />
                    <span className="text-gray-500 text-xs">({rating.count})</span>
                </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">Автор: {plan.authorName}</p>
            <p className="text-gray-600 mt-2 line-clamp-3">
                {[plan.scenario.introductory, ...plan.scenario.main, plan.scenario.concluding].join(' ')}
            </p>
            <div className="mt-4 text-brand-secondary font-semibold hover:underline">
                Погледни детали и коментари
            </div>
        </Card>
    );
};


export const ExamplesGalleryView: React.FC<ExamplesGalleryViewProps> = () => {
    const { navigate } = useNavigation();
    const { communityLessonPlans } = usePlanner();
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState<string>('all');

    const filteredPlans = useMemo(() => {
        return communityLessonPlans.filter(plan => {
            const gradeMatch = gradeFilter === 'all' || !plan.grade || plan.grade === parseInt(gradeFilter);
            const queryMatch = searchQuery.trim() === '' || plan.title.toLowerCase().includes(searchQuery.toLowerCase());
            return gradeMatch && queryMatch;
        });
    }, [communityLessonPlans, searchQuery, gradeFilter]);

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Галерија на Заедницата</h1>
                <p className="text-lg text-gray-600 mt-2">Инспирирајте се од подготовки споделени од други наставници.</p>
            </header>

            <Card className="mb-6">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <label htmlFor="search-title" className="sr-only">Пребарај по наслов</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <ICONS.search className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                id="search-title"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Пребарај по наслов..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-auto">
                        <label htmlFor="grade-filter" className="block text-sm font-medium text-gray-700 mb-1">Одделение</label>
                        <select
                            id="grade-filter"
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                            className="block w-full p-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        >
                            <option value="all">Сите</option>
                            <option value="6">VI Одделение</option>
                            <option value="7">VII Одделение</option>
                            <option value="8">VIII Одделение</option>
                            <option value="9">IX Одделение</option>
                        </select>
                    </div>
                </div>
            </Card>

            {filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map(plan => (
                        <LessonPlanCard key={plan.id} plan={plan} navigate={navigate} />
                    ))}
                </div>
            ) : (
                 <EmptyState
                    icon={<ICONS.search className="w-12 h-12" />}
                    title="Нема пронајдени подготовки"
                    message="Нема споделени подготовки кои одговараат на вашите филтри за пребарување."
                />
            )}
        </div>
    );
};