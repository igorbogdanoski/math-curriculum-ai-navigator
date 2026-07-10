import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Lightbulb, CheckCircle2, BookOpen, Sparkles, Loader2, MessageSquare, Timer, ArrowLeftRight, Shield, Pencil, Eraser, Crosshair, Maximize, Minimize, Printer, RotateCcw, FileDown, Grid, ZoomIn, ZoomOut, ClipboardList, BookText, MonitorPlay, Radio, RadioTower, Users, Gamepad2, RefreshCw, Vote } from 'lucide-react';
import { DokBadge } from '../common/DokBadge';
import type { DokLevel } from '../../types';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { generateMathSVG } from '../../services/gemini/svg';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { deriveContextualFormulas, resolveSlideConcept } from '../../utils/gammaContext';
import { useGammaAnnotation, type AnnotMode } from './gamma/useGammaAnnotation';
import { GammaThumbnailGrid } from './gamma/GammaThumbnailGrid';
import { exportGammaPPTX, printGammaHandout } from './gamma/GammaExportService';
import { useGammaExitTicket } from './gamma/useGammaExitTicket';
import { regenerateSlide, generatePollOptions } from '../../services/gemini/plans';
import {
  startGammaLive,
  broadcastGammaSlide,
  endGammaLive,
  subscribeGammaSession,
  subscribeGammaResponses,
  setGammaPollOptions,
  tallyPollResponses,
  type GammaLiveResponse,
} from '../../services/gammaLiveService';

import { SlideBody } from './GammaModeSlideBody';

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

// ── Live poll results bar ──────────────────────────────────────────────────────
function PollResultsBar({ options, tally }: { options: string[]; tally: Record<string, number> }) {
  const total = Object.values(tally).reduce((s, n) => s + n, 0);
  return (
    <div className="mt-2 space-y-1.5 text-left">
      {options.map((opt, i) => {
        const count = tally[opt] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-[10px] text-slate-300 mb-0.5">
              <span className="truncate pr-2">{String.fromCharCode(65 + i)}. {opt}</span>
              <span className="font-bold text-white shrink-0">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

  // ── Slide edit / regenerate ───────────────────────────────────────────────
  const [editMode, setEditMode]       = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ── PPTX export ───────────────────────────────────────────────────────────
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const { exitTicket, isGenerating: isGeneratingExitTicket, generate: generateExitTicket, dismiss: dismissExitTicket } = useGammaExitTicket();

  // ── Gamma Live ────────────────────────────────────────────────────────────
  const [gammaLivePin, setGammaLivePin] = useState<string | null>(null);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const [liveResponses, setLiveResponses] = useState<GammaLiveResponse[]>([]);
  const [liveHandsCount, setLiveHandsCount] = useState(0);
  const [showResponsesPanel, setShowResponsesPanel] = useState(false);
  const [activePollOptions, setActivePollOptions] = useState<string[] | null>(null);
  const [showPollEditor, setShowPollEditor] = useState(false);
  const [pollDraft, setPollDraft] = useState<string[]>(['', '']);
  const [isGeneratingPoll, setIsGeneratingPoll] = useState(false);
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
        setActivePollOptions(session?.pollOptions ?? null);
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
    setShowResponsesPanel(false);
    setActivePollOptions(null);
    setShowPollEditor(false);
    setPollDraft(['', '']);
  }, [gammaLivePin]);

  const startPoll = useCallback(async () => {
    if (!gammaLivePin) return;
    const options = pollDraft.map(o => o.trim()).filter(Boolean);
    if (options.length < 2) return;
    await setGammaPollOptions(gammaLivePin, options);
    setShowPollEditor(false);
  }, [gammaLivePin, pollDraft]);

  const stopPoll = useCallback(async () => {
    if (!gammaLivePin) return;
    await setGammaPollOptions(gammaLivePin, null);
    setPollDraft(['', '']);
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

  // Reset zoom and edit mode on slide change (canvas clearing handled by useGammaAnnotation)
  useEffect(() => { setFormulaZoom(1); setEditMode(false); setShowResponsesPanel(false); setShowPollEditor(false); setPollDraft(['', '']); }, [idx]);

  // ── Presenter Mode ────────────────────────────────────────────────────────
  const presenterChannelRef = useRef<BroadcastChannel | null>(null);
  const presenterWindowRef  = useRef<Window | null>(null);

  const openPresenterMode = useCallback(() => {
    if (!presenterChannelRef.current) {
      presenterChannelRef.current = new BroadcastChannel('gamma-sync');
    }
    if (!presenterWindowRef.current || presenterWindowRef.current.closed) {
      const pinParam = gammaLivePin ? `?pin=${gammaLivePin}` : '';
      presenterWindowRef.current = window.open(
        `${window.location.origin}${window.location.pathname}#/gamma/presenter${pinParam}`,
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

  const [slides, setSlides] = useState<PresentationSlide[]>(() => [...data.slides]);
  const slide  = slides[idx];
  const total  = slides.length;
  const meta   = SLIDE_META[slide.type];
  const isStepSlide = slide.type === 'step-by-step' || slide.type === 'proof';
  const isTaskSlide = slide.type === 'task' || slide.type === 'example';
  const hasReveal   = isTaskSlide && (slide.solution?.length ?? 0) > 0;

  // Responses for the slide currently on screen — used for both the "Живи одговори" list and poll tallies
  const slideResponses = useMemo(() => liveResponses.filter(r => r.slideIdx === idx), [liveResponses, idx]);

  const generateAiPollOptions = useCallback(async () => {
    if (isGeneratingPoll) return;
    setIsGeneratingPoll(true);
    try {
      const options = await generatePollOptions(slide.title, slide.content, data.gradeLevel);
      if (options.length >= 2) {
        setPollDraft(options);
      } else {
        addNotification('Не успеа генерирањето — внеси рачно.', 'error');
      }
    } catch {
      addNotification('Не успеа генерирањето — внеси рачно.', 'error');
    } finally {
      setIsGeneratingPoll(false);
    }
  }, [isGeneratingPoll, slide, data.gradeLevel, addNotification]);

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
        if (editMode) { setEditMode(false); return; }
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
  }, [goNext, goPrev, onClose, annotMode, showGrid, editMode, toggleAnnot, clearCanvas, toggleFullscreen, undoAnnotation]);

  // ── Hint for Space/Enter action ───────────────────────────────────────────
  const spaceHint = isStepSlide && stepIdx < slide.content.length - 1
    ? 'Space → следен чекор'
    : hasReveal && !revealed
      ? 'Space → прикажи решение'
      : idx < total - 1
        ? 'Space → следен слајд'
        : '';

  const handleRegenerateSlide = useCallback(async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const newSlide = await regenerateSlide(data.topic, data.gradeLevel, slide, user ?? undefined);
      setSlides(prev => prev.map((s, i) => i === idx ? newSlide : s));
      addNotification('Слајдот е регенериран!', 'success');
    } catch {
      addNotification('Грешка при регенерирање на слајдот', 'error');
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, data.topic, data.gradeLevel, slide, idx, user, addNotification]);

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
          <button
            type="button"
            title={notesOpen ? 'Скриј белешки' : 'Прикажи/уреди белешки за наставникот'}
            onClick={() => setNotesOpen(v => !v)}
            className={`p-1.5 rounded-lg transition ${notesOpen ? 'bg-amber-500/20 text-amber-300' : 'hover:bg-white/10 text-slate-500 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>

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
              {slideResponses.length > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-bold">
                  <Users className="w-3 h-3" />{slideResponses.length}
                </span>
              )}
              {liveHandsCount > 0 && (
                <span className="text-[10px] text-amber-400 font-bold">✋{liveHandsCount}</span>
              )}
              {isTaskSlide && (
                activePollOptions ? (
                  <button type="button" onClick={stopPoll} title="Прекини анкета"
                    className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition">
                    <Vote className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button type="button" onClick={() => setShowPollEditor(v => !v)} title="Направи анкета"
                    className={`p-1.5 rounded-lg transition ${showPollEditor ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-violet-300 hover:bg-violet-500/10'}`}>
                    <Vote className="w-3.5 h-3.5" />
                  </button>
                )
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
          <button type="button" onClick={() => printGammaHandout(data, { isPro: !!(user?.isPremium), schoolName: user?.schoolName ?? null, logoUrl: user?.schoolLogoUrl ?? null })} title="Генерирај Handout за учениците"
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

      {/* Poll editor popover */}
      {showPollEditor && (
        <div className="absolute top-14 right-4 z-50 w-72 bg-slate-900 border border-violet-500/30 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-violet-300 uppercase tracking-widest">Направи анкета</p>
            <button
              type="button"
              onClick={generateAiPollOptions}
              disabled={isGeneratingPoll}
              title="AI предложи опции врз основа на овој слајд"
              className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isGeneratingPoll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI предложи
            </button>
          </div>
          <div className="space-y-2">
            {pollDraft.map((opt, i) => (
              <input
                key={i}
                type="text"
                value={opt}
                onChange={e => setPollDraft(d => d.map((v, j) => j === i ? e.target.value : v))}
                placeholder={`Опција ${String.fromCharCode(65 + i)}`}
                maxLength={80}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            {pollDraft.length < 4 ? (
              <button type="button" onClick={() => setPollDraft(d => [...d, ''])}
                className="text-[11px] font-bold text-slate-400 hover:text-white transition">
                + Опција
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={startPoll}
              disabled={pollDraft.map(o => o.trim()).filter(Boolean).length < 2}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
            >
              Стартувај
            </button>
          </div>
        </div>
      )}

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
            <div className="flex items-start justify-between gap-3">
              {editMode ? (
                <input
                  aria-label="Наслов на слајдот"
                  placeholder="Наслов на слајдот"
                  className="flex-1 text-2xl md:text-3xl font-black text-white leading-tight bg-white/10 border border-white/20 focus:border-indigo-400/60 rounded-xl px-3 py-1.5 outline-none"
                  value={slide.title}
                  onChange={e => {
                    const val = e.target.value;
                    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, title: val } : s));
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <h2 className="text-2xl md:text-4xl font-black text-white leading-tight flex-1">
                  <MathRenderer text={slide.title} />
                </h2>
              )}
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                {slide.dokLevel && (
                  <DokBadge level={slide.dokLevel as DokLevel} size="compact" showTooltip />
                )}
                <button
                  type="button"
                  title={editMode ? 'Заврши уредување (Esc)' : 'Уреди слајд'}
                  onClick={() => setEditMode(v => !v)}
                  className={`p-1.5 rounded-xl transition ${editMode ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="AI Регенерирај слајд"
                  onClick={handleRegenerateSlide}
                  disabled={isRegenerating}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
                {slide.type === 'task' && (
                  <button
                    type="button"
                    title="Создај Kahoot квиз од оваа задача"
                    onClick={() => {
                      try {
                        sessionStorage.setItem('kahoot_gamma_prompt', JSON.stringify({
                          prompt: slide.content.join(' '),
                          count: 4,
                        }));
                      } catch { /* quota */ }
                      window.open('#/kahoot/make', '_blank');
                    }}
                    className="p-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-white transition flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" /> Kahoot
                  </button>
                )}
              </div>
            </div>

            {/* Inline content editor */}
            {editMode && (
              <div className="mt-3 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                {slide.content.map((line, li) => (
                  <div key={li} className="flex gap-1.5 items-start">
                    <textarea
                      aria-label={`Точка ${li + 1}`}
                      placeholder={`Точка ${li + 1}`}
                      className="flex-1 text-sm text-slate-200 bg-white/5 border border-white/10 focus:border-indigo-400/50 rounded-lg px-2.5 py-1.5 outline-none resize-none leading-snug"
                      value={line}
                      rows={2}
                      onChange={e => {
                        const val = e.target.value;
                        setSlides(prev => prev.map((s, i) => i === idx ? {
                          ...s, content: s.content.map((c, ci) => ci === li ? val : c),
                        } : s));
                      }}
                    />
                    <button
                      type="button"
                      title={`Отстрани точка ${li + 1}`}
                      onClick={() => setSlides(prev => prev.map((s, i) => i === idx
                        ? { ...s, content: s.content.filter((_, ci) => ci !== li) }
                        : s))}
                      className="p-1.5 text-red-400/50 hover:text-red-400 transition mt-0.5 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSlides(prev => prev.map((s, i) => i === idx
                    ? { ...s, content: [...s.content, ''] }
                    : s))}
                  className="text-xs text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition self-start"
                >
                  + Додај точка
                </button>
              </div>
            )}
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

        <SlideBody
          slide={slide}
          data={data}
          idx={idx}
          svgCache={svgCache}
          setSvgCache={setSvgCache}
          svgLoading={svgLoading}
          setSvgLoading={setSvgLoading}
          formulaZoom={formulaZoom}
          setFormulaZoom={setFormulaZoom}
          revealed={revealed}
          setRevealed={setRevealed}
          stepIdx={stepIdx}
          setStepIdx={setStepIdx}
          exitTicket={exitTicket}
          generateExitTicket={generateExitTicket}
          isGeneratingExitTicket={isGeneratingExitTicket}
          dismissExitTicket={dismissExitTicket}
          generateSVGForSlide={generateSVGForSlide}
          hasReveal={hasReveal}
        />

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
            <div className="bg-slate-950/90 border border-red-500/40 rounded-2xl px-4 py-3 text-center shadow-2xl max-w-[260px] pointer-events-auto">
              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-0.5">Gamma Live</p>
              <p className="text-2xl font-black text-white tracking-[0.25em]">{gammaLivePin}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">ai.mismath.net/#/gamma/join</p>
              {liveHandsCount > 0 && (
                <p className="text-[10px] text-amber-400 font-bold">✋ {liveHandsCount} крена рака</p>
              )}
              {activePollOptions && activePollOptions.length > 0 ? (
                <PollResultsBar options={activePollOptions} tally={tallyPollResponses(liveResponses, idx)} />
              ) : (
                <>
                  {slideResponses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowResponsesPanel(v => !v)}
                      className="text-[10px] text-emerald-400 font-bold mt-1 hover:text-emerald-300 transition"
                    >
                      ✓ {slideResponses.length} одговори {showResponsesPanel ? '▲' : '▼'}
                    </button>
                  )}
                  {showResponsesPanel && slideResponses.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-y-auto text-left space-y-1 border-t border-white/10 pt-2">
                      {slideResponses.map(r => (
                        <li key={r.studentId} className="text-[10px] text-slate-300 leading-snug">
                          <span className="font-bold text-white">{r.studentName}:</span> {r.answer}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
          onReorder={(from, to) => setSlides(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          })}
        />
      )}

      {/* ── Speaker notes panel ────────────────────────────────────────────── */}
      {notesOpen && (
        <div className="flex-shrink-0 border-t border-amber-500/20 bg-amber-950/30 px-8 py-3 animate-fade-in">
          <div className="flex items-start gap-2 max-w-4xl mx-auto">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <textarea
              aria-label="Белешки за наставникот"
              placeholder="Додај белешки за наставникот…"
              className="flex-1 text-xs text-amber-200/80 leading-relaxed bg-transparent border-none outline-none resize-none placeholder-amber-500/50"
              rows={2}
              value={slide.speakerNotes ?? ''}
              onChange={e => {
                const text = e.target.value;
                setSlides(prev => prev.map((s, i) => i === idx ? { ...s, speakerNotes: text } : s));
              }}
            />
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
