import React from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const RubricOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
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
