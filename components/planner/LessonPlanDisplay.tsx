import React, { useMemo } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import { Card } from '../common/Card';
import type { LessonPlan } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { useNavigation } from '../../contexts/NavigationContext';

interface LessonPlanDisplayProps {
  plan: LessonPlan | Omit<LessonPlan, 'id'>;
}

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-md font-semibold text-brand-primary border-b-2 border-brand-accent pb-1 mb-2 uppercase tracking-wider">{title}</h2>
);

const ListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="pb-1">{children}</li>
);

export const LessonPlanDisplay: React.FC<LessonPlanDisplayProps> = ({ plan }) => {
    const { navigate } = useNavigation();
    const { getConceptDetails } = useCurriculum();
    
    const linkedConcepts = useMemo(() => {
        if (!plan?.conceptIds) return [];
        return plan.conceptIds.map(conceptId => getConceptDetails(conceptId)).filter(details => details.concept);
    }, [plan, getConceptDetails]);

    return (
        <Card>
            <div className="grid grid-cols-12 gap-x-6 text-sm">
                {/* --- Left Column Group --- */}
                <div className="col-span-12 md:col-span-8">
                    <div className="grid grid-cols-5 gap-x-6">
                        {/* Цели и Стандарди */}
                        <div className="col-span-5 md:col-span-2 space-y-4">
                            <div>
                                <SectionHeader title="Цели" />
                                <ul className="list-disc list-inside text-gray-700 space-y-1">
                                    {plan.objectives.map((obj, i) => <ListItem key={i}><MathRenderer text={obj} /></ListItem>)}
                                </ul>
                            </div>
                            <div>
                                <SectionHeader title="Стандарди за оценување" />
                                <ul className="list-disc list-inside text-gray-700 space-y-1">
                                    {plan.assessmentStandards.map((std, i) => <ListItem key={i}><MathRenderer text={std} /></ListItem>)}
                                </ul>
                            </div>
                        </div>

                        {/* Сценарио */}
                        <div className="col-span-5 md:col-span-3 mt-6 md:mt-0">
                            <SectionHeader title="Сценарио за часот" />
                            <div className="space-y-3 text-gray-700">
                                <div>
                                    <h4 className="font-semibold">Воведна активност:</h4>
                                    <p><MathRenderer text={plan.scenario.introductory} /></p>
                                </div>
                                <div>
                                    <h4 className="font-semibold">Главни активности:</h4>
                                    <ul className="list-decimal list-inside space-y-1">
                                        {plan.scenario.main.map((act, i) => <ListItem key={i}><MathRenderer text={act} /></ListItem>)}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold">Завршна активност:</h4>
                                    <p><MathRenderer text={plan.scenario.concluding} /></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- Right Column Group --- */}
                <div className="col-span-12 md:col-span-4 mt-6 md:mt-0 space-y-4">
                    <div>
                        <SectionHeader title="Средства" />
                        <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {plan.materials.map((mat, i) => <ListItem key={i}><MathRenderer text={mat} /></ListItem>)}
                        </ul>
                    </div>
                     <div>
                        <SectionHeader title="Следење на напредокот" />
                        <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {plan.progressMonitoring.map((mon, i) => <ListItem key={i}><MathRenderer text={mon} /></ListItem>)}
                        </ul>
                    </div>
                    {plan.differentiation && (
                         <div>
                            <SectionHeader title="Диференцијација" />
                            <p className="text-gray-700"><MathRenderer text={plan.differentiation} /></p>
                        </div>
                    )}
                    {plan.reflectionPrompt && (
                         <div>
                            <SectionHeader title="Рефлексија за наставникот" />
                            <p className="text-gray-700"><MathRenderer text={plan.reflectionPrompt} /></p>
                        </div>
                    )}
                    {plan.selfAssessmentPrompt && (
                         <div>
                            <SectionHeader title="Самооценување за ученици" />
                            <p className="text-gray-700"><MathRenderer text={plan.selfAssessmentPrompt} /></p>
                        </div>
                    )}
                    <div>
                        <SectionHeader title="Поврзаност со програма" />
                        <div className="text-gray-700 space-y-2">
                            <div>
                                <p className="font-semibold">Опфатени поими:</p>
                                {linkedConcepts.length > 0 ? (
                                    <ul className="list-disc list-inside">
                                        {linkedConcepts.map(({concept}) => concept && (
                                             <li key={concept.id}>
                                                <a onClick={() => navigate(`/concept/${concept.id}`)} className="text-brand-secondary hover:underline cursor-pointer no-print">
                                                    <MathRenderer text={concept.title} />
                                                </a>
                                                <span className="print:visible hidden"><MathRenderer text={concept.title} /></span>
                                             </li>
                                        ))}
                                    </ul>
                                ) : <p>Нема поврзани поими.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};