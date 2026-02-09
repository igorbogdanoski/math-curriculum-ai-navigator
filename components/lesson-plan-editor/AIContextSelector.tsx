import React, { useState, useMemo, useEffect } from 'react';
import { ICONS } from '../../constants';
import { useCurriculum } from '../../hooks/useCurriculum';
import type { GenerationContext, LessonPlan } from '../../types';

interface AIContextSelectorProps {
    plan: Partial<LessonPlan>;
    onGenerate: (context: GenerationContext) => void;
    isGenerating: boolean;
}

const ContextTab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${
            active
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
        {children}
    </button>
);

export const AIContextSelector: React.FC<AIContextSelectorProps> = ({ plan, onGenerate, isGenerating }) => {
    const { curriculum, allNationalStandards, getConceptDetails } = useCurriculum();

    const [generationContextType, setGenerationContextType] = useState<'CONCEPT' | 'STANDARD' | 'SCENARIO' | 'ACTIVITY'>('CONCEPT');
    const [selectedStandard, setSelectedStandard] = useState('');
    const [scenarioText, setScenarioText] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');

    const topicsForGrade = useMemo(() => {
        return curriculum?.grades.find(g => g.level === Number(plan.grade))?.topics || [];
    }, [curriculum, plan.grade]);
    
    const conceptsForTopic = useMemo(() => {
        return topicsForGrade.find(t => t.id === plan.topicId)?.concepts || [];
    }, [topicsForGrade, plan.topicId]);

    const activitiesForConcepts = useMemo(() => {
        if (!plan.conceptIds || plan.conceptIds.length === 0) return [];
        return conceptsForTopic
            .filter(c => plan.conceptIds?.includes(c.id))
            .flatMap(c => c.activities || []);
    }, [conceptsForTopic, plan.conceptIds]);

    useEffect(() => {
        if (allNationalStandards && allNationalStandards.length > 0 && !selectedStandard) {
            setSelectedStandard(allNationalStandards[0].id);
        }
    }, [allNationalStandards, selectedStandard]);

    useEffect(() => {
        if (activitiesForConcepts.length > 0 && !activitiesForConcepts.includes(selectedActivity)) {
            setSelectedActivity(activitiesForConcepts[0]);
        } else if (activitiesForConcepts.length === 0) {
            setSelectedActivity('');
        }
    }, [activitiesForConcepts, selectedActivity]);

    const isGenerationDisabled = useMemo(() => {
        if (isGenerating) return true;
        switch (generationContextType) {
            case 'CONCEPT':
                return !plan.topicId || !plan.conceptIds || plan.conceptIds.length === 0;
            case 'STANDARD':
                return !selectedStandard;
            case 'SCENARIO':
                return !scenarioText.trim();
            case 'ACTIVITY':
                return !selectedActivity;
            default:
                return true;
        }
    }, [isGenerating, generationContextType, plan.topicId, plan.conceptIds, selectedStandard, scenarioText, selectedActivity]);

    const handleGenerateClick = () => {
        let gradeData: GenerationContext['grade'] | undefined;
        if (generationContextType === 'STANDARD') {
            const standard = allNationalStandards?.find(s => s.id === selectedStandard);
            gradeData = curriculum?.grades.find(g => g.level === standard?.gradeLevel);
        } else {
            gradeData = curriculum?.grades.find(g => g.level === Number(plan.grade));
        }

        if (!gradeData) return;

        let context: GenerationContext | null = null;
        switch(generationContextType) {
            case 'CONCEPT': {
                const topic = topicsForGrade.find(t => t.id === plan.topicId);
                const concepts = conceptsForTopic.filter(c => plan.conceptIds?.includes(c.id));
                if (!topic || concepts.length === 0) return;
                context = { type: 'CONCEPT', grade: gradeData, topic, concepts };
                break;
            }
            case 'STANDARD': {
                const standard = allNationalStandards?.find(s => s.id === selectedStandard);
                if (!standard) return;
                const concepts = standard.relatedConceptIds?.map(id => getConceptDetails(id).concept).filter(Boolean as any);
                context = { type: 'STANDARD', grade: gradeData, standard, concepts };
                break;
            }
            case 'SCENARIO': {
                 context = { type: 'SCENARIO', grade: gradeData, scenario: scenarioText };
                 break;
            }
            case 'ACTIVITY': {
                const topic = topicsForGrade.find(t => t.id === plan.topicId);
                const concepts = conceptsForTopic.filter(c => plan.conceptIds?.includes(c.id));
                if (!topic || concepts.length === 0) return;
                context = { type: 'ACTIVITY', grade: gradeData, scenario: selectedActivity, topic, concepts };
                break;
            }
        }
        
        if (context) {
            onGenerate(context);
        }
    };

    return (
        <fieldset className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <legend className="text-xl font-bold text-brand-primary px-2">AI Генератор на Подготовка</legend>

            <div className="flex justify-between items-center flex-wrap gap-4">
                 <p className="text-sm text-gray-700 max-w-2xl">
                    Изберете го изворот на контекст за AI генераторот. Можете да генерирате подготовка врз основа на наставната програма или од ваша идеја. По генерирањето, сите полиња подолу ќе бидат пополнети и ќе можете да ги уредите.
                </p>
                 <button 
                    type="button" 
                    onClick={handleGenerateClick} 
                    disabled={isGenerationDisabled}
                    className="bg-brand-secondary text-white font-semibold px-5 py-2.5 rounded-lg shadow-md hover:bg-brand-primary transition-all duration-300 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    title={isGenerationDisabled ? 'Изберете контекст за да овозможите AI генерација' : 'Генерирај нацрт-подготовка со вештачка интелигенција'}
                >
                    {isGenerating ? (
                        <>
                            <ICONS.spinner className="animate-spin w-5 h-5"/>
                            Генерирам...
                        </>
                    ) : (
                        <>
                            <ICONS.sparkles className="w-5 h-5"/>
                            Генерирај со AI
                        </>
                    )}
                </button>
            </div>
           
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    <ContextTab active={generationContextType === 'CONCEPT'} onClick={() => setGenerationContextType('CONCEPT')}>Од Програма (Поим)</ContextTab>
                    <ContextTab active={generationContextType === 'ACTIVITY'} onClick={() => setGenerationContextType('ACTIVITY')}>Од Програма (Активност)</ContextTab>
                    <ContextTab active={generationContextType === 'STANDARD'} onClick={() => setGenerationContextType('STANDARD')}>Според Стандард</ContextTab>
                    <ContextTab active={generationContextType === 'SCENARIO'} onClick={() => setGenerationContextType('SCENARIO')}>По твоја идеја</ContextTab>
                </nav>
            </div>

            <div className="pt-2 min-h-[120px]">
                {generationContextType === 'CONCEPT' && (
                     <p className="text-sm text-gray-600 animate-fade-in">Ќе се користи избраното одделение, тема и поими од полињата подолу. Ве молиме изберете ги пред да генерирате.</p>
                )}
                {generationContextType === 'ACTIVITY' && (
                    <div className="animate-fade-in space-y-2">
                        <label htmlFor="activity-select" className="block text-sm font-medium text-gray-700">Предлог активност од програмата</label>
                        <select 
                            id="activity-select" 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)} 
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md"
                            disabled={activitiesForConcepts.length === 0}
                        >
                            {activitiesForConcepts.length > 0 ? (
                                activitiesForConcepts.map((act, i) => <option key={i} value={act}>{act.substring(0, 100)}...</option>)
                            ) : (
                                <option>Прво изберете поим(и) за да се прикажат активности.</option>
                            )}
                        </select>
                    </div>
                )}
                {generationContextType === 'STANDARD' && (
                    <div className="animate-fade-in space-y-2">
                        <label htmlFor="standard-select" className="block text-sm font-medium text-gray-700">Национален стандард</label>
                        <select id="standard-select" value={selectedStandard} onChange={(e) => setSelectedStandard(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md">
                            {allNationalStandards?.map(s => <option key={s.id} value={s.id}>{s.code} ({s.gradeLevel} одд.) - {s.description}</option>)}
                        </select>
                         <p className="text-xs text-gray-500">Одделението ќе биде автоматски одбрано според стандардот.</p>
                    </div>
                )}
                {generationContextType === 'SCENARIO' && (
                    <div className="animate-fade-in space-y-2">
                        <label htmlFor="scenario-text" className="block text-sm font-medium text-gray-700">Внесете ја вашата идеја, сценарио, или текстуален проблем</label>
                        <textarea id="scenario-text" value={scenarioText} onChange={e => setScenarioText(e.target.value)} rows={3} className="mt-1 block w-full p-2 border-gray-300 rounded-md" placeholder="На пр. 'Сакам да направам час за Питагорова теорема каде учениците ќе мерат вистински објекти во училницата'"></textarea>
                    </div>
                )}
            </div>
        </fieldset>
    );
};