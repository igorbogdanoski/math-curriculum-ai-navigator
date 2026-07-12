import React from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const InfographicOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
  <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
    <div className="animate-fade-in">
      <label htmlFor="infographicTopic" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
        Поим или објект за инфографикот
      </label>
      <textarea
        id="infographicTopic"
        value={state.infographicTopic}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'infographicTopic', value: e.target.value } })}
        className="block w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm text-gray-800 resize-y"
        placeholder="пр. Правилна четиристрана пирамида, Транспортир, Архимедово тело"
        rows={2}
      />
      <p className="text-xs text-gray-500 mt-2 bg-white p-3 rounded-lg border border-gray-200/50 inline-block">
        Генерира централна слика (без текст) + означени секции (Преглед, Компоненти, Спецификации, Примена...) на MK/SQ/TR/EN.
      </p>
    </div>
  </div>
);
