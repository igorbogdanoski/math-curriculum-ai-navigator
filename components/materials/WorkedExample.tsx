import React, { useState } from 'react';
import { ChevronRight, CheckCircle2, BookOpen, PenLine, Lightbulb } from 'lucide-react';
import type { AIGeneratedWorkedExample, WorkedExampleStep } from '../../types';

interface Props {
  example: AIGeneratedWorkedExample;
}

const PHASE_META: Record<string, { icon: React.ReactNode; color: string; badge: string }> = {
  solved: {
    icon: <BookOpen className="w-5 h-5 text-blue-600" />,
    color: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
  partial: {
    icon: <PenLine className="w-5 h-5 text-amber-600" />,
    color: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  quiz: {
    icon: <Lightbulb className="w-5 h-5 text-green-600" />,
    color: 'border-green-200 bg-green-50',
    badge: 'bg-green-100 text-green-700',
  },
};

const PHASE_LABEL: Record<string, string> = {
  solved: 'I do — Гледај',
  partial: 'We do — Заврши',
  quiz: 'You do — Самостојно',
};

function StepCard({ step, onNext, isLast }: { step: WorkedExampleStep; onNext: () => void; isLast: boolean }) {
  const meta = PHASE_META[step.phase] ?? PHASE_META.solved;
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className={`rounded-2xl border-2 p-5 ${meta.color}`}>
      {/* Phase badge */}
      <div className="flex items-center gap-2 mb-3">
        {meta.icon}
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${meta.badge}`}>
          {PHASE_LABEL[step.phase]}
        </span>
      </div>

      {/* Title + problem */}
      <h3 className="font-black text-slate-800 text-base mb-1">{step.title}</h3>
      <p className="text-sm font-semibold text-slate-700 bg-white/60 rounded-xl px-3 py-2 mb-4 border border-white/80">
        📐 {step.problem}
      </p>

      {/* Solved: show all steps */}
      {step.phase === 'solved' && step.solution && step.solution.length > 0 && (
        <ol className="space-y-2 mb-4">
          {step.solution.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Partial: show partial steps + input */}
      {step.phase === 'partial' && (
        <>
          {step.solution && step.solution.length > 0 && (
            <ol className="space-y-2 mb-3">
              {step.solution.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {!submitted ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700">{step.partialPlaceholder || 'Твој ред — заврши го решението:'}</p>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                rows={3}
                placeholder="Напиши ги преостанатите чекори..."
                className="w-full text-sm border-2 border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400 resize-none bg-white"
              />
              <button
                type="button"
                onClick={() => setSubmitted(true)}
                disabled={!answer.trim()}
                className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg transition disabled:opacity-40"
              >
                Провери
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">Одлично! Твојот одговор: <em>{answer}</em></span>
            </div>
          )}
        </>
      )}

      {/* Quiz: just input */}
      {step.phase === 'quiz' && (
        !submitted ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-700">Реши ја задачата самостојно — нема помош!</p>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={4}
              placeholder="Прикажи го целото решение чекор по чекор..."
              className="w-full text-sm border-2 border-green-200 rounded-xl px-3 py-2 focus:outline-none focus:border-green-400 resize-none bg-white"
            />
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!answer.trim()}
              className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg transition disabled:opacity-40"
            >
              Готово!
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-green-700 bg-green-100 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Браво — самостојно решено!</p>
              <p className="text-xs mt-0.5 text-green-600">{answer}</p>
            </div>
          </div>
        )
      )}

      {/* Next button */}
      {(step.phase !== 'partial' || submitted) && (step.phase !== 'quiz' || submitted) && step.phase !== 'quiz' && (
        <button
          type="button"
          onClick={onNext}
          className="mt-4 flex items-center gap-1.5 text-sm font-bold text-white bg-slate-700 hover:bg-slate-800 px-4 py-2 rounded-xl transition"
        >
          {isLast ? 'Заврши' : 'Следно'} <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Quiz done: finish */}
      {step.phase === 'quiz' && submitted && !isLast && (
        <button
          type="button"
          onClick={onNext}
          className="mt-4 flex items-center gap-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl transition"
        >
          Следно <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export const WorkedExample: React.FC<Props> = ({ example }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-6 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="font-black text-indigo-800 text-lg mb-1">Одлично завршено!</h3>
        <p className="text-sm text-indigo-600">
          Ги помина сите три фази: гледав → пробав → самостојно. Концептот е совладан!
        </p>
        <button
          type="button"
          onClick={() => { setCurrentStep(0); setDone(false); }}
          className="mt-4 text-xs font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-4 py-2 rounded-xl transition"
        >
          Повтори
        </button>
      </div>
    );
  }

  const step = example.steps[currentStep];
  const isLast = currentStep === example.steps.length - 1;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {example.steps.map((s, i) => (
          <React.Fragment key={s.phase}>
            <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
              i === currentStep ? 'bg-indigo-600 text-white' :
              i < currentStep ? 'bg-indigo-200 text-indigo-700' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < currentStep ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{PHASE_LABEL[s.phase]}</span>
            </div>
            {i < example.steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-indigo-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <StepCard
        step={step}
        onNext={() => isLast ? setDone(true) : setCurrentStep(prev => prev + 1)}
        isLast={isLast}
      />
    </div>
  );
};
