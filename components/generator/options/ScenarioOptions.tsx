import React from 'react';
import { ICONS } from '../../../constants';
import { InfoTooltip } from '../../common/InfoTooltip';
import { educationalHints } from '../../../data/educationalModelsInfo';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const ScenarioOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
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
                    <option value="SPECTRA">⬡ SPECTRA рамка — БРО/МОН (препорачано)</option>
                    <option value="AIDA">AIDA метод (Внимание → Интерес → Желба → Акција)</option>
                </select>
            </div>
        </div>

        {/* Contextual Illustrations toggle */}
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
