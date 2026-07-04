import React from 'react';

export interface ReflectionState {
  wentWell: string;
  challenges: string;
  nextSteps: string;
}

interface ReflectionModalProps {
  reflection: ReflectionState;
  onChange: (field: keyof ReflectionState, value: string) => void;
  onSkip: () => void;
  onSaveAndContinue: () => void;
}

export const ReflectionModal: React.FC<ReflectionModalProps> = ({ reflection, onChange, onSkip, onSaveAndContinue }) => {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🪞</span>
          </div>
          <div>
            <p className="font-black text-gray-900 text-sm">Метакогнитивна рефлексија</p>
            <p className="text-xs text-gray-500">2 минути — опционо, останува со подготовката</p>
          </div>
        </div>
        {(['wentWell', 'challenges', 'nextSteps'] as const).map((field, i) => (
          <div key={field}>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
              {i === 0 ? '💚 Што успеа во часот?' : i === 1 ? '🔶 Каде беше предизвик?' : '➡️ Следни чекори / поддршка'}
            </label>
            <textarea
              value={reflection[field]}
              onChange={e => onChange(field, e.target.value)}
              rows={2}
              placeholder={i === 0 ? 'Пр. Учениците беа многу ангажирани при...' : i === 1 ? 'Пр. Временото управување со...' : 'Пр. Иван и Марија имаат потреба од...'}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-gray-300 font-semibold text-sm transition-colors"
          >
            Прескокни
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm transition-colors"
          >
            Зачувај рефлексија
          </button>
        </div>
      </div>
    </div>
  );
};
