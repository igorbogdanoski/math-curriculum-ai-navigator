import React from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';

const AGE_RANGES: { value: '4-6' | '7-9' | '10-12'; label: string }[] = [
  { value: '4-6', label: '4–6 години' },
  { value: '7-9', label: '7–9 години' },
  { value: '10-12', label: '10–12 години' },
];

export const StoryBookOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => (
  <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6 space-y-4">
    <div>
      <label htmlFor="storyBookTopic" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
        Математички поим за приказната
      </label>
      <textarea
        id="storyBookTopic"
        value={state.storyBookTopic}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'storyBookTopic', value: e.target.value } })}
        className="block w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm text-gray-800 resize-y"
        placeholder="пр. Собирање со преминување на десетица"
        rows={2}
      />
    </div>

    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
        Возрасна група
      </label>
      <div className="flex gap-2">
        {AGE_RANGES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'storyBookAgeRange', value } })}
            className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              state.storyBookAgeRange === value
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-primary/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <label htmlFor="storyBookPageCount" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
        Број на страници ({state.storyBookPageCount})
      </label>
      <input
        id="storyBookPageCount"
        type="range"
        min={4}
        max={10}
        step={1}
        value={state.storyBookPageCount}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'storyBookPageCount', value: Number(e.target.value) } })}
        className="w-full accent-brand-primary"
      />
      <p className="text-xs text-gray-500 mt-2 bg-white p-3 rounded-lg border border-gray-200/50 inline-block">
        Секоја страница добива своја AI илустрација (без текст на сликата) + текст-нарација на MK/SQ/TR/EN.
      </p>
    </div>
  </div>
);
