import React, { memo, useMemo, useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import type { LessonPlan } from '../types';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { libraryTourSteps } from '../tours/tour-steps';

declare var introJs: any;

const LessonPlanCard: React.FC<{ 
    plan: LessonPlan; 
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onPublish: () => void;
}> = memo(({ plan, onView, onEdit, onDelete, onPublish }) => (
    <Card 
        className="flex flex-col h-full"
        style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3crect width='100' height='100' rx='20' fill='rgba(249,250,251,0.5)'/%3e%3cpath d='M25 65 h50 M35 65 v-30 h10 M55 65 v-30' stroke='rgba(243,244,246,0.5)' stroke-width='10' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'top -20px right -20px',
            backgroundSize: '100px 100px'
        }}
    >
        <div className="flex justify-between items-start">
            <div onClick={onView} className="cursor-pointer flex-1 pr-4">
                <h3 className="text-xl font-bold text-brand-primary hover:text-brand-secondary transition-colors">{plan.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full inline-block">{plan.grade}. одделение</span>
                    {plan.isPublished && (
                        <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <ICONS.check className="w-3 h-3"/> Објавено
                        </span>
                    )}
                </div>
            </div>
            <div className="flex space-x-1 flex-shrink-0">
                 <button onClick={onPublish} className={`p-2 rounded-full hover:bg-gray-200 ${plan.isPublished ? 'text-green-600' : 'text-gray-600 hover:text-brand-secondary'}`} aria-label={plan.isPublished ? 'Ажурирај во галерија' : 'Објави во галерија'}>
                    <ICONS.share className="w-5 h-5" />
                </button>
                 <button onClick={onEdit} className="p-2 rounded-full hover:bg-gray-200 text-gray-600 hover:text-brand-secondary" aria-label={`Уреди ${plan.title}`}>
                    <ICONS.edit className="w-5 h-5" />
                </button>
                <button onClick={onDelete} className="p-2 rounded-full hover:bg-red-100 text-gray-600 hover:text-red-600" aria-label={`Избриши ${plan.title}`}>
                    <ICONS.trash className="w-5 h-5" />
                </button>
            </div>
        </div>
        <div onClick={onView} className="cursor-pointer mt-2 flex-1">
            <p className="text-gray-600 text-sm line-clamp-2">
               <span className="font-semibold">Цели:</span> {plan.objectives.join(' ')}
            </p>
             <p className="text-gray-600 mt-1 text-sm line-clamp-3">
               <span className="font-semibold">Активности:</span> {[plan.scenario.introductory, ...plan.scenario.main, plan.scenario.concluding].join(' ')}
            </p>
        </div>
        {plan.tags && plan.tags.length > 0 && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-1">
                {plan.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">#{tag}</span>
                ))}
            </div>
        )}
    </Card>
));

export const LessonPlanLibraryView: React.FC = () => {
    const { navigate } = useNavigation();
    const { lessonPlans, deleteLessonPlan, publishLessonPlan, isLoading } = usePlanner();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { allConcepts, allNationalStandards } = useCurriculum();
    const { toursSeen, markTourAsSeen } = useUserPreferences();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [gradeFilter, setGradeFilter] = useState<string>('all');
    const [conceptStandardFilter, setConceptStandardFilter] = useState<string>('all');
    const [tagFilters, setTagFilters] = useState<string[]>([]);

    useEffect(() => {
        if (toursSeen.library === true || typeof introJs === 'undefined' || lessonPlans.length === 0 || isLoading) return;

        const timer = setTimeout(() => {
            const tour = introJs();
            tour.setOptions({
                steps: libraryTourSteps,
                showProgress: true,
                showBullets: true,
                nextLabel: 'Следно',
                prevLabel: 'Претходно',
                doneLabel: 'Готово',
            });
            tour.oncomplete(() => markTourAsSeen('library'));
            tour.onexit(() => markTourAsSeen('library'));
            tour.start();
        }, 500);

        return () => clearTimeout(timer);
    }, [toursSeen, markTourAsSeen, lessonPlans.length, isLoading]);


    const allTags = useMemo(() => {
        const tags = new Set<string>();
        lessonPlans.forEach(plan => {
            plan.tags?.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }, [lessonPlans]);

    const handleTagToggle = (tag: string) => {
        setTagFilters(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const filteredPlans = useMemo(() => {
        return lessonPlans.filter(plan => {
            // Grade Filter
            const gradeMatch = gradeFilter === 'all' || plan.grade === parseInt(gradeFilter);

            // Search Query Filter (Title, Objectives, Scenario)
            const query = searchQuery.toLowerCase().trim();
            const queryMatch = query === '' || 
                plan.title.toLowerCase().includes(query) ||
                plan.objectives.join(' ').toLowerCase().includes(query) ||
                Object.values(plan.scenario).flat().join(' ').toLowerCase().includes(query);

            // Concept/Standard Filter
            let conceptStandardMatch = conceptStandardFilter === 'all';
            if (!conceptStandardMatch) {
                const [type, id] = conceptStandardFilter.split(':');
                if (type === 'concept') {
                    conceptStandardMatch = plan.conceptIds.includes(id);
                } else if (type === 'standard') {
                    const standard = allNationalStandards?.find(s => s.id === id);
                    if (standard?.relatedConceptIds) {
                        conceptStandardMatch = plan.conceptIds.some(cid => standard.relatedConceptIds!.includes(cid));
                    }
                }
            }

            // Tag Filter
            const tagMatch = tagFilters.length === 0 || tagFilters.every(tag => plan.tags?.includes(tag));

            return gradeMatch && queryMatch && conceptStandardMatch && tagMatch;
        });
    }, [lessonPlans, searchQuery, gradeFilter, conceptStandardFilter, tagFilters, allNationalStandards]);


    const handlePublish = async (plan: LessonPlan) => {
        if (!user) {
            addNotification('Мора да сте најавени за да објавувате.', 'error');
            return;
        }

        const confirmMessage = plan.isPublished 
            ? 'Дали сте сигурни дека сакате да ги ажурирате промените во галеријата? Ова ќе ја замени постоечката верзија.'
            : 'Дали сте сигурни дека сакате да ја објавите оваа подготовка во галеријата на заедницата? Вашето име ќе биде видливо за сите.';
        
        if (window.confirm(confirmMessage)) {
            try {
                await publishLessonPlan(plan.id, user.name);
                const message = plan.isPublished ? 'Подготовката е успешно ажурирана во галеријата!' : 'Подготовката е успешно објавена!';
                addNotification(message, 'success');
            } catch (error) {
                addNotification('Грешка при објавување на подготовката.', 'error');
                console.error("Publishing failed:", error);
            }
        }
    };

    return (
        <div className="p-8 animate-fade-in">
            <header data-tour="library-header" className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-4xl font-bold text-brand-primary">Мои подготовки</h1>
                    <p className="text-lg text-gray-600 mt-2">Вашата лична библиотека со подготовки за час.</p>
                </div>
                <button 
                    onClick={() => navigate('/planner/lesson/new')}
                    className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors"
                >
                    <ICONS.plus className="w-5 h-5 mr-2" />
                    Креирај нова подготовка
                </button>
            </header>

            <Card data-tour="library-filters" className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div data-tour="library-search-keyword" className="md:col-span-3">
                        <label htmlFor="search-query" className="block text-sm font-medium text-gray-700">Пребарај по клучен збор</label>
                        <div className="relative mt-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <ICONS.search className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                id="search-query"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Пребарај низ наслов, цели, сценарио..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="grade-filter" className="block text-sm font-medium text-gray-700">Одделение</label>
                        <select
                            id="grade-filter"
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        >
                            <option value="all">Сите</option>
                            {[6,7,8,9].map(g => <option key={g} value={g}>{g}. Одделение</option>)}
                        </select>
                    </div>
                    <div data-tour="library-filter-concept" className="md:col-span-2">
                         <label htmlFor="concept-standard-filter" className="block text-sm font-medium text-gray-700">Поим или Стандард</label>
                        <select
                            id="concept-standard-filter"
                            value={conceptStandardFilter}
                            onChange={(e) => setConceptStandardFilter(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        >
                            <option value="all">Сите поими и стандарди</option>
                            <optgroup label="Поими">
                                {allConcepts.map(c => <option key={c.id} value={`concept:${c.id}`}>{c.title} ({c.gradeLevel} одд.)</option>)}
                            </optgroup>
                            <optgroup label="Национални Стандарди">
                                {allNationalStandards?.map(s => <option key={s.id} value={`standard:${s.id}`}>{s.code} - {s.description.substring(0, 50)}... ({s.gradeLevel} одд.)</option>)}
                            </optgroup>
                        </select>
                    </div>
                </div>
                {allTags.length > 0 && (
                     <div data-tour="library-filter-tags" className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Тагови</label>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => handleTagToggle(tag)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors border ${
                                        tagFilters.includes(tag)
                                            ? 'bg-brand-primary text-white border-brand-primary'
                                            : 'bg-gray-100 text-gray-800 border-gray-200 hover:border-gray-400'
                                    }`}
                                >
                                    #{tag}
                                </button>
                            ))}
                            {tagFilters.length > 0 && (
                                <button onClick={() => setTagFilters([])} className="text-xs text-gray-500 hover:underline">
                                    Исчисти
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {lessonPlans.length > 0 ? (
                filteredPlans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPlans.map(plan => (
                            <LessonPlanCard 
                                key={plan.id} 
                                plan={plan}
                                onView={() => navigate(`/planner/lesson/view/${plan.id}`)}
                                onEdit={() => navigate(`/planner/lesson/${plan.id}`)}
                                onDelete={() => deleteLessonPlan(plan.id)}
                                onPublish={() => handlePublish(plan)}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={<ICONS.search className="w-12 h-12" />}
                        title="Нема пронајдени подготовки"
                        message="Нема подготовки кои одговараат на вашите филтри. Обидете се да ги промените филтрите за пребарување."
                    />
                )
            ) : (
                 <EmptyState
                    icon={<ICONS.myLessons className="w-12 h-12" />}
                    title="Немате креирано подготовки"
                    message="Вашата лична библиотека е празна. Започнете со креирање на вашата прва подготовка за час."
                 >
                    <button
                        onClick={() => navigate('/planner/lesson/new')}
                        className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors"
                    >
                        <ICONS.plus className="w-5 h-5 mr-2" />
                        Креирај нова подготовка
                    </button>
                 </EmptyState>
            )}
        </div>
    );
};