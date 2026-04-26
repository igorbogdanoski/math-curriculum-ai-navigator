import React, { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import type { VerificationQuestion } from '../../hooks/useStudentLearningLoop';

interface VerificationMicroQuizProps {
  questions: VerificationQuestion[];
  conceptTitle: string;
  onComplete: (score: number, total: number) => void;
}

export const VerificationMicroQuiz: React.FC<VerificationMicroQuizProps> = ({
  questions,
  conceptTitle,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[currentIndex];
  const isCorrect = selected === question?.answer;
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = (option: string) => {
    if (confirmed) return;
    setSelected(option);
  };

  const handleConfirm = () => {
    if (!selected || confirmed) return;
    if (isCorrect) setCorrectCount(c => c + 1);
    setConfirmed(true);
  };

  const handleNext = () => {
    if (isLast) {
      onComplete(correctCount + (isCorrect ? 1 : 0), questions.length);
      return;
    }
    setCurrentIndex(i => i + 1);
    setSelected(null);
    setConfirmed(false);
  };

  if (!question) return null;

  return (
    <div className="w-full max-w-4xl mt-4 bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <p className="text-amber-300 font-bold text-sm uppercase tracking-wide">
          Проверка — {conceptTitle}
        </p>
        <span className="text-white/50 text-xs font-medium">
          {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <p className="text-white font-semibold text-base mb-4 leading-relaxed">
        {question.question}
      </p>

      <div className="space-y-2">
        {question.options.map((option, i) => {
          let cls =
            'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ';
          if (!confirmed) {
            cls +=
              selected === option
                ? 'bg-indigo-500/30 border-indigo-400 text-white'
                : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/40 cursor-pointer';
          } else if (option === question.answer) {
            cls += 'bg-emerald-500/20 border-emerald-400 text-emerald-300';
          } else if (option === selected) {
            cls += 'bg-red-500/20 border-red-400 text-red-300';
          } else {
            cls += 'bg-white/5 border-white/10 text-white/40 cursor-default';
          }

          return (
            <button
              key={i}
              className={cls}
              onClick={() => handleSelect(option)}
              disabled={confirmed}
            >
              <span className="mr-2 font-bold opacity-60">{String.fromCharCode(65 + i)}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {confirmed && (
        <div
          className={`mt-4 flex items-center gap-2 text-sm font-semibold animate-fade-in ${
            isCorrect ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isCorrect ? (
            <>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Точно! Одлично!
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Точен одговор: <span className="text-white/80 ml-1">{question.answer}</span>
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        {!confirmed && (
          <button
            disabled={!selected}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-indigo-400 transition-colors"
          >
            Потврди
          </button>
        )}
        {confirmed && (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 transition-colors"
          >
            {isLast ? 'Заврши проверката' : 'Следно прашање'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
