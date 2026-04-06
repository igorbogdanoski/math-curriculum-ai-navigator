import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Lightbulb, CheckCircle2, BookOpen, Sparkles, Loader2, MessageSquare, Timer, ArrowLeftRight, Shield, Pencil, Eraser, Crosshair, Maximize, Minimize, Printer, RotateCcw, FileDown } from 'lucide-react';
import { Shape3DViewer, Shape3DType, SHAPE_ORDER } from '../math/Shape3DViewer';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { ChartPreview } from '../dataviz/ChartPreview';
import type { ChartConfig } from '../dataviz/ChartPreview';
import type { TableData } from '../dataviz/DataTable';
import { SlideSVGRenderer } from './SlideSVGRenderer';
import { generateMathSVG } from '../../services/gemini/svg';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';

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
  'comparison':      { label: 'Споредба',         color: 'text-sky-300',     bg: 'bg-sky-900/40'     },
  'proof':           { label: 'Доказ',            color: 'text-purple-300',  bg: 'bg-purple-900/40'  },
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export const GammaModeModal: React.FC<Props> = ({ data, startIndex = 0, onClose }) => {
  const { user }                = useAuth();
  const { addNotification }     = useNotification();
  const [idx, setIdx]           = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [stepIdx, setStepIdx]   = useState(0);
  const [visible, setVisible]   = useState(true);
  const [dir, setDir]           = useState<'fwd' | 'back'>('fwd');
  const containerRef            = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── SVG illustration cache: slideIdx → svg string ─────────────────────────
  const [svgCache, setSvgCache]       = useState<Record<number, string>>({});
  const [svgLoading, setSvgLoading]   = useState<Record<number, boolean>>({});
  const generatingRef                 = useRef<Set<number>>(new Set());

  // ── Speaker notes ─────────────────────────────────────────────────────────
  const [notesOpen, setNotesOpen]     = useState(false);

  // ── PPTX export ───────────────────────────────────────────────────────────
  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const exportGammaPPTX = useCallback(async () => {
    if (isExportingPptx) return;
    setIsExportingPptx(true);
    addNotification('Генерирам PPTX презентација…', 'info');
    try {
      const { default: pptxgen } = await import('pptxgenjs');
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';
      const W = 10; // inches

      // Dark Gamma theme
      const BG    = '0F172A'; // slate-950
      const TITLE = 'A5B4FC'; // indigo-300
      const BODY  = 'CBD5E1'; // slate-300
      const LINE  = '3730A3'; // indigo-800
      const ACCT  = '818CF8'; // indigo-400

      const isPro = !!(user?.isPremium);
      const logoUrl = user?.schoolLogoUrl ?? null;
      const footerText = isPro && user?.schoolName
        ? user.schoolName
        : 'ai.mismath.net';

      for (let i = 0; i < data.slides.length; i++) {
        const slide = data.slides[i];
        const pptSlide = pptx.addSlide();
        pptSlide.background = { color: BG };

        // ── Slide header bar ──
        pptSlide.addShape('rect', { x: 0, y: 0, w: W, h: 0.55, fill: { color: '1E1B4B' } });
        pptSlide.addText(slide.title ?? '', {
          x: 0.3, y: 0.05, w: W - 2, h: 0.45,
          fontSize: 14, bold: true, color: TITLE, fontFace: 'Arial',
        });
        pptSlide.addText(`${i + 1} / ${data.slides.length}`, {
          x: W - 1.5, y: 0.05, w: 1.2, h: 0.45,
          fontSize: 11, color: '6366F1', align: 'right', fontFace: 'Arial',
        });

        // ── Slide body by type ──
        const contentY = 0.75;
        const contentH = 4.35;
        const lineH = 0.44;

        if (slide.type === 'title') {
          pptSlide.addText(slide.title ?? '', {
            x: 0.5, y: 1.5, w: W - 1, h: 1.4,
            fontSize: 40, bold: true, color: TITLE, align: 'center', fontFace: 'Arial',
          });
          if (slide.content.length > 0) {
            pptSlide.addText(slide.content.join('\n'), {
              x: 0.5, y: 3.1, w: W - 1, h: 1.2,
              fontSize: 18, color: BODY, align: 'center', fontFace: 'Arial',
            });
          }
          pptSlide.addText(`${data.topic} · ${data.gradeLevel}. одделение`, {
            x: 0.5, y: 4.4, w: W - 1, h: 0.4,
            fontSize: 12, color: ACCT, align: 'center', fontFace: 'Arial',
          });

        } else if (slide.type === 'formula-centered') {
          pptSlide.addShape('roundRect', {
            x: 1.0, y: contentY + 0.4, w: W - 2, h: 1.6,
            fill: { color: '1E1B4B' },
            line: { color: LINE, width: 2 },
          });
          pptSlide.addText(slide.content[0] ?? slide.title ?? '', {
            x: 1.0, y: contentY + 0.6, w: W - 2, h: 1.2,
            fontSize: 24, bold: true, color: TITLE, align: 'center', fontFace: 'Courier New',
          });
          let noteY = contentY + 2.3;
          for (const note of slide.content.slice(1)) {
            pptSlide.addText(`• ${note}`, { x: 1.0, y: noteY, w: W - 2, h: lineH, fontSize: 14, color: BODY, fontFace: 'Arial' });
            noteY += lineH;
            if (noteY > contentY + contentH) break;
          }

        } else if (slide.type === 'step-by-step' || slide.type === 'proof') {
          let curY = contentY;
          slide.content.forEach((step, si) => {
            pptSlide.addShape('roundRect', {
              x: 0.4, y: curY, w: 0.5, h: 0.36,
              fill: { color: si === 0 ? '4F46E5' : '1E1B4B' },
              line: { color: LINE, width: 1 },
            });
            pptSlide.addText(String(si + 1), { x: 0.4, y: curY + 0.02, w: 0.5, h: 0.32, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center' });
            pptSlide.addText(step, { x: 1.1, y: curY, w: W - 1.5, h: lineH, fontSize: 14, color: BODY, fontFace: 'Arial' });
            curY += lineH + 0.04;
            if (curY > contentY + contentH) return;
          });

        } else if (slide.type === 'task' || slide.type === 'example') {
          const isTask = slide.type === 'task';
          const boxColor = isTask ? '451A03' : '052E16';
          const labelColor = isTask ? 'FCD34D' : '6EE7B7';
          pptSlide.addShape('roundRect', {
            x: 0.5, y: contentY, w: W - 1, h: 2.2,
            fill: { color: boxColor }, line: { color: isTask ? '92400E' : '065F46', width: 1.5 },
          });
          pptSlide.addText(isTask ? '📝 Задача' : '💡 Пример', {
            x: 0.8, y: contentY + 0.15, w: 3, h: 0.35, fontSize: 11, bold: true, color: labelColor,
          });
          pptSlide.addText(slide.content[0] ?? '', {
            x: 0.8, y: contentY + 0.55, w: W - 1.6, h: 1.5, fontSize: 15, color: '#E2E8F0', fontFace: 'Arial', wrap: true,
          });
          if (slide.solution && slide.solution.length > 0) {
            let solY = contentY + 2.45;
            pptSlide.addText('Решение:', { x: 0.5, y: solY, w: 2, h: 0.32, fontSize: 11, bold: true, color: '6EE7B7' });
            solY += 0.34;
            for (const sol of slide.solution) {
              pptSlide.addText(`• ${sol}`, { x: 0.5, y: solY, w: W - 1, h: lineH, fontSize: 13, color: BODY, fontFace: 'Arial' });
              solY += lineH;
              if (solY > 5.1) break;
            }
          }

        } else {
          // content / summary / comparison / proof fallback
          let curY = contentY;
          for (const line of slide.content) {
            pptSlide.addShape('ellipse', { x: 0.4, y: curY + 0.14, w: 0.12, h: 0.12, fill: { color: ACCT } });
            pptSlide.addText(line, { x: 0.65, y: curY, w: W - 1.1, h: lineH, fontSize: 15, color: BODY, fontFace: 'Arial' });
            curY += lineH + 0.04;
            if (curY > contentY + contentH) break;
          }
        }

        // ── Speaker notes ──
        pptSlide.addNotes([
          `Слајд ${i + 1}/${data.slides.length}: ${slide.title ?? ''}`,
          slide.speakerNotes ?? '',
          `Тема: ${data.topic} | Генерирано со Math Navigator AI (Gamma Mode)`,
        ].filter(Boolean).join('\n'));

        // ── Footer ──
        pptSlide.addShape('line', { x: 0, y: 5.38, w: W, h: 0, line: { color: LINE, width: 0.75 } });
        if (isPro && logoUrl) {
          try {
            pptSlide.addImage({ path: logoUrl, x: 0.2, y: 5.41, w: 0.6, h: 0.18 });
          } catch { /* logo load fail — fall through to text */ }
        }
        pptSlide.addText(footerText, {
          x: isPro && logoUrl ? 0.9 : 0.3, y: 5.41, w: W - 1, h: 0.2,
          fontSize: 8, color: isPro ? ACCT : '475569', fontFace: 'Arial',
          italic: !isPro,
        });
        pptSlide.addText(`${data.topic} · ${data.gradeLevel}. одд.`, {
          x: W - 3.5, y: 5.41, w: 3.2, h: 0.2,
          fontSize: 8, color: '475569', align: 'right',
        });
      }

      const safeTitle = data.title.replace(/\s+/g, '_').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 80) || 'gamma';
      await pptx.writeFile({ fileName: `${safeTitle}_gamma.pptx` });
      addNotification('PPTX успешно зачуван! ✅', 'success');
    } catch (err) {
      console.error('[Gamma PPTX]', err);
      addNotification('Грешка при генерирање на PPTX.', 'error');
    } finally {
      setIsExportingPptx(false);
    }
  }, [data, user, isExportingPptx, addNotification]);

  // ── Annotation tools ───────────────────────────────────────────────────────
  type AnnotMode = 'draw' | 'highlight' | 'laser' | null;
  const [annotMode, setAnnotMode]       = useState<AnnotMode>(null);
  const [hasAnnotations, setHasAnnot]   = useState(false);
  const [laserPos, setLaserPos]         = useState<{ x: number; y: number } | null>(null);
  const canvasRef                       = useRef<HTMLCanvasElement>(null);
  const isDrawingRef                    = useRef(false);
  const lastPosRef                      = useRef({ x: 0, y: 0 });
  const undoStackRef                    = useRef<ImageData[]>([]);
  const [undoCount, setUndoCount]       = useState(0);

  // Size canvas to match its CSS size whenever layout changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return; // hidden or not yet laid out
      // Preserve existing drawings by copying to a temp canvas
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) tmpCtx.drawImage(canvas, 0, 0);
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(tmp, 0, 0);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Clear canvas on slide change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasAnnot(false);
    setLaserPos(null);
  }, [idx]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Push current state to undo stack before clearing
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    setUndoCount(undoStackRef.current.length);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasAnnot(false);
  }, []);

  const undoAnnotation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = undoStackRef.current.pop()!;
    setUndoCount(undoStackRef.current.length);
    ctx.putImageData(prev, 0, 0);
    // Check if canvas still has content after undo
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    setHasAnnot(data.some(v => v !== 0));
  }, []);

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

  const toggleAnnot = useCallback((mode: AnnotMode) => {
    setAnnotMode(prev => prev === mode ? null : mode);
    setLaserPos(null);
  }, []);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotMode === 'laser' || !annotMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Snapshot before each stroke for undo
      undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      setUndoCount(undoStackRef.current.length);
    }
    const rect = canvas.getBoundingClientRect();
    isDrawingRef.current = true;
    lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, [annotMode]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (annotMode === 'laser') {
      setLaserPos({ x, y });
      return;
    }
    if (!isDrawingRef.current || !annotMode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = annotMode === 'highlight' ? 'rgba(250,204,21,0.35)' : '#ef4444';
    ctx.lineWidth   = annotMode === 'highlight' ? 22 : 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    lastPosRef.current = { x, y };
    setHasAnnot(true);
  }, [annotMode]);

  const onCanvasMouseUp = useCallback(() => { isDrawingRef.current = false; }, []);

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
    setVisible(false);
    setTimeout(() => {
      fn();
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }, 160);
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
      if (e.key === 'Escape')     { if (annotMode) { setAnnotMode(null); } else { onClose(); } }
      if (e.key === 'r' || e.key === 'R') setRevealed(true);
      if (e.key === 'd' || e.key === 'D') toggleAnnot('draw');
      if (e.key === 'h' || e.key === 'H') toggleAnnot('highlight');
      if (e.key === 'l' || e.key === 'L') toggleAnnot('laser');
      if (e.key === 'c' || e.key === 'C') clearCanvas();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoAnnotation(); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); window.print(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose, annotMode, toggleAnnot, clearCanvas, toggleFullscreen, undoAnnotation]);

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
    <div ref={containerRef} className="gamma-mode-container fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 select-none">

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
                <div className={`h-full ${timerColor} transition-all duration-1000`} style={{ width: `${timerPct}%` }} />
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

          {/* Print / PPTX / Fullscreen */}
          <button type="button" onClick={() => window.print()} title="Печати / Зачувај PDF (P)"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition">
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={exportGammaPPTX}
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

          <span className="text-xs font-bold text-slate-500 ml-1">
            {idx + 1} / {total}
          </span>
          <button type="button" onClick={onClose} title="Излези од Gamma Mode (Esc)"
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Slide canvas ───────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-200 ${
        !visible
          ? dir === 'fwd' ? 'opacity-0 translate-x-8' : 'opacity-0 -translate-x-8'
          : 'opacity-100 translate-x-0'
      }`}>

        {/* Slide title (except for 'title' type which renders its own) */}
        {slide.type !== 'title' && (
          <div className="px-8 md:px-16 pt-8 pb-2 flex-shrink-0">
            <h2 className="text-2xl md:text-4xl font-black text-white leading-tight">
              <MathRenderer text={slide.title} />
            </h2>
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
          onMouseLeave={() => { onCanvasMouseUp(); setLaserPos(null); }}
        />

        {/* Laser pointer glow */}
        {annotMode === 'laser' && laserPos && (
          <div className="absolute z-30 pointer-events-none"
            style={{ left: laserPos.x - 14, top: laserPos.y - 14, width: 28, height: 28 }}>
            <div className="absolute inset-0 rounded-full bg-red-500/25 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-red-500 shadow-[0_0_12px_4px_rgba(239,68,68,0.6)]" />
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
        <div className="flex items-center justify-center gap-1.5">
          {dots.map((dotSlideIdx, di) => {
            const isActive = idx >= dotSlideIdx && (di === dots.length - 1 || idx < dots[di + 1]);
            return (
              <button key={di} type="button"
                title={`Оди на слајд ${dotSlideIdx + 1}`}
                aria-label={`Слајд ${dotSlideIdx + 1} од ${total}`}
                aria-current={isActive ? 'step' : undefined}
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
          ← → навигација · Space следен · R решение · D/H/L аннотации · Ctrl+Z врати · F цел екран · P печати · Esc излез
        </p>
      </div>
    </div>
  );
};
