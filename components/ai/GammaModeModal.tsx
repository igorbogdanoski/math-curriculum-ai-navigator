import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Lightbulb, CheckCircle2, BookOpen, Sparkles, Loader2, MessageSquare, Timer, ArrowLeftRight, Shield, Pencil, Eraser, Crosshair, Maximize, Minimize, Printer, RotateCcw, FileDown, Grid, ZoomIn, ZoomOut, ClipboardList, BookText, MonitorPlay, Radio, RadioTower, Users } from 'lucide-react';
import { Shape3DViewer, Shape3DType, SHAPE_ORDER } from '../math/Shape3DViewer';
import { AlgebraTilesCanvas } from '../math/AlgebraTilesCanvas';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { ChartPreview } from '../dataviz/ChartPreview';
import type { ChartConfig } from '../dataviz/ChartPreview';
import type { TableData } from '../dataviz/DataTable';
import { SlideSVGRenderer } from './SlideSVGRenderer';
import { generateMathSVG } from '../../services/gemini/svg';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { deriveContextualFormulas, resolveSlideConcept } from '../../utils/gammaContext';
import { useGammaAnnotation, type AnnotMode } from './gamma/useGammaAnnotation';
import { GammaThumbnailGrid } from './gamma/GammaThumbnailGrid';
import { exportGammaPPTX, printGammaHandout } from './gamma/GammaExportService';
import { useGammaExitTicket } from './gamma/useGammaExitTicket';
import {
  startGammaLive,
  broadcastGammaSlide,
  endGammaLive,
  subscribeGammaSession,
  subscribeGammaResponses,
  type GammaLiveResponse,
} from '../../services/gammaLiveService';

const InteractiveQuizPlayer = React.lazy(() =>
  import('./InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer }))
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  data: AIGeneratedPresentation;
  startIndex?: number;
  onClose: () => void;
}

// ── Slide type config ─────────────────────────────────────────────────────────
const SLIDE_META: Record<PresentationSlide['type'], { label: string; color: string; bg: string }> = {
  'title':           { label: 'Наслов',          color: 'text-indigo-300',  bg: 'bg-indigo-900/40'  },
  'content':         { label: 'Содржина',         color: 'text-blue-300',    bg: 'bg-blue-900/40'    },
  'formula-centered':{ label: 'Формула',          color: 'text-violet-300',  bg: 'bg-violet-900/40'  },
  'step-by-step':    { label: 'Постапка',         color: 'text-cyan-300',    bg: 'bg-cyan-900/40'    },
  'example':         { label: 'Пример',           color: 'text-emerald-300', bg: 'bg-emerald-900/40' },
  'task':            { label: 'Задача',            color: 'text-amber-300',   bg: 'bg-amber-900/40'   },
  'summary':         { label: 'Заклучок',         color: 'text-rose-300',    bg: 'bg-rose-900/40'    },
  'chart-embed':     { label: 'Дијаграм',         color: 'text-teal-300',    bg: 'bg-teal-900/40'    },
  'shape-3d':        { label: '3D Тело',          color: 'text-cyan-300',    bg: 'bg-cyan-900/40'    },
  'algebra-tiles':   { label: 'Алгебарски плочки', color: 'text-indigo-300',  bg: 'bg-indigo-900/40'  },
  'comparison':      { label: 'Споредба',         color: 'text-sky-300',     bg: 'bg-sky-900/40'     },
  'proof':           { label: 'Доказ',            color: 'text-purple-300',  bg: 'bg-purple-900/40'  },
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export const GammaModeModal: React.FC<Props> = ({ data, startIndex = 0, onClose }) => {
  const { user, firebaseUser }  = useAuth();
  const { addNotification }     = useNotification();
  const [idx, setIdx]           = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [stepIdx, setStepIdx]   = useState(0);
  const [visible, setVisible]   = useState(true);
  const [dir, setDir]           = useState<'fwd' | 'back'>('fwd');
  const [transitionTick, setTransitionTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Thumbnail grid ────────────────────────────────────────────────────────
  const [showGrid, setShowGrid] = useState(false);

  // ── Formula zoom ──────────────────────────────────────────────────────────
  const [formulaZoom, setFormulaZoom] = useState(1);

  // ── Touch/swipe ───────────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // ── SVG illustration cache: slideIdx → svg string ─────────────────────────
  const [svgCache, setSvgCache]       = useState<Record<number, string>>({});
  const [svgLoading, setSvgLoading]   = useState<Record<number, boolean>>({});
  const generatingRef                 = useRef<Set<number>>(new Set());

  // ── Speaker notes ─────────────────────────────────────────────────────────
  const [notesOpen, setNotesOpen]     = useState(false);

  // ── PPTX export ───────────────────────────────────────────────────────────
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const { exitTicket, isGenerating: isGeneratingExitTicket, generate: generateExitTicket, dismiss: dismissExitTicket } = useGammaExitTicket();

  // ── Gamma Live ────────────────────────────────────────────────────────────
  const [gammaLivePin, setGammaLivePin] = useState<string | null>(null);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [liveResponses, setLiveResponses] = useState<GammaLiveResponse[]>([]);
  const [liveHandsCount, setLiveHandsCount] = useState(0);
  const liveUnsubRef = useRef<(() => void) | null>(null);

  const handleExportPPTX = useCallback(async () => {
    if (isExportingPptx) return;
    setIsExportingPptx(true);
    addNotification('Генерирам PPTX презентација…', 'info');
    await exportGammaPPTX(
      data,
      { isPro: !!(user?.isPremium), logoUrl: user?.schoolLogoUrl ?? null, schoolName: user?.schoolName ?? null },
      (msg) => addNotification(msg, 'success'),
      (msg) => addNotification(msg, 'error'),
    );
    setIsExportingPptx(false);
  }, [data, user, isExportingPptx, addNotification]);

  const liveSessionUnsubRef = useRef<(() => void) | null>(null);

  const startLiveSession = useCallback(async () => {
    if (!firebaseUser || isStartingLive || gammaLivePin) return;
    setIsStartingLive(true);
    try {
      const pin = await startGammaLive(firebaseUser.uid, data.topic, data.gradeLevel, data.slides);
      setGammaLivePin(pin);
      liveUnsubRef.current = subscribeGammaResponses(pin, responses => {
        setLiveResponses(responses);
      });
      liveSessionUnsubRef.current = subscribeGammaSession(pin, session => {
        setLiveHandsCount(session?.handsUids?.length ?? 0);
      });
    } catch {
      addNotification('Gamma Live: грешка при старт', 'error');
    } finally {
      setIsStartingLive(false);
    }
  }, [firebaseUser, isStartingLive, gammaLivePin, data, addNotification]);

  const endLiveSession = useCallback(async () => {
    if (!gammaLivePin) return;
    await endGammaLive(gammaLivePin);
    liveUnsubRef.current?.();
    liveUnsubRef.current = null;
    liveSessionUnsubRef.current?.();
    liveSessionUnsubRef.current = null;
    setGammaLivePin(null);
    setLiveResponses([]);
    setLiveHandsCount(0);
  }, [gammaLivePin]);

  // Broadcast slide to students when live
  useEffect(() => {
    if (!gammaLivePin) return;
    broadcastGammaSlide(gammaLivePin, idx);
  }, [gammaLivePin, idx]);

  // Cleanup live subscriptions on unmount
  useEffect(() => () => { liveUnsubRef.current?.(); liveSessionUnsubRef.current?.(); }, []);

  // ── Annotation tools ───────────────────────────────────────────────────────
  const { canvasRef, annotMode, hasAnnotations, laserPos, undoCount, toggleAnnot, clearCanvas, undoAnnotation, onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp, onCanvasMouseLeave } = useGammaAnnotation(idx);

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    containerRef.current?.focus({ preventScroll: true });
    return () => {
      previousActiveElementRef.current?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Reset zoom on slide change (canvas clearing handled by useGammaAnnotation)
  useEffect(() => { setFormulaZoom(1); }, [idx]);

  // ── Presenter Mode ────────────────────────────────────────────────────────
  const presenterChannelRef = useRef<BroadcastChannel | null>(null);
  const presenterWindowRef  = useRef<Window | null>(null);

  const openPresenterMode = useCallback(() => {
    if (!presenterChannelRef.current) {
      presenterChannelRef.current = new BroadcastChannel('gamma-sync');
    }
    if (!presenterWindowRef.current || presenterWindowRef.current.closed) {
      presenterWindowRef.current = window.open(
        `${window.location.origin}${window.location.pathname}#/gamma/presenter`,
        'gamma-presenter',
        'width=960,height=640,menubar=no,toolbar=no,location=no',
      );
    } else {
      presenterWindowRef.current.focus();
    }
  }, []);

  // Close channel on unmount
  useEffect(() => () => { presenterChannelRef.current?.close(); }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);


  // ── Task timer ────────────────────────────────────────────────────────────
  const [taskTimer, setTaskTimer]     = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides = data.slides;
  const slide  = slides[idx];
  const total  = slides.length;
  const meta   = SLIDE_META[slide.type];
  const isStepSlide = slide.type === 'step-by-step' || slide.type === 'proof';
  const hasReveal   = (slide.type === 'task' || slide.type === 'example') && (slide.solution?.length ?? 0) > 0;

  // ── Task timer logic ──────────────────────────────────────────────────────
  const startTimer = useCallback((seconds: number) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTaskTimer(seconds);
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTaskTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimerRunning(false);
  }, []);

  // Auto-init timer when entering a task slide
  useEffect(() => {
    // Directly clear any running interval — avoids stale closure on rapid navigation
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerRunning(false);
    if (slide.type === 'task') {
      setTaskTimer(slide.estimatedSeconds ?? 120);
    } else {
      setTaskTimer(null);
    }
  }, [idx, slide.type, slide.estimatedSeconds]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }, []);

  // Broadcast slide + timer to Presenter window whenever either changes
  useEffect(() => {
    const bc = presenterChannelRef.current;
    if (!bc) return;
    bc.postMessage({
      type: 'slide-change',
      idx,
      total: data.slides.length,
      slide: data.slides[idx],
      nextSlide: data.slides[idx + 1] ?? null,
      topic: data.topic,
      gradeLevel: data.gradeLevel,
      taskTimer,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, taskTimer]);

  const timerPct  = taskTimer !== null && slide.type === 'task'
    ? (taskTimer / (slide.estimatedSeconds ?? 120)) * 100
    : 100;
  const timerColor = timerPct > 40 ? 'bg-emerald-500' : timerPct > 15 ? 'bg-amber-500' : 'bg-red-500';

  // ── SVG illustration generation ───────────────────────────────────────────
  const svgCacheRef   = useRef(svgCache);
  const svgLoadingRef = useRef(svgLoading);
  svgCacheRef.current   = svgCache;
  svgLoadingRef.current = svgLoading;

  const generateSVGForSlide = useCallback(async (slideIndex: number) => {
    const s = slides[slideIndex];
    if (!s?.visualPrompt) return;
    if (svgCacheRef.current[slideIndex] || svgLoadingRef.current[slideIndex] || generatingRef.current.has(slideIndex)) return;
    generatingRef.current.add(slideIndex);
    setSvgLoading(prev => ({ ...prev, [slideIndex]: true }));
    try {
      const svg = await generateMathSVG(s.visualPrompt);
      setSvgCache(prev => ({ ...prev, [slideIndex]: svg }));
    } catch {
      // Silently ignore — slide renders fine without illustration
    } finally {
      setSvgLoading(prev => ({ ...prev, [slideIndex]: false }));
      generatingRef.current.delete(slideIndex);
    }
  }, [slides]);

  // Auto-generate SVG when entering a task/example slide with visualPrompt
  useEffect(() => {
    const s = slides[idx];
    if ((s.type === 'task' || s.type === 'example') && s.visualPrompt) {
      generateSVGForSlide(idx);
    }
  }, [idx, slides, generateSVGForSlide]);

  // ── Directional slide transition ──────────────────────────────────────────
  const animateTransition = useCallback((fn: () => void, direction: 'fwd' | 'back') => {
    setDir(direction);
    if (reducedMotion) {
      fn();
      setTransitionTick(t => t + 1);
      setVisible(true);
      return;
    }
    setVisible(false);
    setTimeout(() => {
      fn();
      setTransitionTick(t => t + 1);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, 170);
  }, [reducedMotion]);

  const jumpToSlide = useCallback((targetIndex: number) => {
    if (targetIndex === idx) return;
    animateTransition(() => {
      setIdx(targetIndex);
      setRevealed(false);
      setStepIdx(0);
    }, targetIndex > idx ? 'fwd' : 'back');
  }, [animateTransition, idx]);

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
      }, 'fwd');
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
      }, 'back');
    }
  }, [idx, revealed, isStepSlide, stepIdx, animateTransition]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape')     {
        if (showGrid) { setShowGrid(false); return; }
        if (annotMode) { toggleAnnot(annotMode); return; }
        onClose();
      }
      if (e.key === 'r' || e.key === 'R') setRevealed(true);
      if (e.key === 'd' || e.key === 'D') toggleAnnot('draw');
      if (e.key === 'h' || e.key === 'H') toggleAnnot('highlight');
      if (e.key === 'l' || e.key === 'L') toggleAnnot('laser');
      if (e.key === 'c' || e.key === 'C') clearCanvas();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'g' || e.key === 'G') setShowGrid(v => !v);
      if (e.key === '+' || e.key === '=') setFormulaZoom(z => Math.min(z + 0.5, 3));
      if (e.key === '-') setFormulaZoom(z => Math.max(z - 0.5, 1));
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoAnnotation(); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); window.print(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose, annotMode, showGrid, toggleAnnot, clearCanvas, toggleFullscreen, undoAnnotation]);

  // ── Hint for Space/Enter action ───────────────────────────────────────────
  const spaceHint = isStepSlide && stepIdx < slide.content.length - 1
    ? 'Space → следен чекор'
    : hasReveal && !revealed
      ? 'Space → прикажи решение'
      : idx < total - 1
        ? 'Space → следен слајд'
        : '';

  const contextualFormulas = useMemo(() => {
    return deriveContextualFormulas(slides, slide, idx);
  }, [slides, slide, idx]);

  const slideConcept = useMemo(() => {
    return resolveSlideConcept(slide, data.topic);
  }, [slide, data.topic]);

  const showContextStrip = slide.type === 'step-by-step' || slide.type === 'example';

  const entryAnimationClass = useMemo(() => {
    if (reducedMotion) return '';
    if (!visible) return '';
    if (slide.type === 'step-by-step' || slide.type === 'proof') return 'gamma-enter-up';
    if (slide.type === 'summary') return 'gamma-enter-fade-scale';
    return dir === 'fwd' ? 'gamma-enter-right' : 'gamma-enter-left';
  }, [reducedMotion, visible, slide.type, dir]);

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
              <Shape3DViewer
                initialShape={(SHAPE_ORDER.includes(slide.shape3dShape as Shape3DType) ? slide.shape3dShape : 'cube') as Shape3DType}
                hideSelector={false}
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
  };

  // ── Progress dots ─────────────────────────────────────────────────────────
  const maxDots = Math.min(total, 20);
  const step = total > maxDots ? Math.ceil(total / maxDots) : 1;
  const dots = Array.from({ length: Math.ceil(total / step) }, (_, i) => i * step);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Gamma Mode презентација"
      tabIndex={-1}
      className="gamma-mode-container fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 select-none"
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="gamma-controls flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest ${meta.color} ${meta.bg}`}>
            {meta.label}
          </span>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline truncate max-w-xs">
            {data.topic}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {spaceHint && (
            <span className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <Lightbulb className="w-3 h-3" />{spaceHint}
            </span>
          )}

          {/* Task timer — visible on task slides */}
          {slide.type === 'task' && taskTimer !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${timerColor} gamma-timer-bar transition-all duration-1000`} style={{ '--timer-pct': `${timerPct}%` } as React.CSSProperties} />
              </div>
              <span className={`font-mono text-xs font-bold ${taskTimer === 0 ? 'text-red-400 animate-pulse' : taskTimer < 20 ? 'text-amber-400' : 'text-slate-400'}`}>
                {Math.floor(taskTimer / 60)}:{String(taskTimer % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                title={timerRunning ? 'Пауза' : 'Започни тајмер'}
                onClick={() => timerRunning ? stopTimer() : startTimer(taskTimer)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition"
              >
                <Timer className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Speaker notes toggle */}
          {slide.speakerNotes && (
            <button
              type="button"
              title={notesOpen ? 'Скриј белешки' : 'Прикажи белешки за наставникот'}
              onClick={() => setNotesOpen(v => !v)}
              className={`p-1.5 rounded-lg transition ${notesOpen ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10 text-slate-500 hover:text-white'}`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          {/* Annotation toolbar */}
          <div className="flex items-center gap-0.5 border border-white/10 rounded-xl p-0.5 bg-white/5">
            <button type="button" title="Рисување (D)" onClick={() => toggleAnnot('draw')}
              className={`p-1.5 rounded-lg transition ${annotMode === 'draw' ? 'bg-red-500/30 text-red-300' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Маркер / Highlight (H)" onClick={() => toggleAnnot('highlight')}
              className={`p-1.5 rounded-lg transition ${annotMode === 'highlight' ? 'bg-yellow-500/30 text-yellow-300' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>
              <span className="text-[11px] font-black leading-none select-none">HL</span>
            </button>
            <button type="button" title="Laser pointer (L)" onClick={() => toggleAnnot('laser')}
              className={`p-1.5 rounded-lg transition ${annotMode === 'laser' ? 'bg-cyan-500/30 text-cyan-300' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            {undoCount > 0 && (
              <button type="button" title="Врати (Ctrl+Z)" onClick={undoAnnotation}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-blue-500/10 transition">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {hasAnnotations && (
              <button type="button" title="Избриши аннотации (C)" onClick={clearCanvas}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition">
                <Eraser className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Thumbnail grid toggle */}
          <button type="button" onClick={() => setShowGrid(v => !v)} title="Преглед на слајдови (G)"
            className={`p-1.5 rounded-lg transition ${showGrid ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}>
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Presenter Mode */}
          <button type="button" onClick={openPresenterMode} title="Presenter Mode — отвори втор прозорец со notes"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
            <MonitorPlay className="w-3.5 h-3.5" />
          </button>

          {/* Gamma Live */}
          {gammaLivePin ? (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-[10px] font-black animate-pulse">
                <RadioTower className="w-3 h-3" />
                {gammaLivePin}
              </span>
              {liveResponses.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-bold">
                  <Users className="w-3 h-3" />{liveResponses.length}
                </span>
              )}
              {liveHandsCount > 0 && (
                <span className="text-[10px] text-amber-400 font-bold">✋{liveHandsCount}</span>
              )}
              <button type="button" onClick={endLiveSession} title="Заврши Gamma Live сесија"
                className="px-2 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-400 text-[10px] font-black transition">
                Крај
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startLiveSession}
              disabled={isStartingLive || !firebaseUser}
              title="Старт Gamma Live — ученици се приклучуваат со PIN"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-semibold"
            >
              {isStartingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Live</span>
            </button>
          )}

          {/* Print / Handout / PPTX / Fullscreen */}
          <button type="button" onClick={() => window.print()} title="Печати слајд (P)"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => printGammaHandout(data)} title="Генерирај Handout за учениците"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
            <BookText className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExportPPTX}
            disabled={isExportingPptx}
            title="Зачувај PPTX (PowerPoint)"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-semibold"
          >
            {isExportingPptx
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileDown className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">PPTX</span>
          </button>
          <button type="button" onClick={toggleFullscreen} title={isFullscreen ? 'Излези од цел екран (F)' : 'Цел екран (F)'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          <span aria-live="polite" className="text-xs font-bold text-slate-500 ml-1">
            {idx + 1} / {total}
          </span>
          <button type="button" onClick={onClose} title="Излези од Gamma Mode (Esc)"
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Slide canvas ───────────────────────────────────────────────────── */}
      <div
        key={`${idx}-${transitionTick}`}
        className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-200 ${entryAnimationClass} ${
        !visible
          ? dir === 'fwd' ? 'opacity-0 translate-x-8' : 'opacity-0 -translate-x-8'
          : 'opacity-100 translate-x-0'
      }`}
        onTouchStart={e => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (!touchStartRef.current) return;
          const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
          const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
          touchStartRef.current = null;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            if (dx < 0) goNext(); else goPrev();
          } else if (dy < -80 && Math.abs(dx) < 40) {
            setNotesOpen(true);
          }
        }}
      >

        {/* Slide title (except for 'title' type which renders its own) */}
        {slide.type !== 'title' && (
          <div className="px-8 md:px-16 pt-8 pb-2 flex-shrink-0">
            <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
              <MathRenderer text={slide.title} />
            </h2>
          </div>
        )}

        {showContextStrip && (
          <div className="px-8 md:px-16 pb-2 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-400/20 bg-indigo-950/25 px-3 py-2">
              {slideConcept && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 text-indigo-200 px-2.5 py-1 text-[11px] font-semibold">
                  <BookOpen className="w-3 h-3" />
                  Концепт: {slideConcept}
                </span>
              )}
              {contextualFormulas.length > 0 ? (
                contextualFormulas.slice(0, 3).map((formula, fi) => (
                  <span key={`${formula}-${fi}`} className="inline-flex items-center rounded-full bg-cyan-500/15 text-cyan-100 px-2.5 py-1 text-[11px] font-medium">
                    <MathRenderer text={formula} />
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">Нема претходни формули за поврзување.</span>
              )}
              {contextualFormulas.length > 3 && (
                <span className="text-[11px] text-slate-400 font-semibold">+{contextualFormulas.length - 3} формули</span>
              )}
            </div>
          </div>
        )}

        {renderBody()}

        {/* ── Watermark / school logo ─────────────────────────────────────── */}
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none select-none flex items-center gap-2 opacity-40">
          {user?.isPremium && user?.schoolLogoUrl ? (
            <img src={user.schoolLogoUrl} alt="лого" className="h-5 w-auto object-contain" />
          ) : null}
          <span className={`text-[10px] font-bold tracking-wide ${user?.isPremium && user?.schoolName ? 'text-indigo-300' : 'text-slate-500'}`}>
            {user?.isPremium && user?.schoolName ? user.schoolName : 'ai.mismath.net'}
          </span>
        </div>

        {/* Annotation canvas overlay */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 z-20 ${
            annotMode && annotMode !== 'laser' ? 'cursor-crosshair' :
            annotMode === 'laser' ? 'cursor-none' : 'pointer-events-none'
          } w-full h-full`}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseLeave}
        />

        {/* Laser pointer glow */}
        {annotMode === 'laser' && laserPos && (
          <div className="gamma-laser-pointer z-30 pointer-events-none"
            style={{ '--laser-x': `${laserPos.x - 14}px`, '--laser-y': `${laserPos.y - 14}px` } as React.CSSProperties}>
            <div className="absolute inset-0 rounded-full bg-red-500/25 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.6)]" />
          </div>
        )}

        {/* Gamma Live PIN overlay */}
        {gammaLivePin && (
          <div className="absolute bottom-4 right-4 z-40 pointer-events-none">
            <div className="bg-slate-950/90 border border-red-500/40 rounded-2xl px-4 py-3 text-center shadow-2xl">
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-0.5">Gamma Live</p>
              <p className="text-2xl font-black text-white tracking-[0.25em]">{gammaLivePin}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">ai.mismath.net/#/gamma/join</p>
              {liveResponses.length > 0 && (
                <p className="text-[10px] text-emerald-400 font-bold mt-1">✓ {liveResponses.length} одговори</p>
              )}
              {liveHandsCount > 0 && (
                <p className="text-[10px] text-amber-400 font-bold">✋ {liveHandsCount} крена рака</p>
              )}
            </div>
          </div>
        )}

        {/* Active mode indicator badge */}
        {annotMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border ${
              annotMode === 'draw'      ? 'bg-red-950/60 border-red-500/30 text-red-300' :
              annotMode === 'highlight' ? 'bg-yellow-950/60 border-yellow-500/30 text-yellow-300' :
                                          'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
            }`}>
              {annotMode === 'draw' ? '✏ Рисување' : annotMode === 'highlight' ? '◼ Маркер' : '⊕ Laser'}
              {' · '}Esc за излез
            </span>
          </div>
        )}
      </div>

      {/* ── Thumbnail grid overlay ─────────────────────────────────────────── */}
      {showGrid && (
        <GammaThumbnailGrid
          slides={slides}
          activeIdx={idx}
          onJump={jumpToSlide}
          onClose={() => setShowGrid(false)}
        />
      )}

      {/* ── Speaker notes panel ────────────────────────────────────────────── */}
      {notesOpen && slide.speakerNotes && (
        <div className="flex-shrink-0 border-t border-amber-500/20 bg-amber-950/30 px-8 py-3 animate-fade-in">
          <div className="flex items-start gap-2 max-w-4xl mx-auto">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-200/80 leading-relaxed">{slide.speakerNotes}</p>
          </div>
        </div>
      )}

      {/* ── Footer: progress + navigation ─────────────────────────────────── */}
      <div className="gamma-controls flex flex-col gap-3 px-6 py-4 border-t border-white/5 flex-shrink-0">
        {/* Progress dots */}
        <div role="group" aria-label="Навигација по слајдови" className="flex items-center justify-center gap-1.5">
          {dots.map((dotSlideIdx, di) => {
            const isActive = idx >= dotSlideIdx && (di === dots.length - 1 || idx < dots[di + 1]);
            return (
              <button key={di} type="button"
                title={`Оди на слајд ${dotSlideIdx + 1}`}
                aria-label={`Слајд ${dotSlideIdx + 1} од ${total}`}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => jumpToSlide(dotSlideIdx)}
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
          ← → навигација · Space следен · R решение · D/H/L аннотации · Ctrl+Z врати · G мрежа · F цел екран · P печати · Esc излез
        </p>
        <p aria-live="polite" className="sr-only">{spaceHint}</p>
      </div>
    </div>
  );
};
