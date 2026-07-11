import { logger } from '../utils/logger';
import { useTour } from '../hooks/useTour';
import React, { memo, useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import type { Concept, LessonPlan, NationalStandard } from '../types';
import { ModalType } from '../types';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { libraryTourSteps } from '../tours/tour-steps';
import { useModal } from '../contexts/ModalContext';
import { publishScenario } from '../services/firestoreService.scenarioBank';
import { PublishScenarioDialog, type PublishScenarioOptions } from '../components/scenario-bank/PublishScenarioDialog';



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
                <span className="font-semibold">Цели:</span> {plan.objectives?.map((o: any) => typeof o === 'string' ? o : o.text).join(' ')}
             </p>
             <p className="text-gray-600 mt-1 text-sm line-clamp-3">
                <span className="font-semibold">Активности:</span> {[
                    plan.scenario?.introductory?.text,
                    ...(plan.scenario?.main?.map((m: any) => m.text) || []),
                    plan.scenario?.concluding?.text
                ].filter(Boolean).join(' ')}
            </p>
        </div>
        {plan.tags && plan.tags.length > 0 && (
            <div className="mt-3 pt-3 border-t flex flex-wrap gap-1">
                {plan.tags.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">#{tag}</span>
                ))}
            </div>
        )}
    </Card>
));

export const LessonPlanLibraryView: React.FC = () => {
    const { navigate } = useNavigation();
    const { lessonPlans, deleteLessonPlan, updateLessonPlan, isLoading } = usePlanner();
    const { user, firebaseUser } = useAuth();
    const { addNotification } = useNotification();
    const { allConcepts, allNationalStandards } = useCurriculum();
    useTour('library', libraryTourSteps, lessonPlans.length > 0 && !isLoading);
    useUserPreferences();
    const { showModal, hideModal } = useModal();

    const [searchQuery, setSearchQuery] = useState('');
    const [publishingPlan, setPublishingPlan] = useState<LessonPlan | null>(null);
    const [isPublishingToBank, setIsPublishingToBank] = useState(false);
    const [gradeFilter, setGradeFilter] = useState<string>('all');
    const [conceptStandardFilter, setConceptStandardFilter] = useState<string>('all');
    const [tagFilters, setTagFilters] = useState<string[]>([]);



    const allTags = useMemo(() => {
        const tags = new Set<string>();
        lessonPlans.forEach((plan: LessonPlan) => {
            plan.tags?.forEach((tag: string) => tags.add(tag));
        });
        return Array.from(tags).sort();
    }, [lessonPlans]);

    const handleTagToggle = (tag: string) => {
        setTagFilters((prev: string[]) => 
            prev.includes(tag) ? prev.filter((t: string) => t !== tag) : [...prev, tag]
        );
    };

    const filteredPlans = useMemo(() => {
        return lessonPlans.filter((plan: LessonPlan) => {
            // Grade Filter
            const gradeMatch = gradeFilter === 'all' || plan.grade === parseInt(gradeFilter);

            // Search Query Filter (Title, Objectives, Scenario)
            const query = searchQuery.toLowerCase().trim();
            const queryMatch = query === '' || 
                plan.title.toLowerCase().includes(query) ||
                plan.objectives?.map((o: any) => typeof o === 'string' ? o : o.text).join(' ').toLowerCase().includes(query) ||
                [plan.scenario?.introductory?.text, ...(plan.scenario?.main?.map((m: any) => m.text) || []), plan.scenario?.concluding?.text].filter(Boolean).join(' ').toLowerCase().includes(query);
            let conceptStandardMatch = conceptStandardFilter === 'all';
            if (!conceptStandardMatch) {
                const [type, id] = conceptStandardFilter.split(':');
                if (type === 'concept') {
                    conceptStandardMatch = plan.conceptIds.includes(id);
                } else if (type === 'standard') {
                    const standard = allNationalStandards?.find((s: NationalStandard) => s.id === id);
                    if (standard?.relatedConceptIds) {
                        conceptStandardMatch = plan.conceptIds.some((cid: string) => standard.relatedConceptIds!.includes(cid));
                    }
                }
            }

            // Tag Filter
            const tagMatch = tagFilters.length === 0 || tagFilters.every((tag: string) => plan.tags?.includes(tag));

            return gradeMatch && queryMatch && conceptStandardMatch && tagMatch;
        });
    }, [lessonPlans, searchQuery, gradeFilter, conceptStandardFilter, tagFilters, allNationalStandards]);


const handlePublish = (plan: LessonPlan) => {
        if (!user) {
            addNotification('Мора да сте најавени за да објавувате.', 'error');
            return;
        }
        setPublishingPlan(plan);
    };

    // Was writing to communityLessonPlans (a collection Firestore rules have locked read-only
    // since the S102 migration to scenario_bank — every publish attempt failed with a silent
    // permission-denied). Fixed 2026-07-12 to reuse the same publishScenario() → scenario_bank
    // path LessonPlanEditorView.tsx's "Publish to Bank" flow already uses successfully. Note:
    // scenario_bank only has a public/private distinction (isPublic), not a school-only scope —
    // the old "само за моето училиште" option had no backing rule to actually restrict reads to
    // one school, so this dialog now offers the real public/private choice instead of one that
    // silently did nothing.
    const handleConfirmPublish = async (opts: PublishScenarioOptions) => {
        if (!publishingPlan || !firebaseUser?.uid || !user) return;
        setIsPublishingToBank(true);
        try {
            const bankId = await publishScenario({
                plan: publishingPlan,
                authorUid: firebaseUser.uid,
                authorName: user.name ?? 'Наставник',
                schoolName: user.schoolName,
                teachingModel: opts.teachingModel ?? undefined,
                dokLevel: opts.dokLevel ?? undefined,
                isPublic: opts.isPublic,
                authorNotes: opts.authorNotes,
                originalAuthorName: publishingPlan.originalAuthor || undefined,
            });
            await updateLessonPlan({ ...publishingPlan, isPublished: true, scenarioBankId: bankId, authorName: user.name, schoolName: user.schoolName });
            addNotification(opts.isPublic ? '✅ Подготовката е јавно споделена во Банката!' : '🔒 Подготовката е зачувана приватно во Банката.', 'success');
            setPublishingPlan(null);
        } catch (error) {
            addNotification('Грешка при објавување на подготовката.', 'error');
            logger.error("Publishing failed:", error);
        } finally {
            setIsPublishingToBank(false);
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGradeFilter(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        >
                            <option value="all">Сите</option>
                            {[1,2,3,4,5,6,7,8,9].map(g => <option key={g} value={g}>{g}. Одделение</option>)}
                        </select>
                    </div>
                    <div data-tour="library-filter-concept" className="md:col-span-2">
                         <label htmlFor="concept-standard-filter" className="block text-sm font-medium text-gray-700">Поим или Стандард</label>
                        <select
                            id="concept-standard-filter"
                            value={conceptStandardFilter}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConceptStandardFilter(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent"
                        >
                            <option value="all">Сите поими и стандарди</option>
                            <optgroup label="Поими">
                                {allConcepts.map((c: Concept & { gradeLevel: number; topicId: string }) => <option key={c.id} value={`concept:${c.id}`}>{c.title} ({c.gradeLevel} одд.)</option>)}
                            </optgroup>
                            <optgroup label="Национални Стандарди">
                                {allNationalStandards?.map((s: NationalStandard) => <option key={s.id} value={`standard:${s.id}`}>{s.code} - {s.description.substring(0, 50)}... ({s.gradeLevel} одд.)</option>)}
                            </optgroup>
                        </select>
                    </div>
                </div>
                {allTags.length > 0 && (
                     <div data-tour="library-filter-tags" className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Тагови</label>
                        <div className="flex flex-wrap gap-2">
                            {allTags.map((tag: string) => (
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
                        {filteredPlans.map((plan: LessonPlan) => (
                            <LessonPlanCard 
                                key={plan.id} 
                                plan={plan}
                                onView={() => navigate(`/planner/lesson/view/${plan.id}`)}
                                onEdit={() => navigate(`/planner/lesson/${plan.id}`)}
                                onDelete={() => {
                                    showModal(ModalType.Confirm, {
                                        title: 'Бришење на подготовка',
                                        message: 'Дали сте сигурни дека сакате да ја избришете оваа подготовка? Оваа акција не може да се врати.',
                                        variant: 'danger',
                                        confirmLabel: 'Да, избриши',
                                        onConfirm: async () => { hideModal(); await deleteLessonPlan(plan.id, true); addNotification('Подготовката е избришана.', 'success'); },
                                        onCancel: hideModal,
                                    });
                                }}
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
            {publishingPlan && (
                <PublishScenarioDialog
                    item={publishingPlan}
                    isPro={user?.role === 'admin'}
                    onPublish={handleConfirmPublish}
                    onCancel={() => setPublishingPlan(null)}
                    isLoading={isPublishingToBank}
                />
            )}
        </div>
    );
};
