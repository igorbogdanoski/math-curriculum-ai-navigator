import React, { useState } from 'react';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';
import { QuestionType, type DifferentiationLevel, type TeachingProfile, type StudentProfile, type BloomDistribution } from '../../types';
import { ICONS } from '../../constants';
import { InfoTooltip } from '../common/InfoTooltip';
import { educationalHints } from '../../data/educationalModelsInfo';

interface MaterialOptionsProps {
    state: GeneratorState;
    dispatch: React.Dispatch<GeneratorAction>;
    user: TeachingProfile | null;
}

const BLOOM_LEVELS: { key: keyof BloomDistribution; label: string; inactiveClass: string; activeClass: string }[] = [
    { key: 'Remembering',   label: 'Паметење',   inactiveClass: 'border-pink-300 text-pink-700',   activeClass: 'bg-pink-500 border-pink-500 text-white' },
    { key: 'Understanding', label: 'Разбирање',  inactiveClass: 'border-orange-300 text-orange-700', activeClass: 'bg-orange-500 border-orange-500 text-white' },
    { key: 'Applying',      label: 'Примена',    inactiveClass: 'border-yellow-400 text-yellow-700', activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
    { key: 'Analyzing',     label: 'Анализа',    inactiveClass: 'border-green-400 text-green-700',   activeClass: 'bg-green-500 border-green-500 text-white' },
    { key: 'Evaluating',    label: 'Евалуација', inactiveClass: 'border-blue-400 text-blue-700',    activeClass: 'bg-blue-500 border-blue-500 text-white' },
    { key: 'Creating',      label: 'Создавање',  inactiveClass: 'border-purple-400 text-purple-700', activeClass: 'bg-purple-500 border-purple-500 text-white' },
];

const BloomDistributionSelector: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => {
    const { bloomDistribution } = state;
    const selectedLevels = Object.keys(bloomDistribution) as (keyof BloomDistribution)[];

    const toggleLevel = (key: keyof BloomDistribution) => {
        const newDist = { ...bloomDistribution };
        if (newDist[key] !== undefined) {
            delete newDist[key];
        } else {
            newDist[key] = 1;
        }
        dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: newDist } });
    };

    return (
        <div className="md:col-span-2 pt-4 border-t mt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Нагласок по Блумова таксономија
                <span className="ml-2 text-xs font-normal text-gray-400">(опционално — AI ги вклучува сите нивоа ако не е избрано)</span>
            </label>
            <div className="flex flex-wrap gap-2">
                {BLOOM_LEVELS.map(({ key, label, inactiveClass, activeClass }) => {
                    const isActive = bloomDistribution[key] !== undefined;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggleLevel(key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${isActive ? activeClass : `bg-white ${inactiveClass} hover:opacity-80`}`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
            {selectedLevels.length > 0 && (
                <p className="text-xs text-indigo-600 font-medium mt-2">
                    ✓ AI ќе нагласи: {selectedLevels.map(k => BLOOM_LEVELS.find(b => b.key === k)?.label).join(' → ')}
                </p>
            )}
        </div>
    );
};

const ScenarioOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
            <div>
                <label htmlFor="activity-focus" className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                        Фокус на активноста
                    </span>
                    <InfoTooltip 
                        title={`Фокус: ${state.activityFocus}`} 
                        content={educationalHints.focuses[state.activityFocus as keyof typeof educationalHints.focuses]?.text || 'Изберете фокус на активноста'} 
                        example={educationalHints.focuses[state.activityFocus as keyof typeof educationalHints.focuses]?.example} 
                    />
                </label>
                <select id="activity-focus" value={state.activityFocus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityFocus', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                    <option>Концептуално разбирање</option>
                    <option>Вежбање вештини</option>
                    <option>Решавање проблеми</option>
                    <option>Истражувачко учење</option>
                    <option>Соработка и тимска работа</option>
                    <option>Примена во реален контекст</option>
                    <option>Критичко размислување и анализа</option>
                    <option>Интеграција на технологија</option>
                    <option>Диференцијација и персонализација</option>
                </select>
            </div>
            <div>
                <label htmlFor="scenario-tone" className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                        Тон на сценариото
                    </span>
                    <InfoTooltip 
                        title={`Тон: ${state.scenarioTone}`} 
                        content={educationalHints.tones[state.scenarioTone as keyof typeof educationalHints.tones]?.text || 'Изберете тип на сценарио'} 
                        example={educationalHints.tones[state.scenarioTone as keyof typeof educationalHints.tones]?.example} 
                    />
                </label>
                <select id="scenario-tone" value={state.scenarioTone} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'scenarioTone', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                    <option>Креативно и ангажирачко</option>
                    <option>Формално и структурирано</option>
                    <option>Разиграно и базирано на игра</option>
                    <option>Наративен (преку приказна)</option>
                    <option>Натпреварувачки (гамификација)</option>
                    <option>Истражувачки и експериментален</option>
                    <option>Практичен и 'hands-on'</option>
                </select>
            </div>
            <div>
                <label htmlFor="learning-design" className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                        Педагошки модел
                    </span>
                    <InfoTooltip 
                        title={educationalHints.pedagogicalModels[state.learningDesignModel as keyof typeof educationalHints.pedagogicalModels]?.title || state.learningDesignModel} 
                        content={educationalHints.pedagogicalModels[state.learningDesignModel as keyof typeof educationalHints.pedagogicalModels]?.text || 'Изберете педагошки модел'} 
                        example={educationalHints.pedagogicalModels[state.learningDesignModel as keyof typeof educationalHints.pedagogicalModels]?.example} 
                    />
                </label>
                <select id="learning-design" value={state.learningDesignModel} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'learningDesignModel', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                    <option value="Standard">Стандарден (креативен предлог)</option>
                    <option value="5E Model">5Е Модел (Engage, Explore...)</option>
                    <option value="Gagne's Nine Events">Gagné-ови 9 настани</option>
                    <option value="UDL">Универзален дизајн за учење (УДУ)</option>
                    <option value="PBL">Учење базирано на проблеми (УБП)</option>
                    <option value="Flipped Classroom">Превртена училница</option>
                    <option value="SAMR">SAMR модел (технолошка интеграција)</option>
                </select>
            </div>
        </div>
        
        {/* А1: Contextual Illustrations toggle */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                    <ICONS.gallery className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-gray-800">Вклучи AI илустрација</h4>
                    <p className="text-xs text-gray-500">Генерирај контекстуална слика за наставниот план (Imagen 3)</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={state.includeIllustration}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'includeIllustration', value: e.target.checked } })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
        </div>
    </div>
);

const AssessmentOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const applyPreset = (preset: 'quick' | 'deep' | 'standard') => {
        if (preset === 'quick') {
            dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: 3 } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'questionTypes', value: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE] } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: { Remembering: 1, Understanding: 1 } } });
        } else if (preset === 'deep') {
            dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: 2 } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'questionTypes', value: [QuestionType.ESSAY, QuestionType.SHORT_ANSWER] } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: { Analyzing: 1, Evaluating: 1, Creating: 1 } } });
        } else if (preset === 'standard') {
            dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: 5 } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'questionTypes', value: [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER, QuestionType.TRUE_FALSE] } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: {} } });
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            {/* Magic Presets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <button type="button" onClick={() => applyPreset('quick')} className="flex flex-col items-center p-4 border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 rounded-xl transition-colors shadow-sm">
                    <span className="text-2xl mb-2">⚡</span>
                    <span className="font-bold text-blue-800 text-sm mb-1">Брза проверка (5 мин)</span>
                    <span className="text-xs text-blue-600 text-center">3 кратки прашања, точно/неточно</span>
                </button>
                <button type="button" onClick={() => applyPreset('deep')} className="flex flex-col items-center p-4 border-2 border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 rounded-xl transition-colors shadow-sm">
                    <span className="text-2xl mb-2">🧠</span>
                    <span className="font-bold text-purple-800 text-sm mb-1">Длабоко размислување</span>
                    <span className="text-xs text-purple-600 text-center">2 есејски прашања за анализа</span>
                </button>
                <button type="button" onClick={() => applyPreset('standard')} className="flex flex-col items-center p-4 border-2 border-green-200 bg-green-50/50 hover:bg-green-100/50 rounded-xl transition-colors shadow-sm">
                    <span className="text-2xl mb-2">📝</span>
                    <span className="font-bold text-green-800 text-sm mb-1">Стандарден тест</span>
                    <span className="text-xs text-green-600 text-center">5 прашања, микс од типови</span>
                </button>
            </div>

            {/* Basic Options (Always visible) */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="numQuestions" className="block text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
                             <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                             Вкупен број на прашања
                        </label>
                        <div className="mt-2 flex items-center gap-4">
                            <input id="numQuestions-slider" type="range" value={state.numQuestions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: Math.max(1, parseInt(e.target.value) || 1)}})} min="1" max="20" className="flex-1 h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary" />
                            <input id="numQuestions" type="number" value={state.numQuestions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'numQuestions', value: Math.max(1, parseInt(e.target.value) || 1)}})} min="1" max="20" className="w-20 p-3 text-center border-2 font-bold border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm" />
                        </div>
                    </div>
                </div>

                {/* А1: Contextual Illustrations toggle */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <ICONS.gallery className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-800">Вклучи AI илустрација</h4>
                            <p className="text-xs text-gray-500">Генерирај контекстуална слика за работниот лист (Imagen 3)</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={state.includeIllustration}
                            onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'includeIllustration', value: e.target.checked } })}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </div>

            {/* Advanced Options Accordion */}
            <div className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm mt-4">
                <button 
                    type="button" 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <span className="font-bold text-gray-700 flex items-center gap-2">
                        <ICONS.settings className="w-5 h-5 text-gray-500" />
                        Напредни подесувања
                        <span className="text-xs font-normal text-gray-500 hidden sm:inline ml-2">(Типови прашања, Блумова таксономија, Диференцијација)</span>
                    </span>
                    <ICONS.chevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {showAdvanced && (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                 <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                 Типови на прашања
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries({ [QuestionType.MULTIPLE_CHOICE]: 'Понудени одговори', [QuestionType.SHORT_ANSWER]: 'Краток одговор', [QuestionType.TRUE_FALSE]: 'Точно/Неточно', [QuestionType.ESSAY]: 'Есејско прашање', [QuestionType.FILL_IN_THE_BLANK]: 'Дополни реченица' }).map(([type, label]) => (
                                    <div key={type}>
                                        <label htmlFor={`q-type-${type}`} className={`cursor-pointer px-4 py-2 rounded-full text-xs font-bold transition-all border-2 ${state.questionTypes.includes(type as QuestionType) ? 'bg-brand-primary border-brand-primary text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                                            <input id={`q-type-${type}`} type="checkbox" checked={state.questionTypes.includes(type as QuestionType)} onChange={() => dispatch({ type: 'TOGGLE_QUESTION_TYPE', payload: type as QuestionType })} className="sr-only" />
                                            {state.questionTypes.includes(type as QuestionType) && <span className="mr-1 inline-block">✓</span>}
                                            {label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                 <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                 Ниво на диференцијација
                            </label>
                            <div className="flex items-center space-x-6 mb-4 bg-gray-50 p-2 border border-gray-100 rounded-xl inline-flex">
                                <div className="flex items-center cursor-pointer">
                                    <input id="diff-type-standard" name="diff-type" type="radio" checked={!state.useStudentProfiles} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'useStudentProfiles', value: false }})} className="h-4 w-4 text-brand-primary border-gray-300 focus:ring-brand-primary cursor-pointer" />
                                    <label htmlFor="diff-type-standard" className="ml-2 block text-sm font-bold text-gray-700 cursor-pointer">Според ниво</label>
                                </div>
                                <div className={`flex items-center cursor-pointer ${!user?.studentProfiles || user.studentProfiles.length === 0 ? 'opacity-50' : ''}`}>
                                    <input id="diff-type-profile" name="diff-type" type="radio" checked={state.useStudentProfiles} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'useStudentProfiles', value: true }})} className="h-4 w-4 text-brand-primary border-gray-300 focus:ring-brand-primary cursor-pointer" disabled={!user?.studentProfiles || user.studentProfiles.length === 0}/>
                                    <label htmlFor="diff-type-profile" className="ml-2 block text-sm font-bold text-gray-700 cursor-pointer">Според профили на ученици</label>
                                </div>
                            </div>
                            
                            {state.useStudentProfiles ? (
                                <div className="animate-fade-in bg-blue-50/50 p-4 border border-blue-100 rounded-xl">
                                    <select id="student-profiles" multiple value={state.selectedStudentProfileIds} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStudentProfileIds', value: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value) }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800 h-32">
                                        {user?.studentProfiles?.map((p: StudentProfile) => <option key={p.id} value={p.id} className="py-1 px-2 my-0.5 rounded cursor-pointer hover:bg-brand-primary hover:text-white checked:bg-brand-primary checked:text-white">{p.name}</option>)}
                                    </select>
                                    <p className="text-xs text-blue-700 mt-3 font-medium flex items-center gap-1">ℹ️ Држете Ctrl (или Cmd) за да изберете повеќе профили.</p>
                                </div>
                            ) : (
                                <div className="animate-fade-in flex flex-wrap gap-3">
                                    {(['standard', 'support', 'advanced'] as DifferentiationLevel[]).map(level => { 
                                        const labels: Record<DifferentiationLevel, string> = { standard: '⚪ Стандардно', support: '🔵 Поддршка (поедноставено)', advanced: '🔴 За напредни ученици', }; 
                                        return (
                                            <label key={level} htmlFor={`diff-level-${level}`} className={`cursor-pointer px-5 py-3 rounded-xl border-2 text-sm font-bold transition-all ${state.differentiationLevel === level ? 'bg-brand-primary border-brand-primary text-white shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                                <input id={`diff-level-${level}`} name="differentiationLevel" type="radio" value={level} checked={state.differentiationLevel === level} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'differentiationLevel', value: level }})} className="sr-only" />
                                                {labels[level]}
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        
                        <div className="md:col-span-2 pt-6 border-t border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                 <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                                 Нагласок по Блумова таксономија
                                 <span className="ml-1 text-xs font-normal text-gray-500">(опционално)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {BLOOM_LEVELS.map(({ key, label, inactiveClass, activeClass }) => {
                                    const isActive = state.bloomDistribution[key] !== undefined;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => {
                                                const newDist = { ...state.bloomDistribution };
                                                if (newDist[key] !== undefined) delete newDist[key];
                                                else newDist[key] = 1;
                                                dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: newDist } });
                                            }}
                                            className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${isActive ? activeClass : `bg-white ${inactiveClass} hover:opacity-80`}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {Object.keys(state.bloomDistribution).length > 0 && (
                                <p className="text-xs text-brand-primary font-bold mt-3 bg-brand-primary/5 p-3 rounded-lg border border-brand-primary/20">
                                    ✓ AI ќе нагласи: {Object.keys(state.bloomDistribution).map((k) => BLOOM_LEVELS.find(b => b.key === k)?.label).join(' → ')}
                                </p>
                            )}
                        </div>
                        
                        <div className="md:col-span-2 pt-2 mt-2">
                            <label className="flex items-start cursor-pointer p-4 bg-gray-50 rounded-xl border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center h-5 mt-0.5">
                                    <input id="includeSelfAssessment" name="includeSelfAssessment" type="checkbox" checked={state.includeSelfAssessment} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'includeSelfAssessment', value: e.target.checked }})} className="focus:ring-brand-secondary h-5 w-5 text-brand-primary border-gray-300 rounded" />
                                </div>
                                <div className="ml-3 text-sm">
                                    <span className="font-bold text-gray-800 block">Вклучи прашања за самооценување</span>
                                    <span className="text-gray-500 mt-1 block">Додава 2-3 метакогнитивни прашања (пр. "Колку беше сигурен во одговорот?") на крајот.</span>
                                </div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ExitTicketOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div>
                <label htmlFor="exit-ticket-q-count" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Број на прашања
                </label>
                <input id="exit-ticket-q-count" type="number" value={state.exitTicketQuestions} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'exitTicketQuestions', value: Math.max(1, Math.min(3, parseInt(e.target.value) || 1)) }})} min="1" max="3" className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800" />
            </div>
            <div>
                <label htmlFor="exit-ticket-focus" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Фокус на прашањата
                </label>
                <select id="exit-ticket-focus" value={state.exitTicketFocus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'exitTicketFocus', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                    <option>Проверка на разбирање</option>
                    <option>Рефлексија на учењето</option>
                    <option>Поврзување со претходно знаење</option>
                </select>
            </div>
        </div>
    </div>
);

const RubricOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="activityTitle" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                         <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                         Наслов на активноста за рубриката
                    </label>
                    <input id="activityTitle" value={state.activityTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityTitle', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800" placeholder="пр. Проект: Питагорова теорема"/>
                </div>
                <div>
                    <label htmlFor="activityType" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                         <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                         Тип на активност
                    </label>
                    <select id="activityType" value={state.activityType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'activityType', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800">
                        <option>Проект</option><option>Тест</option><option>Работен лист</option><option>Квиз</option><option>Домашна работа</option>
                    </select>
                </div>
            </div>
            <div>
                <label htmlFor="criteriaHints" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                     <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                     Клучни критериуми (опционално, одделени со запирка)
                </label>
                <input id="criteriaHints" value={state.criteriaHints} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'criteriaHints', value: e.target.value }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800" placeholder="пр. Точност, Креативност, Презентација"/>
            </div>
        </div>
    </div>
);

const IllustrationOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
        <div className="animate-fade-in">
            <label htmlFor="illustrationPrompt" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Опис за илустрацијата
            </label>
            <textarea id="illustrationPrompt" value={state.illustrationPrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'illustrationPrompt', value: e.target.value }})} className="block w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm text-gray-800 resize-y" placeholder="пр. Визуелен доказ за Питагорова теорема со квадрати над страните на триаголник" rows={3}></textarea>
            <p className="text-xs text-gray-500 mt-2 bg-white p-3 rounded-lg border border-gray-200/50 inline-block">Опишете ја визуелната идеја. Ако сте прикачиле слика, опишете какви промени сакате да направите на неа.</p>
        </div>
    </div>
);

const LearningPathOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
        <div className="animate-fade-in">
            <label htmlFor="student-profiles-lp" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                 <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                 Избери профили на ученици
            </label>
            <select id="student-profiles-lp" multiple value={state.selectedStudentProfileIds} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'selectedStudentProfileIds', value: Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value) }})} className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800 h-32">
                {user?.studentProfiles?.length ? (
                    user.studentProfiles.map((p: StudentProfile) => <option key={p.id} value={p.id} className="py-1 px-2 my-0.5 rounded cursor-pointer hover:bg-brand-primary hover:text-white checked:bg-brand-primary checked:text-white">{p.name}</option>)
                ) : (
                    <option disabled>Немате креирано профили. Одете во Поставки.</option>
                )}
            </select>
            <p className="text-xs text-blue-700 font-medium mt-3 flex items-center gap-1">ℹ️ Држете Ctrl (или Cmd) за да изберете повеќе профили. AI ќе генерира посебна патека за секој избран профил.</p>
        </div>
    </div>
);


export const MaterialOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => {
    const { materialType } = state;
    
    if (!materialType) return null;

    if (['ASSESSMENT', 'FLASHCARDS', 'QUIZ'].includes(materialType)) {
        return <AssessmentOptions state={state} dispatch={dispatch} user={user} />;
    }
    if (materialType === 'SCENARIO') {
        return <ScenarioOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'EXIT_TICKET') {
        return <ExitTicketOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'RUBRIC') {
        return <RubricOptions state={state} dispatch={dispatch} />;
    }
    if (materialType === 'ILLUSTRATION') {
        return <IllustrationOptions state={state} dispatch={dispatch} />;
    }
     if (materialType === 'LEARNING_PATH') {
        return <LearningPathOptions state={state} dispatch={dispatch} user={user} />;
    }

    return null;
};