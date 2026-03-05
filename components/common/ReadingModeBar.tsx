import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ReadingModeState {
  active: boolean;
  fontSize: 'normal' | 'large' | 'xl';
  dyslexicFont: boolean;
  highlightNumbers: boolean;
  sequential: boolean;
  sequentialStep: number;
}

export const defaultReadingMode: ReadingModeState = {
  active: false,
  fontSize: 'normal',
  dyslexicFont: false,
  highlightNumbers: true,
  sequential: false,
  sequentialStep: 0,
};

interface Props {
  mode: ReadingModeState;
  onChange: (patch: Partial<ReadingModeState>) => void;
  totalChunks: number;
}

export const ReadingModeBar: React.FC<Props> = ({ mode, onChange, totalChunks }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 flex-wrap text-xs">
      <span className="text-amber-700 font-bold shrink-0">👁️ Режим за читање</span>

      {/* Font size */}
      <div className="flex bg-white rounded border border-amber-200 overflow-hidden">
        {(['normal', 'large', 'xl'] as const).map((sz, i) => (
          <button
            key={sz}
            onClick={() => onChange({ fontSize: sz })}
            className={`px-2 py-1 font-bold transition-colors ${mode.fontSize === sz ? 'bg-amber-400 text-white' : 'text-gray-500 hover:bg-amber-50'}`}
            title={['Нормален текст', 'Голем текст', 'Многу голем текст'][i]}
          >
            {['А', 'А+', 'А++'][i]}
          </button>
        ))}
      </div>

      {/* Dyslexic font */}
      <button
        onClick={() => onChange({ dyslexicFont: !mode.dyslexicFont })}
        className={`px-2 py-1 rounded border font-bold transition-colors ${mode.dyslexicFont ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-500 border-amber-200 hover:bg-purple-50'}`}
        title="OpenDyslexic фонт за полесно читање"
      >
        Дислексија
      </button>

      {/* Highlight numbers */}
      <button
        onClick={() => onChange({ highlightNumbers: !mode.highlightNumbers })}
        className={`px-2 py-1 rounded border font-bold transition-colors ${mode.highlightNumbers ? 'bg-yellow-400 text-gray-800 border-yellow-400' : 'bg-white text-gray-500 border-amber-200 hover:bg-yellow-50'}`}
        title="Истакни ги бројките со боја"
      >
        🔢 Бројки
      </button>

      {/* Sequential reading */}
      <button
        onClick={() => onChange({ sequential: !mode.sequential, sequentialStep: 0 })}
        className={`px-2 py-1 rounded border font-bold transition-colors ${mode.sequential ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-gray-500 border-amber-200 hover:bg-teal-50'}`}
        title="Прикажи задачата чекор по чекор"
      >
        📄 Чекор по чекор
      </button>

      {/* Sequential navigation arrows */}
      {mode.sequential && totalChunks > 1 && (
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onChange({ sequentialStep: Math.max(0, mode.sequentialStep - 1) })}
            disabled={mode.sequentialStep === 0}
            className="p-1 rounded bg-white border border-amber-200 disabled:opacity-30 hover:bg-amber-50 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-amber-700 font-bold min-w-[3rem] text-center">
            {mode.sequentialStep + 1} / {totalChunks}
          </span>
          <button
            onClick={() => onChange({ sequentialStep: Math.min(totalChunks - 1, mode.sequentialStep + 1) })}
            disabled={mode.sequentialStep >= totalChunks - 1}
            className="p-1 rounded bg-white border border-amber-200 disabled:opacity-30 hover:bg-amber-50 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
