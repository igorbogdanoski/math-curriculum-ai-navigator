import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Lightbulb, CheckCircle2, BookOpen } from 'lucide-react';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  data: AIGeneratedPresentation;
  startIndex?: number;
  onClose: () => void;
}

// ── Slide type config ─────────────────────────────────────────────────────────
const SLIDE_META: Record<PresentationSlide['type'], { label: string; color: string; bg: string }> = {
  'title':           { label: 'Наслов',          color: 'text-indigo-300',  bg: 'bg-indigo-900/40' },
  'content':         { label: 'Содржина',         color: 'text-blue-300',    bg: 'bg-blue-900/40'   },
  'formula-centered':{ label: 'Формула',          color: 'text-violet-300',  bg: 'bg-violet-900/40' },
  'step-by-step':    { label: 'Постапка',         color: 'text-cyan-300',    bg: 'bg-cyan-900/40'   },
  'example':         { label: 'Пример',           color: 'text-emerald-300', bg: 'bg-emerald-900/40'},
  'task':            { label: 'Задача',            color: 'text-amber-300',   bg: 'bg-amber-900/40'  },
  'summary':         { label: 'Заклучок',         color: 'text-rose-300',    bg: 'bg-rose-900/40'   },
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export const GammaModeModal: React.FC<Props> = ({ data, startIndex = 0, onClose }) => {
  const [idx, setIdx]           = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [stepIdx, setStepIdx]   = useState(0);
  const [entering, setEntering] = useState(false);

  const slides = data.slides;
  const slide  = slides[idx];
  const total  = slides.length;
  const meta   = SLIDE_META[slide.type];
  const isStepSlide   = slide.type === 'step-by-step';
  const hasReveal     = (slide.type === 'task' || slide.type === 'example') && (slide.solution?.length ?? 0) > 0;

  // ── Animate slide transition ───────────────────────────────────────────────
  const animateTransition = useCallback((fn: () => void) => {
    setEntering(true);
    fn();
    setTimeout(() => setEntering(false), 20);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (isStepSlide && stepIdx < slide.content.length - 1) {
      setStepIdx(p => p + 1);
      return;
    }
    if (!revealed && hasReveal) {
      setRevealed(true);
      return;
    }
    if (idx < total - 1) {
      animateTransition(() => {
        setIdx(p => p + 1);
        setRevealed(false);
        setStepIdx(0);
      });
    }
  }, [idx, total, revealed, hasReveal, isStepSlide, stepIdx, slide, animateTransition]);

  const goPrev = useCallback(() => {
    if (isStepSlide && stepIdx > 0) {
      setStepIdx(p => p - 1);
      return;
    }
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (idx > 0) {
      animateTransition(() => {
        setIdx(p => p - 1);
        setRevealed(false);
        setStepIdx(0);
      });
    }
  }, [idx, revealed, isStepSlide, stepIdx, animateTransition]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape')     onClose();
      if (e.key === 'r' || e.key === 'R') setRevealed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  // ── Hint for Space/Enter action ───────────────────────────────────────────
  const spaceHint = isStepSlide && stepIdx < slide.content.length - 1
    ? 'Space → следен чекор'
    : hasReveal && !revealed
      ? 'Space → прикажи решение'
      : idx < total - 1
        ? 'Space → следен слајд'
        : '';

  // ── Slide body ────────────────────────────────────────────────────────────
  const renderBody = () => {
    switch (slide.type) {

      case 'title':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12 gap-6">
            <div className="text-6xl md:text-8xl font-black bg-gradient-to-br from-white via-indigo-200 to-violet-400 bg-clip-text text-transparent leading-none">
              <MathRenderer text={slide.title} />
            </div>
            {slide.content.map((line, i) => (
              <p key={i} className="text-xl md:text-2xl text-slate-400 font-medium max-w-2xl">
                <MathRenderer text={line} />
              </p>
            ))}
            <div className="flex items-center gap-2 mt-4">
              <span className="px-3 py-1 bg-indigo-800/50 text-indigo-300 rounded-full text-sm font-bold">
                {data.topic}
              </span>
              <span className="px-3 py-1 bg-slate-800/50 text-slate-400 rounded-full text-sm font-bold">
                {data.gradeLevel}. одделение
              </span>
            </div>
          </div>
        );

      case 'formula-centered':
        return (
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
            <div className="text-3xl md:text-5xl font-black text-white text-center bg-violet-900/30 border border-violet-700/40 rounded-3xl px-10 py-8 shadow-2xl max-w-3xl w-full">
              <MathRenderer text={slide.content[0] ?? slide.title} />
            </div>
            {slide.content.slice(1).map((line, i) => (
              <p key={i} className="text-lg text-slate-400 text-center max-w-2xl">
                <MathRenderer text={line} />
              </p>
            ))}
          </div>
        );

      case 'step-by-step':
        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-4 max-w-4xl mx-auto w-full">
            {slide.content.map((step, i) => {
              const done    = i < stepIdx;
              const current = i === stepIdx;
              const hidden  = i > stepIdx;
              return (
                <div key={i}
                  className={`flex items-start gap-4 rounded-2xl p-4 transition-all duration-300 ${
                    hidden  ? 'opacity-0 translate-y-2' :
                    done    ? 'opacity-40' :
                    'bg-cyan-900/20 border border-cyan-700/30'
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5 transition ${
                    done    ? 'bg-green-700 text-green-200' :
                    current ? 'bg-cyan-600 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`text-lg font-medium leading-relaxed ${current ? 'text-white' : 'text-slate-400'}`}>
                    <MathRenderer text={step} />
                  </p>
                </div>
              );
            })}
          </div>
        );

      case 'task':
      case 'example': {
        const isTask = slide.type === 'task';
        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-6 max-w-4xl mx-auto w-full">
            {/* Task box */}
            <div className={`rounded-3xl border p-8 ${
              isTask
                ? 'bg-amber-950/30 border-amber-700/40'
                : 'bg-emerald-950/30 border-emerald-700/40'
            }`}>
              <div className={`flex items-center gap-2 mb-4 text-xs font-black uppercase tracking-widest ${
                isTask ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <BookOpen className="w-3.5 h-3.5" />
                {isTask ? 'Задача' : 'Пример'}
              </div>
              <div className="space-y-2">
                {slide.content.map((line, i) => (
                  <p key={i} className="text-xl md:text-2xl text-white font-medium leading-relaxed">
                    <MathRenderer text={line} />
                  </p>
                ))}
              </div>
            </div>

            {/* Solution reveal */}
            {hasReveal && (
              revealed ? (
                <div className="rounded-3xl border border-green-700/40 bg-green-950/30 p-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
                  <div className="flex items-center gap-2 mb-4 text-xs font-black uppercase tracking-widest text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Решение
                  </div>
                  <div className="space-y-3">
                    {(slide.solution ?? []).map((line, i) => (
                      <p key={i} className="text-lg md:text-xl text-green-100 leading-relaxed">
                        <MathRenderer text={line} />
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setRevealed(true)}
                  className="flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-600 hover:border-amber-500 py-5 text-slate-400 hover:text-amber-300 transition-all group">
                  <Eye className="w-5 h-5 group-hover:scale-110 transition" />
                  <span className="font-bold text-lg">Прикажи решение</span>
                  <span className="text-xs opacity-60">(R или Space)</span>
                </button>
              )
            )}
          </div>
        );
      }

      case 'summary':
        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-4 max-w-4xl mx-auto w-full">
            {slide.content.map((line, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-rose-950/20 border border-rose-800/30">
                <CheckCircle2 className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-lg text-slate-200 leading-relaxed">
                  <MathRenderer text={line} />
                </p>
              </div>
            ))}
          </div>
        );

      default: // 'content'
        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-4 max-w-4xl mx-auto w-full">
            {slide.content.map((line, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-3" />
                <p className="text-xl md:text-2xl text-slate-200 leading-relaxed font-medium">
                  <MathRenderer text={line} />
                </p>
              </div>
            ))}
          </div>
        );
    }
  };

  // ── Progress dots ─────────────────────────────────────────────────────────
  const maxDots = Math.min(total, 20);
  const step = total > maxDots ? Math.ceil(total / maxDots) : 1;
  const dots = Array.from({ length: Math.ceil(total / step) }, (_, i) => i * step);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${meta.color} ${meta.bg}`}>
            {meta.label}
          </span>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline truncate max-w-xs">
            {data.topic}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {spaceHint && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <Lightbulb className="w-3 h-3" />{spaceHint}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500">
            {idx + 1} / {total}
          </span>
          <button type="button" onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Slide canvas ───────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-150 ${entering ? 'opacity-0' : 'opacity-100'}`}>

        {/* Slide title (except for 'title' type which renders its own) */}
        {slide.type !== 'title' && (
          <div className="px-8 md:px-16 pt-8 pb-2 flex-shrink-0">
            <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
              <MathRenderer text={slide.title} />
            </h2>
          </div>
        )}

        {renderBody()}
      </div>

      {/* ── Footer: progress + navigation ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-6 py-4 border-t border-white/5 flex-shrink-0">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {dots.map((dotSlideIdx, di) => {
            const isActive = idx >= dotSlideIdx && (di === dots.length - 1 || idx < dots[di + 1]);
            return (
              <button key={di} type="button"
                onClick={() => { setIdx(dotSlideIdx); setRevealed(false); setStepIdx(0); }}
                className={`rounded-full transition-all ${
                  isActive ? 'w-5 h-2.5 bg-indigo-400' : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
                }`}
              />
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={goPrev}
            disabled={idx === 0 && !revealed && !(isStepSlide && stepIdx > 0)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition font-semibold text-sm">
            <ChevronLeft className="w-4 h-4" /> Назад
          </button>

          {/* Center action */}
          {hasReveal && !revealed ? (
            <button type="button" onClick={() => setRevealed(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition active:scale-95 shadow-lg">
              <Eye className="w-4 h-4" /> Прикажи решение
            </button>
          ) : isStepSlide && stepIdx < slide.content.length - 1 ? (
            <button type="button" onClick={() => setStepIdx(p => p + 1)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-sm transition active:scale-95 shadow-lg">
              Следен чекор <ChevronRight className="w-4 h-4" />
            </button>
          ) : idx < total - 1 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition active:scale-95 shadow-lg">
              Следен <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={onClose}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition active:scale-95 shadow-lg">
              <CheckCircle2 className="w-4 h-4" /> Крај на презентација
            </button>
          )}

          <button type="button" onClick={goNext}
            disabled={idx === total - 1 && (revealed || !hasReveal) && !(isStepSlide && stepIdx < slide.content.length - 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition font-semibold text-sm">
            Напред <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-[10px] text-slate-600 hidden md:block">
          ← → навигација · Space / Enter следен чекор · R прикажи решение · Esc излез
        </p>
      </div>
    </div>
  );
};
