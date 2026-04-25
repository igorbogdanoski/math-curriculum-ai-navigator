import React from 'react';
import type { PrintQuestion } from './PrintableExam';

interface AnswerSheetProps {
  title: string;
  variantKey: string;
  questions: PrintQuestion[];
  showAnswers?: boolean;
}

const OPTION_LABELS = ['А', 'Б', 'В', 'Г', 'Д'];

function getBubbleOptions(q: PrintQuestion): string[] {
  if (q.type === 'true_false') return ['Т', 'Н'];
  if (q.type === 'multiple_choice') return OPTION_LABELS.slice(0, q.options?.length ?? 4);
  return [];
}

function getCorrectBubble(q: PrintQuestion): string | null {
  if (q.type === 'true_false') {
    if (!q.answer) return null;
    return q.answer.startsWith('Точно') ? 'Т' : 'Н';
  }
  if (q.type === 'multiple_choice' && q.options && q.answer) {
    const idx = q.options.findIndex(o => o.trim().toLowerCase() === q.answer!.trim().toLowerCase());
    return idx >= 0 ? OPTION_LABELS[idx] : null;
  }
  return null;
}

const bubbleQuestionTypes = new Set(['multiple_choice', 'true_false']);

export const AnswerSheet: React.FC<AnswerSheetProps> = ({
  title,
  variantKey,
  questions,
  showAnswers = false,
}) => {
  const bubbleQs = questions.filter(q => bubbleQuestionTypes.has(q.type));
  const openQs   = questions.filter(q => !bubbleQuestionTypes.has(q.type));

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 12mm; size: A4; }
          .print-break { page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="print-break bg-white text-gray-900 font-sans text-sm p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="border-2 border-gray-800 p-3 mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold">Лист за одговори — {title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Варијанта {variantKey}</p>
          </div>
          <div className="text-right text-xs space-y-1">
            <div>Ime: <span className="border-b border-gray-600 inline-block w-36 ml-1" /></div>
            <div>Одделение: <span className="border-b border-gray-600 inline-block w-20 ml-1" /></div>
          </div>
        </div>

        {/* ZipGrade-style bubble section */}
        {bubbleQs.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Дел I — Заокружи го точниот одговор
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {bubbleQs.map(q => {
                const opts = getBubbleOptions(q);
                const correct = showAnswers ? getCorrectBubble(q) : null;
                return (
                  <div key={q.id} className="flex items-center gap-3 break-inside-avoid">
                    <span className="w-6 text-right text-sm font-semibold text-gray-700 shrink-0">
                      {q.number}.
                    </span>
                    <div className="flex gap-2">
                      {opts.map((lbl, i) => {
                        const isCorrect = correct === lbl;
                        return (
                          <div
                            key={i}
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                              isCorrect
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-gray-500 bg-white text-gray-700'
                            }`}
                          >
                            {lbl}
                          </div>
                        );
                      })}
                    </div>
                    {q.points > 0 && (
                      <span className="text-xs text-gray-400 ml-auto">({q.points})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Open / written section */}
        {openQs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              Дел II — Пишани одговори
            </p>
            <div className="space-y-4">
              {openQs.map(q => (
                <div key={q.id} className="break-inside-avoid">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-700 shrink-0">{q.number}.</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-800">{q.text}</span>
                      <span className="text-xs text-gray-400 ml-1">({q.points} бод.)</span>
                      {showAnswers && q.answer && (
                        <div className="mt-0.5 text-xs text-red-600 font-semibold">✓ {q.answer}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 ml-5 space-y-2.5">
                    {Array.from({ length: q.lines ?? 3 }).map((_, i) => (
                      <div key={i} className="border-b border-gray-400 h-5 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ZipGrade note */}
        <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-400 flex items-center justify-between">
          <span>ZipGrade compatible · Варијанта {variantKey}</span>
          <span className="font-mono text-gray-500">
            MC: {bubbleQs.length} · Писмени: {openQs.length}
          </span>
        </div>
      </div>
    </>
  );
};
