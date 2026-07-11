import React, { useCallback, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { geminiService, isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { compressImage } from '../../utils/imageCompression';
import { StepByStepSolver, type SolverStep } from '../StepByStepSolver';

const MAX_PROBLEMS = 8;

type ProblemState =
  | { status: 'solving' }
  | { status: 'solved'; strategy?: string; steps: SolverStep[] }
  | { status: 'failed' };

type Phase = 'idle' | 'extracting' | 'solving' | 'done' | 'error';

/**
 * "Фотографирај домашна" — the self-study counterpart to SolutionChecker: instead of the
 * student typing a problem they already solved, they photograph a whole (unanswered)
 * worksheet and get every problem extracted and walked through step-by-step. No grading
 * happens here (it's "help me solve," not "test me"), so nothing is persisted to Firestore.
 */
export const PhotoWorksheetSolver: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [truncatedCount, setTruncatedCount] = useState(0);
  const [problemStates, setProblemStates] = useState<Record<number, ProblemState>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'extracting' || phase === 'solving';

  const openCamera = useCallback(() => {
    if (!fileRef.current) return;
    fileRef.current.setAttribute('capture', 'environment');
    fileRef.current.click();
  }, []);

  const openGallery = useCallback(() => {
    if (!fileRef.current) return;
    fileRef.current.removeAttribute('capture');
    fileRef.current.click();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (isDailyQuotaKnownExhausted()) {
      setPhase('error');
      setErrorMsg('Дневната AI квота е исцрпена. Обидете се повторно утре.');
      return;
    }
    setPhase('extracting');
    setErrorMsg('');
    setProblems([]);
    setProblemStates({});
    setTruncatedCount(0);
    setExpandedIndex(null);

    try {
      const compressed = await compressImage(file);
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(compressed);
      });
      const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) {
        setPhase('error');
        setErrorMsg('Неподдржан формат на слика.');
        return;
      }
      const [, mimeType, base64] = match;

      const extracted = await geminiService.extractProblemsFromImage(base64, mimeType);
      if (extracted.length === 0) {
        setPhase('error');
        setErrorMsg('Не успеавме да препознаеме задачи на сликата. Обиди се со појасна фотографија.');
        return;
      }

      const capped = extracted.slice(0, MAX_PROBLEMS);
      setTruncatedCount(extracted.length - capped.length);
      setProblems(capped);
      setPhase('solving');

      const initial: Record<number, ProblemState> = {};
      capped.forEach((_, i) => { initial[i] = { status: 'solving' }; });
      setProblemStates(initial);

      const results = await Promise.allSettled(capped.map(p => geminiService.solveSpecificProblemStepByStep(p)));
      const nextStates: Record<number, ProblemState> = {};
      results.forEach((r, i) => {
        nextStates[i] = r.status === 'fulfilled'
          ? { status: 'solved', strategy: r.value.strategy, steps: r.value.steps }
          : { status: 'failed' };
      });
      setProblemStates(nextStates);
      setPhase('done');
    } catch (e) {
      setPhase('error');
      setErrorMsg(e instanceof Error ? e.message : 'Грешка при обработка на сликата.');
    }
  }, []);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (fileRef.current) fileRef.current.value = '';
  }, [handleFile]);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-700">Фотографирај домашна</h3>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Фотографирај ја работната листа — ќе ги решиме сите задачи чекор-по-чекор.
      </p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={openCamera}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-indigo-700 transition"
        >
          <Camera className="w-4 h-4" /> Камера
        </button>
        <button
          type="button"
          onClick={openGallery}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-bold text-indigo-600 disabled:opacity-50 hover:bg-indigo-50 transition"
        >
          <ImageIcon className="w-4 h-4" /> Галерија
        </button>
      </div>

      {phase === 'extracting' && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Ги препознавам задачите...
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 text-xs text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {errorMsg}
        </div>
      )}

      {truncatedCount > 0 && (
        <p className="text-xs text-amber-600">Откриени се повеќе задачи — ги решаваме првите {MAX_PROBLEMS}.</p>
      )}

      {problems.length > 0 && (
        <div className="space-y-2">
          {problems.map((p, i) => {
            const state = problemStates[i];
            const isExpanded = expandedIndex === i;
            return (
              <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  disabled={state?.status !== 'solved'}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default transition"
                >
                  <span className="truncate">{i + 1}. {p}</span>
                  {state?.status === 'solving' && <Loader2 className="w-4 h-4 shrink-0 animate-spin text-slate-400" />}
                  {state?.status === 'failed' && <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />}
                  {state?.status === 'solved' && (isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />)}
                </button>
                {state?.status === 'failed' && (
                  <p className="px-4 pb-3 text-xs text-red-600">
                    Не успеавме да ја решиме оваа задача — обиди се одделно преку „Провери го решението".
                  </p>
                )}
                {state?.status === 'solved' && isExpanded && (
                  <div className="px-4 pb-4">
                    <StepByStepSolver problem={p} strategy={state.strategy} steps={state.steps} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
