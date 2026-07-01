import React from 'react';
import DOMPurify from 'dompurify';
import { Sigma } from 'lucide-react';
import type { ExamQuestion } from '../../services/firestoreService.types';
import { MathInput } from '../common/MathInput';
import { QRSolutionUpload } from '../common/QRSolutionUpload';

interface ExamVariantPlayerProps {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  onAnswer: (questionIndex: number, value: string) => void;
  readonly?: boolean;
  solutionImages?: Record<string, string>;
  onSolutionImage?: (questionIndex: number, url: string) => void;
}

// Per-question math editor toggle (local state isolated per question card)
function OpenAnswerInput({ idx, type, value, onChange, disabled, solutionImageUrl, onSolutionImage }: {
  idx: number;
  type: 'short_answer' | 'calculation' | 'essay';
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  solutionImageUrl?: string;
  onSolutionImage?: (url: string) => void;
}) {
  const [useMath, setUseMath] = React.useState(false);
  const rows = type === 'essay' ? 6 : type === 'calculation' ? 4 : 2;
  const placeholder = type === 'calculation'
    ? 'Покажи ја работата чекор по чекор…'
    : type === 'essay' ? 'Напиши го твојот одговор…' : 'Твојот одговор…';
  const showQR = type !== 'short_answer';

  return (
    <div className="space-y-2">
      {!disabled && type !== 'short_answer' && (
        <button
          type="button"
          onClick={() => setUseMath(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${useMath ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
        >
          <Sigma className="w-3.5 h-3.5" />
          {useMath ? 'Мат. уредник вклучен' : 'Вклучи мат. уредник'}
        </button>
      )}

      {useMath && !disabled ? (
        <MathInput value={value} onChange={onChange} placeholder={placeholder} className="w-full" />
      ) : (
        <textarea
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:outline-none resize-none text-sm text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-default"
        />
      )}

      {showQR && onSolutionImage && (
        <QRSolutionUpload
          questionKey={`exam_q${idx}`}
          onImageUrl={onSolutionImage}
          disabled={disabled}
          existingUrl={solutionImageUrl}
        />
      )}
    </div>
  );
}

export const ExamVariantPlayer: React.FC<ExamVariantPlayerProps> = ({
  questions,
  answers,
  onAnswer,
  readonly = false,
  solutionImages = {},
  onSolutionImage,
}) => {
  return (
    <div className="space-y-8">
      {questions.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold">
              {idx + 1}
            </span>
            <div className="flex-1">
              <p className="text-gray-900 font-medium leading-relaxed">{q.question}</p>
              {q.svgDiagram && (
                <div
                  className="mt-3 p-2 bg-gray-50 rounded-lg overflow-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.svgDiagram, { USE_PROFILES: { svg: true }, FORBID_TAGS: ['script','style'] }) }}
                />
              )}
            </div>
            <span className="text-xs text-gray-400 font-mono whitespace-nowrap">{q.points} бод.</span>
          </div>

          {q.type === 'multiple_choice' && q.options && (
            <div className="space-y-2 ml-11">
              {q.options.map((opt, oi) => {
                const label = ['А', 'Б', 'В', 'Г'][oi] ?? String(oi + 1);
                const isSelected = answers[`q${idx}`] === opt;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={readonly}
                    onClick={() => onAnswer(idx, opt)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                    } ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                        isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      {label}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {(q.type === 'short_answer' || q.type === 'calculation' || q.type === 'essay') && (
            <div className="ml-11">
              <OpenAnswerInput
                idx={idx}
                type={q.type}
                value={answers[`q${idx}`] ?? ''}
                onChange={v => onAnswer(idx, v)}
                disabled={readonly}
                solutionImageUrl={solutionImages[`q${idx}`]}
                onSolutionImage={onSolutionImage ? url => onSolutionImage(idx, url) : undefined}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
