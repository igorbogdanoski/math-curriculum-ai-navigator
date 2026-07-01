import React from 'react';
import type { StudentProfile } from '../../../types';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const LearningPathOptions: React.FC<MaterialOptionsProps> = ({ state, dispatch, user }) => (
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
