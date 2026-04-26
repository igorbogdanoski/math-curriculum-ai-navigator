import React from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import type { LoopExplanation } from '../../hooks/useStudentLearningLoop';

const STEP_META = [
  { icon: '🤔', label: 'Зошто се случи ова?' },
  { icon: '✏️', label: 'Правилниот пристап' },
  { icon: '💡', label: 'Конкретен пример' },
] as const;

interface MisconceptionExplainerProps {
  explanation: LoopExplanation;
  stepIndex: number;
  onNext: () => void;
}

export const MisconceptionExplainer: React.FC<MisconceptionExplainerProps> = ({
  explanation,
  stepIndex,
  onNext,
}) => {
  const step = STEP_META[stepIndex];
  const text = explanation.steps[stepIndex];
  const isLast = stepIndex === 2;

  return (
    <div className="w-full max-w-4xl mt-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-amber-400" />
        <span className="text-white font-bold text-sm">Мини-лекција</span>
        <span className="ml-auto text-white/50 text-xs font-semibold">
          {explanation.commonMistake}
        </span>
      </div>

      {/* Step card */}
      <div className="bg-white/10 border border-white/20 rounded-2xl p-5 backdrop-blur-sm">
        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-4">
          {STEP_META.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i <= stepIndex ? 'bg-amber-400 scale-110' : 'bg-white/20'
              }`}
            />
          ))}
          <span className="ml-auto text-white/50 text-xs font-bold">
            {stepIndex + 1} / 3
          </span>
        </div>

        {/* Step label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl" aria-hidden="true">{step.icon}</span>
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">
            {step.label}
          </p>
        </div>

        {/* Step content */}
        <p className="text-white text-sm leading-relaxed mb-5">{text}</p>

        {/* CTA */}
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-900 font-bold text-sm px-5 py-2.5 rounded-xl transition active:scale-95"
          aria-label={isLast ? 'Разбрав — следен чекор' : 'Следно објаснување'}
        >
          {isLast ? 'Разбрав ✓' : 'Следно'}
          {!isLast && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
