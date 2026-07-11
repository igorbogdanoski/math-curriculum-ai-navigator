import React from 'react';
import { Eye, ZoomIn, ZoomOut, CheckCircle2, Loader2, ClipboardList, ArrowLeftRight, Pencil, Shield, Crosshair, Eraser, BookOpen, Sparkles } from 'lucide-react';
import type { AIGeneratedPresentation, AIGeneratedAssessment, PresentationSlide } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { AlgebraTilesCanvas } from '../math/AlgebraTilesCanvas';
import { ChartPreview } from '../dataviz/ChartPreview';
import type { ChartConfig } from '../dataviz/ChartPreview';
import type { TableData } from '../dataviz/DataTable';
import { SlideSVGRenderer } from './SlideSVGRenderer';
import { Shape3DType, SHAPE_ORDER } from '../math/Shape3DViewer';

const Shape3DViewer = React.lazy(() =>
  import('../math/Shape3DViewer').then(m => ({ default: m.Shape3DViewer }))
);
const InteractiveQuizPlayer = React.lazy(() =>
  import('./InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer }))
);

export interface SlideBodyProps {
  slide: PresentationSlide;
  data: AIGeneratedPresentation;
  idx: number;
  svgCache: Record<number, string>;
  setSvgCache: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  svgLoading: Record<number, boolean>;
  setSvgLoading: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  formulaZoom: number;
  setFormulaZoom: React.Dispatch<React.SetStateAction<number>>;
  revealed: boolean;
  setRevealed: React.Dispatch<React.SetStateAction<boolean>>;
  stepIdx: number;
  setStepIdx: React.Dispatch<React.SetStateAction<number>>;
  exitTicket: AIGeneratedAssessment | null;
  generateExitTicket: (topic: string, grade: number) => void;
  isGeneratingExitTicket: boolean;
  dismissExitTicket: () => void;
  generateSVGForSlide: (slideIndex: number) => void;
  hasReveal: boolean;
  /** Set while a Gamma Live session is active — enables broadcasting the exit ticket to students. */
  gammaLivePin: string | null;
  onSendExitTicket: () => void;
  exitTicketSentToStudents: boolean;
}

export const SlideBody: React.FC<SlideBodyProps> = ({
  slide, data, idx,
  svgCache, setSvgCache, svgLoading, setSvgLoading,
  formulaZoom, setFormulaZoom,
  revealed, setRevealed,
  stepIdx, setStepIdx,
  exitTicket, generateExitTicket, isGeneratingExitTicket, dismissExitTicket,
  generateSVGForSlide, hasReveal,
  gammaLivePin, onSendExitTicket, exitTicketSentToStudents,
}) => {
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
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
            {/* Zoom controls */}
            <div className="flex items-center gap-2 self-end pr-4">
              <button type="button" title="Намали (−)" onClick={() => setFormulaZoom(z => Math.max(z - 0.5, 1))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition disabled:opacity-30"
                disabled={formulaZoom <= 1}>
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 font-mono w-10 text-center">{formulaZoom}×</span>
              <button type="button" title="Зголеми (+)" onClick={() => setFormulaZoom(z => Math.min(z + 0.5, 3))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition disabled:opacity-30"
                disabled={formulaZoom >= 3}>
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div
              className="gamma-formula-zoom text-3xl md:text-5xl font-black text-white text-center bg-violet-900/30 border border-violet-700/40 rounded-3xl px-10 py-8 shadow-2xl max-w-3xl w-full cursor-zoom-in"
              style={{ '--gamma-formula-zoom': formulaZoom } as React.CSSProperties}
              onDoubleClick={() => setFormulaZoom(z => z < 2 ? 2 : 1)}
            >
              <MathRenderer text={slide.content[0] ?? slide.title} />
            </div>
            {formulaZoom === 1 && slide.content.slice(1).map((line, i) => (
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
        const slideSvg = svgCache[idx];
        const slideLoadingSvg = svgLoading[idx];
        const hasVisual = !!slide.visualPrompt;

        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-6 max-w-4xl mx-auto w-full">
            {/* Main row: task text + optional SVG illustration */}
            <div className={`flex gap-6 items-start ${slideSvg ? 'flex-col md:flex-row' : ''}`}>
              {/* Task box */}
              <div className={`rounded-3xl border p-8 flex-1 ${
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

              {/* SVG illustration panel */}
              {slideSvg ? (
                <div className="md:w-56 flex-shrink-0 flex items-center justify-center animate-fade-in">
                  <SlideSVGRenderer svg={slideSvg} caption={slide.visualPrompt} className="w-full" />
                </div>
              ) : hasVisual && (
                <div className="md:w-56 flex-shrink-0 flex items-center justify-center">
                  {slideLoadingSvg ? (
                    <div className="w-full flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-6">
                      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                      <p className="text-xs text-slate-500">Генерирам илустрација…</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => generateSVGForSlide(idx)}
                      className="w-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/50 bg-white/5 hover:bg-indigo-900/20 p-6 transition-all group"
                    >
                      <Sparkles className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition" />
                      <p className="text-xs text-slate-500 group-hover:text-indigo-300 text-center transition">
                        AI илустрација
                      </p>
                    </button>
                  )}
                </div>
              )}
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

      case 'comparison': {
        const left  = slide.content;
        const right = slide.rightContent ?? [];
        const [leftLabel, rightLabel] = (slide.title ?? '').includes(' vs ')
          ? slide.title.split(' vs ').map(s => s.trim())
          : ['А', 'Б'];
        return (
          <div className="flex-1 flex flex-col justify-center px-6 md:px-12 gap-4 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-2 gap-4 flex-1">
              {/* Left column */}
              <div className="flex flex-col rounded-3xl border border-sky-700/40 bg-sky-950/20 p-6 gap-3">
                <div className="text-xs font-black uppercase tracking-widest text-sky-400 flex items-center gap-2 mb-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" />{leftLabel}
                </div>
                {left.map((line, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-2.5" />
                    <p className="text-lg text-slate-200 leading-relaxed font-medium">
                      <MathRenderer text={line} />
                    </p>
                  </div>
                ))}
              </div>
              {/* Right column */}
              <div className="flex flex-col rounded-3xl border border-violet-700/40 bg-violet-950/20 p-6 gap-3">
                <div className="text-xs font-black uppercase tracking-widest text-violet-400 flex items-center gap-2 mb-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" />{rightLabel}
                </div>
                {right.map((line, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-2.5" />
                    <p className="text-lg text-slate-200 leading-relaxed font-medium">
                      <MathRenderer text={line} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'proof': {
        return (
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 gap-4 max-w-4xl mx-auto w-full">
            <div className="rounded-3xl border border-purple-700/40 bg-purple-950/20 p-8">
              <div className="flex items-center gap-2 mb-5 text-xs font-black uppercase tracking-widest text-purple-400">
                <Shield className="w-3.5 h-3.5" /> Доказ
              </div>
              <div className="space-y-4">
                {slide.content.map((line, i) => (
                  <div key={i} className={`flex items-start gap-4 transition-all duration-300 ${i > stepIdx ? 'opacity-0 translate-y-1' : i < stepIdx ? 'opacity-40' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 mt-0.5 transition ${
                      i < stepIdx ? 'bg-purple-800 text-purple-300' : i === stepIdx ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {i < stepIdx ? '✓' : i + 1}
                    </div>
                    <p className={`text-lg leading-relaxed font-medium transition ${i === stepIdx ? 'text-white' : i < stepIdx ? 'text-slate-400' : 'text-transparent'}`}>
                      <MathRenderer text={line} />
                    </p>
                  </div>
                ))}
              </div>
              {stepIdx >= slide.content.length - 1 && (
                <div className="mt-6 flex items-center gap-2 text-purple-300 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Q.E.D. — Доказот е завршен
                </div>
              )}
            </div>
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
            {/* Exit Ticket */}
            {!exitTicket && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => generateExitTicket(data.topic, data.gradeLevel)}
                  disabled={isGeneratingExitTicket}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-sm font-bold transition disabled:opacity-50"
                >
                  {isGeneratingExitTicket
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирам Exit Ticket…</>
                    : <><ClipboardList className="w-4 h-4" /> Генерирај Exit Ticket</>
                  }
                </button>
              </div>
            )}
            {exitTicket && (
              <React.Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-rose-400" /></div>}>
                <div className="mt-2 rounded-2xl overflow-hidden border border-rose-500/20 max-h-[55vh] overflow-y-auto">
                  <InteractiveQuizPlayer
                    title={`Exit Ticket — ${data.topic}`}
                    quiz={exitTicket}
                    onClose={dismissExitTicket}
                  />
                </div>
                {gammaLivePin && (
                  <div className="flex justify-center pt-3">
                    {exitTicketSentToStudents ? (
                      <span className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Испратено до учениците
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onSendExitTicket}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition"
                      >
                        <Sparkles className="w-4 h-4" /> Испрати до учениците
                      </button>
                    )}
                  </div>
                )}
              </React.Suspense>
            )}
          </div>
        );

      case 'chart-embed': {
        const td = slide.chartData
          ? { headers: slide.chartData.headers, rows: slide.chartData.rows } as TableData
          : null;
        const cfg = slide.chartConfig as ChartConfig | undefined;
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 overflow-auto">
            {td && cfg ? (
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
                {cfg.title && (
                  <div className="px-6 pt-5">
                    <h3 className="text-xl font-black text-gray-800 text-center">{String(cfg.title)}</h3>
                  </div>
                )}
                <div className="p-6">
                  <ChartPreview data={td} config={cfg} />
                </div>
                {(cfg.xLabel || cfg.yLabel) && (
                  <p className="px-6 pb-4 text-center text-xs text-gray-400">
                    {cfg.xLabel && <span>X: {String(cfg.xLabel)}</span>}
                    {cfg.xLabel && cfg.yLabel && ' · '}
                    {cfg.yLabel && <span>Y: {String(cfg.yLabel)}</span>}
                    {cfg.unit && <span> ({String(cfg.unit)})</span>}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-400">Нема податоци за дијаграм.</p>
            )}
            {slide.content.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {slide.content.map((note, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white/10 text-slate-300 rounded-full text-sm">
                    <MathRenderer text={note} />
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'shape-3d':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 overflow-auto">
            <div className="bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden">
              <React.Suspense fallback={<div className="flex items-center justify-center p-8 text-slate-300"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
                <Shape3DViewer
                  initialShape={(SHAPE_ORDER.includes(slide.shape3dShape as Shape3DType) ? slide.shape3dShape : 'cube') as Shape3DType}
                  hideSelector={false}
                  compact={false}
                />
              </React.Suspense>
            </div>
            {slide.content.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {slide.content.map((note, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white/10 text-slate-300 rounded-full text-sm">
                    <MathRenderer text={note} />
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case 'algebra-tiles':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 overflow-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden p-2">
              <AlgebraTilesCanvas
                presetExpression={slide.algebraTilesExpression}
                compact={false}
              />
            </div>
            {slide.content.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {slide.content.map((note, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white/10 text-slate-300 rounded-full text-sm">
                    <MathRenderer text={note} />
                  </span>
                ))}
              </div>
            )}
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
  return null;
};
