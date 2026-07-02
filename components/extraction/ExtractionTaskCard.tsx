import React, { useState } from 'react';
import {
  X, Check, Copy, Image as ImageIcon, Loader2,
  Square, CheckSquare, Lightbulb, Layers,
} from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { Card } from '../common/Card';
import { DokBadge } from '../common/DokBadge';
import { callImagenProxy } from '../../services/gemini/core';
import {
  type EnrichedWebTask,
  type TaskSolution,
  type TaskDifferentiation,
  generateTaskSolution,
  generateTaskDifferentiation,
} from '../../services/gemini/visionContracts';

const DIFF_STYLE: Record<EnrichedWebTask['difficulty'], string> = {
  basic: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-violet-100 text-violet-700',
};
const DIFF_MK: Record<EnrichedWebTask['difficulty'], string> = {
  basic: 'Основно', intermediate: 'Средно', advanced: 'Напредно',
};

export const ExtractionProgress: React.FC<{ label: string; pct: number }> = ({ label, pct }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs text-white/70">
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {label}
      </span>
      <span>{Math.round(pct)}%</span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

export const TaskCard: React.FC<{
  task: EnrichedWebTask;
  index: number;
  selected: boolean;
  onSelect: (idx: number) => void;
}> = ({ task, index, selected, onSelect }) => {
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [solution, setSolution] = useState<TaskSolution | null>(task.solution ?? null);
  const [isSolvingAI, setIsSolvingAI] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [differentiation, setDifferentiation] = useState<TaskDifferentiation | null>(task.differentiation ?? null);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const generateImage = async () => {
    setIsGenerating(true);
    setImgError(null);
    try {
      const res = await callImagenProxy({ prompt: task.imagenPrompt });
      if (res.error) { setImgError('Сликата не може да се генерира. Обидете се повторно.'); return; }
      if (res.inlineData) setImgDataUrl(`data:${res.inlineData.mimeType};base64,${res.inlineData.data}`);
    } catch { setImgError('Грешка при генерирање на слика.'); }
    finally { setIsGenerating(false); }
  };

  const copyLatex = async () => {
    await navigator.clipboard.writeText(task.latexStatement);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSolve = async () => {
    setIsSolvingAI(true);
    const sol = await generateTaskSolution(task);
    if (sol) { setSolution(sol); setShowSolution(true); }
    setIsSolvingAI(false);
  };

  const handleDifferentiate = async () => {
    setIsDiffLoading(true);
    const diff = await generateTaskDifferentiation(task);
    if (diff) { setDifferentiation(diff); setShowDiff(true); }
    setIsDiffLoading(false);
  };

  return (
    <Card className={`p-5 space-y-3 transition-all ${selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-label={selected ? 'Одбери' : 'Избери'}
            className="shrink-0 text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            {selected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-gray-300" />}
          </button>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {index + 1}
          </span>
          <h3 className="font-semibold text-slate-800 truncate">{task.title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DIFF_STYLE[task.difficulty]}`}>
            {DIFF_MK[task.difficulty]}
          </span>
          {task.dokLevel && <DokBadge level={task.dokLevel} size="compact" />}
          {task.pedagogy?.bloomLevelMk && (
            <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-700">
              {task.pedagogy.bloomLevelMk}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {task.topicMk}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed">
        <MathRenderer text={task.latexStatement || task.statement} />
      </div>

      {task.pedagogy && (
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            Bloom: {task.pedagogy.bloomLevelMk}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {task.pedagogy.estimatedGradeRange}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            task.pedagogy.cognitiveLoad === 'low' ? 'bg-emerald-100 text-emerald-700' :
            task.pedagogy.cognitiveLoad === 'medium' ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {task.pedagogy.cognitiveLoad === 'low' ? 'Низок' : task.pedagogy.cognitiveLoad === 'medium' ? 'Среден' : 'Висок'} когн. товар
          </span>
          {task.pedagogy.prerequisiteConcepts.slice(0, 2).map(c => (
            <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              ← {c}
            </span>
          ))}
        </div>
      )}

      {imgDataUrl && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <img src={imgDataUrl} alt={task.imagenPrompt} className="w-full object-cover" />
          <button
            type="button"
            aria-label="Отстрани слика"
            onClick={() => setImgDataUrl(null)}
            className="absolute right-2 top-2 rounded-full bg-slate-800/60 p-1 text-white hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {imgError && <p className="text-xs text-red-500">{imgError}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLatex}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          {isCopied ? <><Check className="h-3 w-3 text-emerald-600" /> Копирано</> : <><Copy className="h-3 w-3" /> LaTeX</>}
        </button>
        {!imgDataUrl && (
          <button
            type="button"
            onClick={generateImage}
            disabled={isGenerating}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            {isGenerating ? 'Генерира...' : 'Слика'}
          </button>
        )}
        <button
          type="button"
          onClick={solution ? () => setShowSolution(v => !v) : handleSolve}
          disabled={isSolvingAI}
          className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition"
        >
          {isSolvingAI ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
          {isSolvingAI ? 'Решава...' : solution ? (showSolution ? 'Скриј решение' : 'Прикажи решение') : 'Решение'}
        </button>
        <button
          type="button"
          onClick={differentiation ? () => setShowDiff(v => !v) : handleDifferentiate}
          disabled={isDiffLoading}
          className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition"
        >
          {isDiffLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
          {isDiffLoading ? 'Генерира...' : differentiation ? (showDiff ? 'Скриј нивоа' : '3 нивоа') : '3 нивоа'}
        </button>
      </div>

      {showSolution && solution && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-xs font-black text-amber-700 uppercase tracking-wide flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" /> Решение чекор-по-чекор
          </p>
          <ol className="space-y-1.5">
            {solution.steps.map((step, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="shrink-0 font-bold text-amber-600">{i + 1}.</span>
                <MathRenderer text={step} />
              </li>
            ))}
          </ol>
          <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800">
            ✓ <MathRenderer text={solution.finalAnswer} />
          </div>
        </div>
      )}

      {showDiff && differentiation && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2">
          <p className="text-xs font-black text-violet-700 uppercase tracking-wide flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> Диференцијација — 3 нивоа
          </p>
          {[
            { key: 'support',  label: '🟢 Поддршка',  cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
            { key: 'standard', label: '🔵 Стандардно', cls: 'bg-blue-50 border-blue-200 text-blue-800' },
            { key: 'advanced', label: '🔴 Напредно',   cls: 'bg-red-50 border-red-200 text-red-800' },
          ].map(({ key, label, cls }) => (
            <div key={key} className={`rounded-lg border p-3 ${cls}`}>
              <p className="text-[11px] font-black mb-1">{label}</p>
              <MathRenderer text={differentiation[key as keyof TaskDifferentiation]} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
