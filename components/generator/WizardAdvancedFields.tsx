import React from 'react';
import { ICONS } from '../../constants';
import { DOK_META, type DokLevel } from '../../types';
import { BloomSliders } from './BloomSliders';
import type { GeneratorState, GeneratorAction } from '../../hooks/useGeneratorState';

interface WizardAdvancedFieldsProps {
  state: GeneratorState;
  dispatch: React.Dispatch<GeneratorAction>;
  teacherNote: string;
  setTeacherNote: (value: string) => void;
  teacherNoteSaved: boolean;
  onSaveTeacherNote: () => void;
}

export const WizardAdvancedFields: React.FC<WizardAdvancedFieldsProps> = ({
  state,
  dispatch,
  teacherNote,
  setTeacherNote,
  teacherNoteSaved,
  onSaveTeacherNote,
}) => {
  const isQuizOrAssessment = state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT';

  return (
    <>
      {/* П7: Bloom's Taxonomy слајдери — само за QUIZ и ASSESSMENT */}
      {isQuizOrAssessment && (
        <BloomSliders
          value={state.bloomDistribution}
          onChange={(dist) => dispatch({ type: 'SET_FIELD', payload: { field: 'bloomDistribution', value: dist } })}
        />
      )}

      {/* Webb's DoK target — само за QUIZ и ASSESSMENT */}
      {isQuizOrAssessment && (
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
          <p className="text-xs font-black text-gray-600 uppercase tracking-widest mb-3">Webb's Depth of Knowledge (DoK)</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: undefined } })}
              className={`col-span-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                state.dokTarget === undefined
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              Авто (AI одлучува)
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: 'mixed' } })}
              className={`col-span-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                state.dokTarget === 'mixed'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}
            >
              🎯 Мешана распределба (DoK 1→4)
            </button>
            {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
              const m = DOK_META[lvl];
              const active = state.dokTarget === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'dokTarget', value: lvl } })}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-bold border transition-all ${
                    active ? `${m.color} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${active ? m.dot : 'bg-gray-300'}`} />
                  {m.label}
                  <span className="font-normal opacity-70 text-center leading-none">{m.mk}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Г3-alt: Teacher note for selected concept */}
      {state.contextType === 'CONCEPT' && state.selectedConcepts[0] && (
        <div className="mt-6 border-t pt-6">
          <label htmlFor="teacherNote" className="block text-sm font-bold text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <ICONS.edit className="w-4 h-4 text-indigo-500" />
              Мои белешки за концептот
              <span className="text-xs font-normal text-gray-400">(се injection-ираат во AI при генерирање)</span>
            </div>
          </label>
          <textarea
            id="teacherNote"
            value={teacherNote}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTeacherNote(e.target.value)}
            rows={3}
            className="block w-full p-3 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white resize-none text-sm"
            placeholder="Пр. 'Учениците имаат тешкотии со именките во множина. Фокусирај се на практични примери со пари и мерки.'"
          />
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={onSaveTeacherNote}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${teacherNoteSaved ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
            >
              {teacherNoteSaved ? '✓ Зачувано' : 'Зачувај белешка'}
            </button>
          </div>
        </div>
      )}

      {/* AI Персонализација */}
      <div className="mt-6 border-t pt-6">
        <div className="flex items-center gap-2 mb-4">
          <ICONS.sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-gray-700">AI Персонализација</span>
          <span className="text-xs text-gray-400">(прилагоди го стилот на генерирањето)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="aiTone" className="block text-xs font-semibold text-gray-600 mb-1.5">Тон</label>
            <select
              id="aiTone"
              value={state.aiTone}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiTone', value: e.target.value } })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
            >
              <option value="creative">🎨 Креативен</option>
              <option value="formal">📐 Формален</option>
              <option value="friendly">😊 Пријателски</option>
              <option value="expert">🔬 Стручен</option>
              <option value="playful">🎮 Игровен</option>
            </select>
          </div>
          <div>
            <label htmlFor="aiVocabLevel" className="block text-xs font-semibold text-gray-600 mb-1.5">Ниво на речник</label>
            <select
              id="aiVocabLevel"
              value={state.aiVocabLevel}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiVocabLevel', value: e.target.value } })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
            >
              <option value="simplified">📗 Поедноставен</option>
              <option value="standard">📘 Стандарден</option>
              <option value="advanced">📙 Напреден</option>
            </select>
          </div>
          <div>
            <label htmlFor="aiStyle" className="block text-xs font-semibold text-gray-600 mb-1.5">Образовен стил</label>
            <select
              id="aiStyle"
              value={state.aiStyle}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'aiStyle', value: e.target.value } })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-300"
            >
              <option value="standard">📋 Стандарден</option>
              <option value="socratic">🤔 Сократски</option>
              <option value="direct">➡️ Директен</option>
              <option value="inquiry">🔍 Истражувачки</option>
              <option value="problem">🧩 Проблемски</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="customInstruction" className="block text-sm font-bold text-gray-700 mb-2">
            <div className="flex items-center gap-2"><ICONS.sparkles className="w-4 h-4 text-brand-primary" />Дополнителни инструкции до AI (опционално)</div>
          </label>
          <textarea
            id="customInstruction"
            value={state.customInstruction}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'customInstruction', value: e.target.value } })}
            rows={2}
            className="block w-full p-3 border-gray-300 rounded-xl bg-gray-50 focus:bg-white resize-none"
            placeholder="Пр. 'Направи го потешко', 'Додај повеќе визуелни примери'..."
          />
        </div>

        <div className="flex items-center">
          <label className="flex items-start cursor-pointer p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors w-full">
            <div className="flex items-center h-5 mt-0.5">
              <input
                type="checkbox"
                checked={state.useMacedonianContext}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'SET_FIELD', payload: { field: 'useMacedonianContext', value: e.target.checked } })}
                className="focus:ring-brand-secondary h-5 w-5 text-brand-primary border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <span className="font-bold text-gray-800 block">Локален контекст</span>
              <span className="text-gray-500 block leading-tight mt-1">Користи примери од локалната средина (денари, македонски градови, имиња).</span>
            </div>
          </label>
        </div>
      </div>
    </>
  );
};
