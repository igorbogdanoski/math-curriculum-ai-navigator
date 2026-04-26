import React from 'react';
import { RefreshCw, BookOpen, ArrowRight } from 'lucide-react';

interface StudentNextStepCardProps {
  quizId?: string;
  conceptId?: string;
  conceptTitle?: string;
}

/**
 * Always-shown "what to do next" card after a failed quiz loop.
 * Provides two actions: retry the quiz, or study the concept.
 */
export const StudentNextStepCard: React.FC<StudentNextStepCardProps> = ({
  quizId,
  conceptId,
  conceptTitle,
}) => {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleStudy = () => {
    if (conceptId) {
      window.location.hash = `/concept/${conceptId}`;
    } else {
      window.location.hash = '/';
    }
  };

  return (
    <div className="w-full max-w-4xl mt-4 animate-fade-in">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden="true">📌</span>
          <p className="text-white font-bold text-sm">Следен чекор</p>
        </div>

        <p className="text-white/80 text-sm mb-4 leading-relaxed">
          Сега кога го знаеш каде погрешил{conceptTitle ? ` за „${conceptTitle}"` : ''}, обиди се повторно —
          овој пат ќе ти биде многу полесно!
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 bg-white text-indigo-700 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition active:scale-95"
            aria-label="Обиди се повторно со квизот"
          >
            <RefreshCw className="w-4 h-4" />
            Обиди се повторно
          </button>

          <button
            type="button"
            onClick={handleStudy}
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition border border-white/20 active:scale-95"
            aria-label={conceptId ? 'Оди до концептот за повеќе информации' : 'Оди на почетна страница'}
          >
            <BookOpen className="w-4 h-4" />
            {conceptId ? 'Учи повеќе' : 'Почетна'}
            <ArrowRight className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
};
