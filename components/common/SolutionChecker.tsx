import React, { useState } from 'react';
import { CheckCircle, XCircle, HelpCircle, Loader2, Sigma, Search } from 'lucide-react';
import { useSolutionChecker } from '../../hooks/useSolutionChecker';
import { MathRenderer } from './MathRenderer';
import { StepByStepSolver } from '../StepByStepSolver';

/**
 * "Провери го решението" — a quick check for a problem the student already
 * solved on their own (paper/homework), not a solve-for-me tool: the student
 * supplies both the problem and their own final answer, gets a correct/
 * incorrect verdict (CAS-verified when possible) plus a short hint, and the
 * full step-by-step walkthrough stays hidden behind an explicit reveal.
 */
export const SolutionChecker: React.FC = () => {
  const [problem, setProblem] = useState('');
  const [answer, setAnswer] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const { check, result, loading, error, reset } = useSolutionChecker();

  const handleCheck = () => {
    setShowSteps(false);
    check(problem, answer);
  };

  const statusStyles = {
    correct: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800', Icon: CheckCircle, iconColor: 'text-emerald-600' },
    incorrect: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', Icon: XCircle, iconColor: 'text-amber-600' },
    inconclusive: { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700', Icon: HelpCircle, iconColor: 'text-slate-500' },
  } as const;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-700">Провери го решението</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Реши ја задачата сам, па внеси ги тука за да провериш дали си на вистински пат.</p>

      <textarea
        value={problem}
        onChange={e => { setProblem(e.target.value); reset(); }}
        placeholder="Задачата (пр. Реши: 2x + 5 = 13)"
        rows={2}
        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
      <input
        type="text"
        value={answer}
        onChange={e => { setAnswer(e.target.value); reset(); }}
        onKeyDown={e => { if (e.key === 'Enter') handleCheck(); }}
        placeholder="Твојот одговор (пр. x = 4)"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />

      <button
        type="button"
        onClick={handleCheck}
        disabled={loading || !problem.trim() || !answer.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-indigo-700 transition"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        Провери
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (() => {
        const s = statusStyles[result.status];
        return (
          <div className={`rounded-xl border ${s.border} ${s.bg} p-4 space-y-2`}>
            <div className="flex items-start gap-2">
              <s.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${s.iconColor}`} />
              <div className="space-y-1 min-w-0">
                <p className={`font-semibold text-sm ${s.text}`}>
                  {result.status === 'correct' ? 'Точно!' : result.status === 'incorrect' ? 'Не сосема — обиди се пак' : 'Не можев автоматски да проверам'}
                </p>
                <p className="text-xs text-slate-600">{result.hint}</p>
                {result.status === 'inconclusive' && result.correctAnswer && (
                  <div className="text-sm font-mono text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                    <MathRenderer text={result.correctAnswer} />
                  </div>
                )}
                {result.verifiedByCas && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
                    title="Проверено со математички мотор за еквивалентност, не само буквално совпаѓање."
                  >
                    <Sigma className="w-3 h-3" /> Проверено со математички мотор
                  </span>
                )}
              </div>
            </div>

            {!showSteps ? (
              <button
                type="button"
                onClick={() => setShowSteps(true)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Прикажи целосно решение чекор-по-чекор →
              </button>
            ) : (
              <StepByStepSolver problem={problem} strategy={result.strategy} steps={result.steps} />
            )}
          </div>
        );
      })()}
    </div>
  );
};
