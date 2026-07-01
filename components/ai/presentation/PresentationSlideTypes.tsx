/**
 * Presentation slide type sub-components, extracted from GeneratedPresentation.tsx.
 * Each component renders a specific slide layout.
 */
import React, { useState } from 'react';
import { MathRenderer } from '../../common/MathRenderer';

export type PresentationTheme = 'modern' | 'classic' | 'dark' | 'creative';

// ─── Step-by-step slide ───────────────────────────────────────────────────────

const STEP_ACCENT: Record<string, string[]> = {
  modern:   ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'],
  classic:  ['bg-gray-700', 'bg-gray-600', 'bg-gray-500', 'bg-gray-400'],
  dark:     ['bg-indigo-500', 'bg-indigo-400', 'bg-indigo-300', 'bg-indigo-200'],
  creative: ['bg-orange-600', 'bg-orange-500', 'bg-amber-500', 'bg-amber-400'],
};

export const StepByStepSlide: React.FC<{ steps: string[]; theme: PresentationTheme }> = ({ steps, theme }) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const accents = STEP_ACCENT[theme];
  const total = steps.length;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200/40 rounded-full overflow-hidden mb-1">
        {/* eslint-disable-next-line react/forbid-component-props */}
        <div
          className={`h-full rounded-full transition-all duration-500 pres-progress-${theme}`}
          style={{ width: activeStep !== null ? `${((activeStep + 1) / total) * 100}%` : '0%' }}
        />
      </div>

      {steps.map((step, idx) => {
        const isActive = activeStep === idx;
        const isDone   = activeStep !== null && idx < activeStep;
        const accent   = accents[idx % accents.length];
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveStep(isActive ? null : idx)}
            className={`flex items-start gap-4 text-left w-full rounded-2xl px-4 py-3 transition-all duration-300 border-2 group ${
              isActive
                ? theme === 'dark'
                  ? 'border-indigo-400 bg-indigo-400/10'
                  : 'border-blue-400 bg-blue-50/80 shadow-md'
                : isDone
                  ? 'border-transparent bg-green-50/30 opacity-70'
                  : 'border-transparent hover:bg-black/5'
            }`}
          >
            {/* Step number badge */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white transition-all duration-300 ${
              isDone ? 'bg-green-500' : isActive ? accent : 'bg-gray-300 group-hover:bg-gray-400'
            }`}>
              {isDone ? '✓' : idx + 1}
            </div>

            {/* Step text */}
            <div className={`flex-1 text-lg leading-snug transition-colors duration-200 ${
              isActive
                ? theme === 'dark' ? 'text-white font-bold' : 'text-blue-900 font-bold'
                : theme === 'dark' ? 'text-indigo-200' : 'text-gray-700'
            }`}>
              <MathRenderer text={step} />
            </div>
          </button>
        );
      })}

      <p className="text-[10px] text-gray-400 text-center mt-1 uppercase tracking-widest font-bold">
        {activeStep !== null ? `Чекор ${activeStep + 1} / ${total}` : 'Кликни за да продолжиш'}
      </p>
    </div>
  );
};

// ─── Formula-centered slide ───────────────────────────────────────────────────

export const FormulaCenteredSlide: React.FC<{ content: string[]; theme: PresentationTheme }> = ({ content, theme }) => {
  const [formula, ...notes] = content;
  const borderColor = theme === 'dark' ? 'border-indigo-400/50' : theme === 'creative' ? 'border-amber-400/50' : 'border-brand-primary/30';
  const formulaColor = theme === 'dark' ? 'text-indigo-200' : theme === 'creative' ? 'text-orange-700' : 'text-brand-primary';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-6 py-4">
      {/* Central formula box */}
      <div className={`w-full max-w-2xl rounded-3xl border-2 ${borderColor} px-10 py-8 text-center shadow-lg bg-black/3`}>
        <div className={`text-4xl font-black leading-tight tracking-tight ${formulaColor}`}>
          <MathRenderer text={formula} />
        </div>
      </div>

      {/* Supporting notes */}
      {notes.length > 0 && (
        <ul className="space-y-2 w-full max-w-xl">
          {notes.map((note, i) => (
            <li key={i} className={`flex items-start gap-3 text-base ${theme === 'dark' ? 'text-indigo-200' : 'text-gray-600'}`}>
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-indigo-400' : 'bg-brand-primary/60'}`} />
              <MathRenderer text={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Proof slide ──────────────────────────────────────────────────────────────

export const ProofSlide: React.FC<{ steps: string[]; theme: PresentationTheme }> = ({ steps, theme }) => {
  const [revealed, setRevealed] = useState(0);
  const accentBg  = theme === 'dark' ? 'bg-indigo-600' : theme === 'creative' ? 'bg-purple-600' : 'bg-brand-primary';
  const revealed_ = theme === 'dark' ? 'border-indigo-400 bg-indigo-900/30' : 'border-brand-primary/40 bg-blue-50/80';
  const hidden_   = 'border-transparent bg-black/5 opacity-40';
  return (
    <div className="flex flex-col gap-2 w-full">
      {steps.map((step, idx) => (
        <div key={idx} className={`flex items-start gap-3 rounded-xl px-4 py-2.5 border transition-all duration-300 ${idx < revealed ? revealed_ : hidden_}`}>
          <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${idx < revealed ? accentBg : 'bg-gray-300'}`}>
            {idx + 1}
          </div>
          <span className={`text-base leading-snug ${theme === 'dark' ? 'text-indigo-100' : 'text-gray-700'}`}>
            <MathRenderer text={step} />
          </span>
        </div>
      ))}
      {revealed < steps.length ? (
        <button type="button" onClick={() => setRevealed(r => r + 1)}
          className={`mt-2 self-start text-sm font-bold px-4 py-2 rounded-xl transition ${
            theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary'
          }`}>
          Следен чекор →
        </button>
      ) : (
        <div className={`mt-3 self-end flex items-center gap-2 text-sm font-black uppercase tracking-widest ${
          theme === 'dark' ? 'text-indigo-300' : 'text-brand-primary'
        }`}>
          <span>Q.E.D.</span><span className="text-xl">□</span>
        </div>
      )}
    </div>
  );
};

// ─── Comparison slide ─────────────────────────────────────────────────────────

export const ComparisonSlide: React.FC<{
  left: string[]; right: string[];
  theme: PresentationTheme;
}> = ({ left, right, theme }) => {
  const colBorder = theme === 'dark' ? 'border-indigo-400/30 bg-indigo-900/20' : theme === 'creative' ? 'border-amber-300/50 bg-amber-50/40' : 'border-gray-200 bg-gray-50/60';
  const dotColor  = theme === 'dark' ? 'bg-indigo-400' : theme === 'creative' ? 'bg-amber-500' : 'bg-brand-primary';
  const textColor = theme === 'dark' ? 'text-indigo-100' : 'text-gray-700';
  const vsColor   = theme === 'dark' ? 'text-indigo-400' : 'text-gray-300';
  const renderCol = (items: string[]) => (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className={`flex items-start gap-3 text-base ${textColor}`}>
          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dotColor}`} />
          <MathRenderer text={item} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="flex gap-3 w-full h-full">
      <div className={`flex-1 rounded-2xl border p-5 ${colBorder}`}>{renderCol(left)}</div>
      <div className={`flex items-center justify-center text-lg font-black ${vsColor}`}>VS</div>
      <div className={`flex-1 rounded-2xl border p-5 ${colBorder}`}>{renderCol(right)}</div>
    </div>
  );
};

// ─── Example / Task slide ─────────────────────────────────────────────────────

export const ExampleSlide: React.FC<{
  content: string[]; solution?: string[];
  theme: PresentationTheme;
  isTask?: boolean;
}> = ({ content, solution, theme, isTask = false }) => {
  const [showSolution, setShowSolution] = useState(false);
  const border = theme === 'dark' ? 'border-indigo-400/50 bg-indigo-900/20' : theme === 'creative' ? 'border-amber-300/50 bg-amber-50/40' : 'border-brand-primary/30 bg-blue-50/50';
  const label  = theme === 'dark' ? 'text-indigo-300' : theme === 'creative' ? 'text-amber-700' : 'text-brand-primary';
  const btn    = theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-brand-primary hover:bg-brand-primary/80';
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className={`rounded-2xl border-2 p-5 ${border}`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${label}`}>{isTask ? '📝 Задача' : '📐 Пример'}</p>
        <ul className="space-y-2">
          {content.map((line, i) => (
            <li key={i} className={`text-base ${theme === 'dark' ? 'text-indigo-100' : 'text-gray-800'}`}>
              <MathRenderer text={line} />
            </li>
          ))}
        </ul>
      </div>
      {solution && solution.length > 0 && (
        !showSolution ? (
          <button type="button" onClick={() => setShowSolution(true)}
            className={`self-start flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-xl transition ${btn}`}>
            Прикажи решение ▾
          </button>
        ) : (
          <div className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
            <p className="text-xs font-black text-green-700 uppercase tracking-widest mb-2">✅ Решение</p>
            <ol className="space-y-2">
              {solution.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-base text-gray-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <MathRenderer text={step} />
                </li>
              ))}
            </ol>
          </div>
        )
      )}
    </div>
  );
};

// ─── Summary slide ────────────────────────────────────────────────────────────

export const SummarySlide: React.FC<{ content: string[]; theme: PresentationTheme }> = ({ content, theme }) => {
  const starColor = theme === 'dark' ? 'text-indigo-300' : theme === 'creative' ? 'text-amber-500' : 'text-brand-primary';
  const textColor = theme === 'dark' ? 'text-indigo-100' : 'text-gray-800';
  return (
    <ul className="space-y-4">
      {content.map((point, idx) => (
        <li key={idx} className={`flex items-start gap-3 text-xl ${textColor}`}>
          <span className={`text-lg flex-shrink-0 mt-0.5 ${starColor}`}>★</span>
          <MathRenderer text={point} />
        </li>
      ))}
    </ul>
  );
};
