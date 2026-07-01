import React from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const ExitTicketOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
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
