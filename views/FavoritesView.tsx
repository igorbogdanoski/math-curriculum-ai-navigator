import React, { memo } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { usePlanner } from '../contexts/PlannerContext';
import { EmptyState } from '../components/common/EmptyState';
import type { Concept, LessonPlan } from '../types';
import { useNavigation } from '../contexts/NavigationContext';

const FavoriteConceptCard: React.FC<{ concept: Concept & { gradeLevel: number }; onClick: () => void }> = memo(({ concept, onClick }) => (
    <Card onClick={onClick} className="flex items-center justify-between">
        <div>
            <h3 className="text-lg font-semibold text-brand-primary">{concept.title}</h3>
            <p className="text-sm text-gray-500">{concept.gradeLevel}. одделение</p>
        </div>
        <ICONS.chevronRight className="w-6 h-6 text-gray-400" />
    </Card>
));

const FavoriteLessonPlanCard: React.FC<{ plan: LessonPlan; onClick: () => void }> = memo(({ plan, onClick }) => (
     <Card onClick={onClick} className="flex items-center justify-between">
        <div>
            <h3 className="text-lg font-semibold text-brand-primary">{plan.title}</h3>
            <p className="text-sm text-gray-500">{plan.grade}. одделение</p>
        </div>
        <ICONS.chevronRight className="w-6 h-6 text-gray-400" />
    </Card>
));

export const FavoritesView: React.FC = () => {
    const { navigate } = useNavigation();
    const { favoriteConceptIds, favoriteLessonPlanIds } = useUserPreferences();
    const { allConcepts } = useCurriculum();
    const { lessonPlans } = usePlanner();

    const favoriteConcepts = allConcepts.filter((c: Concept & { gradeLevel: number; topicId: string }) => favoriteConceptIds.includes(c.id));
    const favoritePlans = lessonPlans.filter((p: LessonPlan) => favoriteLessonPlanIds.includes(p.id));

    return (
        <div className="p-8 animate-fade-in">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Омилени ставки</h1>
                <p className="text-lg text-gray-600 mt-2">Вашите зачувани поими и подготовки за брз пристап.</p>
            </header>

            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-semibold text-brand-secondary border-b pb-2 mb-4">Омилени поими</h2>
                    {favoriteConcepts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {favoriteConcepts.map((concept: Concept & { gradeLevel: number; topicId: string }) => (
                                <FavoriteConceptCard key={concept.id} concept={concept} onClick={() => navigate(`/concept/${concept.id}`)} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 italic">Немате зачувано омилени поими.</p>
                    )}
                </div>
                
                <div>
                    <h2 className="text-2xl font-semibold text-brand-secondary border-b pb-2 mb-4">Омилени подготовки</h2>
                     {favoritePlans.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {favoritePlans.map((plan: LessonPlan) => (
                                <FavoriteLessonPlanCard key={plan.id} plan={plan} onClick={() => navigate(`/planner/lesson/view/${plan.id}`)} />
                            ))}
                        </div>
                    ) : (
                       <p className="text-gray-500 italic">Немате зачувано омилени подготовки.</p>
                    )}
                </div>
            </div>

             {(favoriteConcepts.length === 0 && favoritePlans.length === 0) && (
                 <div className="mt-8">
                    <EmptyState
                        icon={<ICONS.starSolid className="w-12 h-12" />}
                        title="Вашата колекција е празна"
                        message="Означете ги поимите и подготовките кои ви се најважни со кликнување на ѕвездата за да ги најдете тука."
                    />
                 </div>
            )}
        </div>
    );
};