import React, { useMemo, useCallback, useState } from 'react';
import { useCurriculum } from '../../hooks/useCurriculum';
import type { LessonPlan, Grade, Topic, Concept } from '../../types';
import { ICONS } from '../../constants';

interface LessonPlanFormFieldsProps {
    plan: Partial<LessonPlan>;
    setPlan: React.Dispatch<React.SetStateAction<Partial<LessonPlan>>>;
    onEnhanceField: (fieldName: string, currentText: string) => void;
    enhancingField: string | null;
}

const arrayToString = (arr: any[] = []) => arr.map(item => typeof item === 'string' ? item : (item.text || '')).join('\n');
const stringToArray = (str: string = '') => str.split('\n').filter(line => line.trim() !== '');

const stringToObjectives = (str: string = []) => stringToArray(str).map(text => ({ text }));
const stringToMainActivities = (str: string = []) => stringToArray(str).map(text => ({ text, bloomsLevel: 'Understanding' as const }));

interface EnhancedTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    fieldName: string;
    label: string;
    value: string;
    onEnhance: (fieldName: string, currentText: string) => void;
    isEnhancing: boolean;
}

const EnhancedTextArea: React.FC<EnhancedTextAreaProps> = ({ fieldName, label, value, onEnhance, isEnhancing, ...props }) => {
    return (
        <div>
            <label htmlFor={props.id} className="block text-sm font-medium text-gray-700">{label}</label>
            <div className="relative mt-1">
                <textarea
                    id={props.id}
                    name={props.name}
                    value={value}
                    {...props}
                    className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary pr-10 transition-colors"
                />
                <button
                    type="button"
                    onClick={() => onEnhance(fieldName, value)}
                    disabled={!value || isEnhancing}
                    title="Подобри го текстот со AI"
                    className="absolute top-2 right-2 p-1 text-gray-400 rounded-full hover:bg-blue-100 hover:text-brand-secondary disabled:cursor-not-allowed disabled:text-gray-300 transition-transform hover:scale-110"
                >
                    {isEnhancing ? <ICONS.spinner className="w-5 h-5 animate-spin" /> : <ICONS.sparkles className="w-5 h-5" />}
                </button>
            </div>
             {props.placeholder && <p className="mt-1 text-xs text-gray-500">{props.placeholder}</p>}
        </div>
    );
};

export const LessonPlanFormFields: React.FC<LessonPlanFormFieldsProps> = ({ plan, setPlan, onEnhanceField, enhancingField }) => {
    const { curriculum } = useCurriculum();
    const [newMaterial, setNewMaterial] = useState('');

    const topicsForGrade = useMemo(() => {
        return curriculum?.grades.find((g: Grade) => g.level === Number(plan.grade))?.topics || [];
    }, [curriculum, plan.grade]);

    const conceptsForTopic = useMemo(() => {
        return topicsForGrade.find((t: Topic) => t.id === plan.topicId)?.concepts || [];
    }, [topicsForGrade, plan.topicId]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'grade') {
            const newGradeLevel = Number(value);
            const newGradeData = curriculum?.grades.find((g: Grade) => g.level === newGradeLevel);
            const newTopic = newGradeData?.topics[0];
            setPlan((prev: Partial<LessonPlan>) => ({ ...prev, grade: newGradeLevel, topicId: newTopic?.id || '', theme: newTopic?.title || '', conceptIds: [] }));
        } else if (name === 'topicId') {
            const newTopic = topicsForGrade.find((t: Topic) => t.id === value);
            setPlan((prev: Partial<LessonPlan>) => ({ ...prev, topicId: value, theme: newTopic?.title || '', conceptIds: [] }));
        }
        else {
            const isNumeric = ['lessonNumber'].includes(name);
            const finalValue = isNumeric ? (value === '' ? undefined : Number(value)) : value;
            setPlan((prev: Partial<LessonPlan>) => ({ ...prev, [name]: finalValue }));
        }
    };
    
    const handleScenarioChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setPlan((prev: Partial<LessonPlan>) => ({
          ...prev,
          scenario: {
            ...(prev.scenario || { introductory: { text: '' }, main: [], concluding: { text: '' } }),
            [name]: name === 'main' 
                ? stringToMainActivities(value) 
                : { ...(prev.scenario?.[name as 'introductory' | 'concluding'] || { text: '' }), text: value },
          },
        }));
    }, [setPlan]);
    
    const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const options = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        setPlan((prev: Partial<LessonPlan>) => ({ ...prev, conceptIds: options }));
    };

    const handleMaterialChange = (index: number, value: string) => {
        const newMaterials = [...(plan.materials || [])];
        newMaterials[index] = value;
        setPlan((p: Partial<LessonPlan>) => ({...p, materials: newMaterials}));
    };
    
    const handleMaterialAdd = () => {
        if (newMaterial.trim()) {
            const newMaterials = [...(plan.materials || []), newMaterial.trim()];
            setPlan((p: Partial<LessonPlan>) => ({...p, materials: newMaterials}));
            setNewMaterial('');
        }
    };
    
    const handleMaterialDelete = (index: number) => {
        const newMaterials = [...(plan.materials || [])];
        newMaterials.splice(index, 1);
        setPlan((p: Partial<LessonPlan>) => ({...p, materials: newMaterials}));
    };
    
    const handleMaterialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleMaterialAdd();
        }
    };


    if (!curriculum) return null;

    return (
        <div className="space-y-6 pt-6 border-t">
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="grade" className="block text-sm font-medium text-gray-700">Одделение</label>
                  <select id="grade" name="grade" value={plan.grade || ''} onChange={handleChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary">
                    {curriculum.grades.map((g: Grade) => <option key={g.id} value={g.level}>{g.title}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="topicId" className="block text-sm font-medium text-gray-700">Тема</label>
                  <select id="topicId" name="topicId" value={plan.topicId || ''} onChange={handleChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" disabled={topicsForGrade.length === 0}>
                    <option value="">-- Избери тема --</option>
                    {topicsForGrade.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
                 <div className="sm:col-span-1">
                  <label htmlFor="conceptIds" className="block text-sm font-medium text-gray-700">Поими (Ctrl/Cmd)</label>
                  <select id="conceptIds" name="conceptIds" multiple value={plan.conceptIds || []} onChange={handleMultiSelectChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md h-24 transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" disabled={conceptsForTopic.length === 0}>
                    {conceptsForTopic.map((c: Concept) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1 hidden md:block">Држете Ctrl (или Cmd) за повеќе поими.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">Наслов на подготовка</label>
                    <input type="text" id="title" name="title" value={plan.title || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" />
                </div>
                <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Предмет</label>
                    <input type="text" id="subject" name="subject" value={plan.subject || ''} onChange={handleChange} required className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" />
                </div>
                <div>
                    <label htmlFor="theme" className="block text-sm font-medium text-gray-700">Тематска целина (од програма)</label>
                    <input type="text" id="theme" name="theme" value={plan.theme || ''} onChange={handleChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md bg-gray-50" readOnly />
                </div>
                <div>
                    <label htmlFor="lessonNumber" className="block text-sm font-medium text-gray-700">Час бр.</label>
                    <input type="number" id="lessonNumber" name="lessonNumber" value={plan.lessonNumber || ''} onChange={handleChange} className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" />
                </div>
            </div>

            <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Тагови (одделени со запирка)</label>
                <input 
                    type="text" 
                    id="tags" 
                    name="tags" 
                    value={(plan.tags || []).join(', ')} 
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const tags = e.target.value.split(',').map((tag: string) => tag.trim()).filter(Boolean);
                        setPlan((p: Partial<LessonPlan>) => ({...p, tags}));
                    }}
                    className="mt-1 block w-full p-2 border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary" 
                    placeholder="пр. проектна-настава, квиз, воведен-час"
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <EnhancedTextArea
                    id="objectives"
                    fieldName="objectives"
                    label="Наставни цели"
                    value={arrayToString(plan.objectives || [])}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlan((p: Partial<LessonPlan>) => ({...p, objectives: stringToObjectives(e.target.value)}))}
                    onEnhance={onEnhanceField}
                    isEnhancing={enhancingField === 'objectives'}
                    rows={5}
                    placeholder="Внесете секоја цел во нов ред..."
                />
                <EnhancedTextArea
                    id="assessmentStandards"
                    fieldName="assessmentStandards"
                    label="Стандарди за оценување"
                    value={arrayToString(plan.assessmentStandards || [])}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlan((p: Partial<LessonPlan>) => ({...p, assessmentStandards: stringToArray(e.target.value)}))}
                    onEnhance={onEnhanceField}
                    isEnhancing={enhancingField === 'assessmentStandards'}
                    rows={5}
                    placeholder="Внесете секој стандард во нов ред..."
                />
            </div>

            <fieldset className="border p-4 rounded-md bg-gray-50/50">
                <legend className="text-lg font-medium text-gray-900 px-2 bg-brand-bg rounded">Сценарио за часот</legend>
                <div className="space-y-4 mt-2">
                    <EnhancedTextArea
                        id="introductory"
                        fieldName="scenario.introductory"
                        label="Воведна активност"
                        value={plan.scenario?.introductory?.text || ''}
                        onChange={handleScenarioChange}
                        onEnhance={onEnhanceField}
                        isEnhancing={enhancingField === 'scenario.introductory'}
                        name="introductory"
                        rows={3}
                    />
                    <EnhancedTextArea
                        id="main"
                        fieldName="scenario.main"
                        label="Главни активности"
                        value={arrayToString(plan.scenario?.main || [])}
                        onChange={handleScenarioChange}
                        onEnhance={onEnhanceField}
                        isEnhancing={enhancingField === 'scenario.main'}
                        name="main"
                        rows={5}
                        placeholder="Внесете секоја активност во нов ред..."
                    />
                    <EnhancedTextArea
                        id="concluding"
                        fieldName="scenario.concluding"
                        label="Завршна активност"
                        value={plan.scenario?.concluding?.text || ''}
                        onChange={handleScenarioChange}
                        onEnhance={onEnhanceField}
                        isEnhancing={enhancingField === 'scenario.concluding'}
                        name="concluding"
                        rows={3}
                    />
                </div>
            </fieldset>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Потребни материјали (Средства)</label>
                    <div className="relative mt-1">
                        <div className="p-2 border border-gray-300 rounded-md bg-white space-y-2 min-h-[108px]">
                            {(plan.materials || []).map((material: string, index: number) => (
                                <div key={index} className="flex items-center gap-2 group animate-fade-in">
                                    <span className="text-gray-500">&bull;</span>
                                    <input 
                                        type="text"
                                        value={material}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMaterialChange(index, e.target.value)}
                                        className="flex-1 p-1 border-b focus:outline-none focus:border-brand-primary transition-colors"
                                    />
                                    <button type="button" onClick={() => handleMaterialDelete(index)} title="Избриши ставка" className="opacity-60 hover:opacity-100">
                                        <ICONS.trash className="w-4 h-4 text-red-400 hover:text-red-600" />
                                    </button>
                                </div>
                            ))}
                            {(!plan.materials || plan.materials.length === 0) && <p className="text-sm text-gray-400 px-1 py-1">Нема додадени материјали.</p>}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <input 
                                type="text" 
                                value={newMaterial} 
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaterial(e.target.value)} 
                                onKeyDown={handleMaterialKeyDown} 
                                placeholder="Додади нов материјал..."
                                className="flex-1 p-2 border border-gray-300 rounded-md transition-shadow focus:ring-brand-secondary focus:border-brand-secondary"
                            />
                            <button 
                                type="button" 
                                onClick={handleMaterialAdd}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium transition-colors"
                            >
                                Додади
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => onEnhanceField('materials', arrayToString(plan.materials || []))}
                            disabled={!plan.materials || plan.materials.length === 0 || enhancingField === 'materials'}
                            title="Подобри ја листата со материјали со AI"
                            className="absolute top-2 right-2 p-1 text-gray-400 rounded-full hover:bg-blue-100 hover:text-brand-secondary disabled:cursor-not-allowed disabled:text-gray-300 transition-transform hover:scale-110"
                        >
                            {enhancingField === 'materials' ? <ICONS.spinner className="w-5 h-5 animate-spin" /> : <ICONS.sparkles className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <EnhancedTextArea
                    id="progressMonitoring"
                    fieldName="progressMonitoring"
                    label="Следење на напредокот"
                    value={arrayToString(plan.progressMonitoring || [])}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlan((p: Partial<LessonPlan>) => ({...p, progressMonitoring: stringToArray(e.target.value)}))}
                    onEnhance={onEnhanceField}
                    isEnhancing={enhancingField === 'progressMonitoring'}
                    rows={3}
                    placeholder="Внесете секој начин на следење во нов ред..."
                />
            </div>
             <EnhancedTextArea
                id="differentiation"
                fieldName="differentiation"
                label="Диференцијација"
                value={plan.differentiation || ''}
                onChange={handleChange}
                onEnhance={onEnhanceField}
                isEnhancing={enhancingField === 'differentiation'}
                name="differentiation"
                rows={3}
                placeholder="Идеи за поддршка на ученици со потешкотии и предизвици за напредните ученици..."
            />
            <fieldset className="border p-4 rounded-md bg-gray-50/50">
                <legend className="text-lg font-medium text-gray-900 px-2 bg-brand-bg rounded">Рефлексија и Оценување</legend>
                <div className="space-y-4 mt-2">
                    <EnhancedTextArea
                        id="reflectionPrompt"
                        fieldName="reflectionPrompt"
                        label="Рефлексија за наставникот"
                        value={plan.reflectionPrompt || ''}
                        onChange={handleChange}
                        onEnhance={onEnhanceField}
                        isEnhancing={enhancingField === 'reflectionPrompt'}
                        name="reflectionPrompt"
                        rows={3}
                        placeholder="Водечки прашања за наставникот за рефлексија по часот (пр. 'Што помина добро?', 'Каде имаше потешкотии?')..."
                    />
                    <EnhancedTextArea
                        id="selfAssessmentPrompt"
                        fieldName="selfAssessmentPrompt"
                        label="Прашања за самооценување на учениците"
                        value={plan.selfAssessmentPrompt || ''}
                        onChange={handleChange}
                        onEnhance={onEnhanceField}
                        isEnhancing={enhancingField === 'selfAssessmentPrompt'}
                        name="selfAssessmentPrompt"
                        rows={3}
                        placeholder="Прашања што учениците можат да си ги постават за да го оценат своето разбирање (пр. 'Што научив денес?', 'Што ми беше најтешко?')..."
                    />
                </div>
            </fieldset>
        </div>
    );
};